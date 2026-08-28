using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace Osminog.UpdaterHost;

internal static class Program
{
    private const string HostVersion = "1.1.0";
    private const int MaxNativeMessageBytes = 1024 * 1024;
    private const string FeedUrl = "https://raw.githubusercontent.com/jeep-jim/chernogram_new/briefcraft-releases/osminog/channels/dev/chrome-extension.json";
    private const string AllowedReleasePrefix = "https://raw.githubusercontent.com/jeep-jim/chernogram_new/briefcraft-releases/osminog/";
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };
    private static readonly string BaseDirectory = AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
    private static readonly string LogPath = Path.Combine(BaseDirectory, "osminog-devhub.log");

    public static async Task<int> Main(string[] args)
    {
        try
        {
            if (args.Length > 0)
            {
                return args[0].ToLowerInvariant() switch
                {
                    "--version" => PrintVersion(),
                    "--self-test" => SelfTest(),
                    "--check" => await ConsoleCommandAsync("check"),
                    "--update" => await ConsoleCommandAsync("update"),
                    "--status" => await ConsoleCommandAsync("status"),
                    "--rollback" => await ConsoleCommandAsync("rollback"),
                    _ => 2
                };
            }
            await RunNativeMessagingLoopAsync();
            return 0;
        }
        catch (Exception ex)
        {
            Log("FATAL " + ex);
            return 1;
        }
    }

    private static int PrintVersion() { Console.WriteLine($"OSMINOG Dev Hub {HostVersion}"); return 0; }

    private static int SelfTest()
    {
        try
        {
            var config = LoadConfig();
            var detected = TryResolveInstallDir(config, null);
            Console.WriteLine("SELF-TEST OK");
            Console.WriteLine(detected ?? "Extension path will be detected when OSMINOG calls Dev Hub.");
            return 0;
        }
        catch (Exception ex) { Console.Error.WriteLine(ex.Message); return 1; }
    }

    private static async Task<int> ConsoleCommandAsync(string action)
    {
        var response = await HandleRequestAsync(new NativeRequest { Action = action });
        Console.WriteLine(JsonSerializer.Serialize(response, JsonOptions));
        return response.Ok ? 0 : 1;
    }

    private static async Task RunNativeMessagingLoopAsync()
    {
        await using var input = Console.OpenStandardInput();
        await using var output = Console.OpenStandardOutput();
        var header = new byte[4];
        while (true)
        {
            if (!await ReadExactOrEofAsync(input, header, 4)) return;
            var length = BitConverter.ToInt32(header, 0);
            if (length <= 0 || length > MaxNativeMessageBytes)
            {
                await WriteFrameAsync(output, NativeResponse.CreateError("INVALID_MESSAGE_LENGTH", "Native message length is invalid."));
                return;
            }
            var payload = new byte[length];
            await ReadExactAsync(input, payload, length);
            NativeResponse response;
            try
            {
                var request = JsonSerializer.Deserialize<NativeRequest>(payload, JsonOptions) ?? new NativeRequest();
                response = await HandleRequestAsync(request);
            }
            catch (Exception ex)
            {
                Log("REQUEST ERROR " + ex);
                response = NativeResponse.CreateError("DEV_HUB_FAILURE", ex.Message);
            }
            await WriteFrameAsync(output, response);
        }
    }

    private static async Task<NativeResponse> HandleRequestAsync(NativeRequest request)
    {
        var action = (request.Action ?? request.Command ?? request.Operation ?? "status").Trim().ToLowerInvariant();
        var config = LoadConfig();
        config.InstallDir = ResolveInstallDir(config, request.CurrentVersion);
        ValidateInstalledExtension(config);
        return action switch
        {
            "check" => await CheckAsync(config),
            "update" or "upgrade" or "install" or "apply" => await UpdateAsync(config),
            "status" or "ping" or "health" => Ready(config),
            "rollback" => Rollback(config),
            _ => NativeResponse.CreateError("UNKNOWN_ACTION", $"Unknown Dev Hub action: {action}", ReadInstalledVersion(config.InstallDir))
        };
    }

    private static UpdaterConfig LoadConfig()
    {
        var path = Path.Combine(BaseDirectory, "config.json");
        if (!File.Exists(path)) throw new FileNotFoundException("Dev Hub config is missing.", path);
        var config = JsonSerializer.Deserialize<UpdaterConfig>(File.ReadAllText(path, Encoding.UTF8), JsonOptions)
                     ?? throw new InvalidDataException("Dev Hub config is invalid.");
        if (string.IsNullOrWhiteSpace(config.FeedUrl)) config.FeedUrl = FeedUrl;
        if (!config.FeedUrl.Equals(FeedUrl, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("Unexpected OSMINOG update feed URL.");
        var root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "OSMINOG", "DevHub");
        config.VersionsDir ??= Path.Combine(root, "versions");
        config.WorkDir ??= Path.Combine(root, "work");
        config.MaxBackups = Math.Max(1, config.MaxBackups <= 0 ? 8 : config.MaxBackups);
        return config;
    }

    private static string ResolveInstallDir(UpdaterConfig config, string? expectedVersion)
    {
        var resolved = TryResolveInstallDir(config, expectedVersion);
        if (!string.IsNullOrWhiteSpace(resolved)) return resolved;
        throw new DirectoryNotFoundException("Не удалось автоматически найти папку загруженного OSMINOG. Убедитесь, что расширение включено в Chrome и имеет прежний ID.");
    }

    private static string? TryResolveInstallDir(UpdaterConfig config, string? expectedVersion)
    {
        var candidates = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        void AddCandidate(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return;
            try
            {
                var full = Path.GetFullPath(Environment.ExpandEnvironmentVariables(value));
                if (IsValidExtensionDir(full, config.ManifestKey)) candidates.Add(full);
            }
            catch { }
        }
        AddCandidate(config.InstallDir);
        var local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        AddCandidate(Path.Combine(local, "BriefCraft Dev", "current"));
        AddCandidate(Path.Combine(local, "OSMINOG", "Dev", "chrome-extension"));
        AddCandidate(Path.Combine(local, "OSMINOG", "DevHub", "chrome-extension"));

        var userData = Path.Combine(local, "Google", "Chrome", "User Data");
        if (Directory.Exists(userData) && !string.IsNullOrWhiteSpace(config.ExtensionId))
        {
            foreach (var profileDir in Directory.EnumerateDirectories(userData))
            {
                foreach (var fileName in new[] { "Preferences", "Secure Preferences" })
                {
                    var prefPath = Path.Combine(profileDir, fileName);
                    if (!File.Exists(prefPath)) continue;
                    try
                    {
                        using var stream = new FileStream(prefPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
                        using var doc = JsonDocument.Parse(stream);
                        if (!doc.RootElement.TryGetProperty("extensions", out var extensions)) continue;
                        if (!extensions.TryGetProperty("settings", out var settings)) continue;
                        if (!settings.TryGetProperty(config.ExtensionId, out var entry)) continue;
                        if (!entry.TryGetProperty("path", out var pathElement) || pathElement.ValueKind != JsonValueKind.String) continue;
                        var raw = pathElement.GetString();
                        if (string.IsNullOrWhiteSpace(raw)) continue;
                        if (Path.IsPathRooted(raw)) AddCandidate(raw);
                        else
                        {
                            AddCandidate(Path.Combine(profileDir, raw));
                            AddCandidate(Path.Combine(userData, raw));
                            AddCandidate(Path.Combine(local, raw));
                        }
                    }
                    catch { }
                }
            }
        }
        if (candidates.Count == 0) return null;
        var ranked = candidates.Select(path => new
        {
            Path = path,
            Version = SafeReadVersion(path),
            Stamp = File.GetLastWriteTimeUtc(Path.Combine(path, "manifest.json"))
        });
        if (!string.IsNullOrWhiteSpace(expectedVersion))
        {
            var exact = ranked.Where(x => string.Equals(x.Version, expectedVersion, StringComparison.OrdinalIgnoreCase)).OrderByDescending(x => x.Stamp).FirstOrDefault();
            if (exact != null) return exact.Path;
        }
        return ranked.OrderByDescending(x => x.Stamp).First().Path;
    }

    private static bool IsValidExtensionDir(string path, string? expectedKey)
    {
        var manifestPath = Path.Combine(path, "manifest.json");
        if (!File.Exists(manifestPath)) return false;
        try
        {
            var manifest = ReadManifest(path);
            if (string.IsNullOrWhiteSpace(manifest.Version)) return false;
            if (!string.IsNullOrWhiteSpace(expectedKey) && !string.Equals(expectedKey, manifest.Key, StringComparison.Ordinal)) return false;
            return true;
        }
        catch { return false; }
    }

    private static void ValidateInstalledExtension(UpdaterConfig config)
    {
        if (!IsValidExtensionDir(config.InstallDir, config.ManifestKey)) throw new InvalidDataException("Detected OSMINOG folder failed manifest/key validation.");
    }

    private static NativeResponse Ready(UpdaterConfig config)
    {
        var current = ReadInstalledVersion(config.InstallDir);
        return NativeResponse.CreateSuccess("ready", current, current, false, $"OSMINOG Dev Hub {HostVersion} is ready.");
    }

    private static async Task<NativeResponse> CheckAsync(UpdaterConfig config)
    {
        var current = ReadInstalledVersion(config.InstallDir);
        var feed = await DownloadJsonAsync<UpdateFeed>(config.FeedUrl);
        ValidateFeed(feed);
        var latest = feed.Latest?.Version ?? throw new InvalidDataException("The update feed has no latest version.");
        var available = CompareVersions(latest, current) > 0;
        return NativeResponse.CreateSuccess(available ? "update_available" : "up_to_date", current, latest, false,
            available ? $"OSMINOG {latest} is available." : $"OSMINOG {current} is current.");
    }

    private static async Task<NativeResponse> UpdateAsync(UpdaterConfig config)
    {
        var current = ReadInstalledVersion(config.InstallDir);
        var feedBytes = await DownloadBytesAsync(config.FeedUrl);
        var feed = JsonSerializer.Deserialize<UpdateFeed>(feedBytes, JsonOptions) ?? throw new InvalidDataException("Update feed is invalid.");
        ValidateFeed(feed);
        var latest = feed.Latest ?? throw new InvalidDataException("The update feed has no latest release.");
        var latestVersion = latest.Version ?? throw new InvalidDataException("Latest version is empty.");
        if (CompareVersions(latestVersion, current) <= 0) return NativeResponse.CreateSuccess("up_to_date", current, latestVersion, false, $"OSMINOG {current} is current.");
        if (!string.Equals(latest.Kind, "fileset", StringComparison.Ordinal)) throw new InvalidDataException($"Unsupported release kind: {latest.Kind}");
        AssertReleaseUrl(latest.Url);
        var filesetBytes = await DownloadBytesAsync(latest.Url!);
        VerifySizeAndHash(filesetBytes, latest.Size, latest.Sha256, "fileset");
        var fileset = JsonSerializer.Deserialize<FileSet>(filesetBytes, JsonOptions) ?? throw new InvalidDataException("Fileset is invalid.");
        if (!string.Equals(fileset.Schema, "briefcraft-fileset/v1", StringComparison.Ordinal)) throw new InvalidDataException("Unsupported fileset schema.");
        if (!string.Equals(fileset.Version, latestVersion, StringComparison.Ordinal)) throw new InvalidDataException("Fileset version does not match the feed.");
        if (!string.Equals(fileset.BaseVersion, current, StringComparison.Ordinal)) throw new InvalidDataException($"Release base mismatch. Installed {current}; required {fileset.BaseVersion}.");

        Directory.CreateDirectory(config.VersionsDir!);
        Directory.CreateDirectory(config.WorkDir!);
        var parent = Path.GetDirectoryName(Path.GetFullPath(config.InstallDir)) ?? throw new InvalidDataException("Extension parent directory is invalid.");
        var stage = Path.Combine(parent, ".osminog-stage-" + Guid.NewGuid().ToString("N"));
        var hold = Path.Combine(parent, ".osminog-old-" + Guid.NewGuid().ToString("N"));
        CopyDirectory(config.InstallDir, stage);
        try
        {
            foreach (var file in fileset.Files ?? new List<FileEntry>())
            {
                AssertReleaseUrl(file.Url);
                var bytes = await DownloadBytesAsync(file.Url!);
                VerifySizeAndHash(bytes, file.Size, file.Sha256, file.Path ?? "file");
                var target = SafeChildPath(stage, file.Path!);
                Directory.CreateDirectory(Path.GetDirectoryName(target)!);
                await File.WriteAllBytesAsync(target, bytes);
            }
            foreach (var patch in fileset.Patches ?? new List<PatchEntry>()) ApplyPatch(stage, patch);
            foreach (var entry in fileset.Delete ?? new List<JsonElement>())
            {
                var relative = entry.ValueKind == JsonValueKind.String ? entry.GetString() : entry.ValueKind == JsonValueKind.Object && entry.TryGetProperty("path", out var p) ? p.GetString() : null;
                if (string.IsNullOrWhiteSpace(relative)) continue;
                var target = SafeChildPath(stage, relative!);
                if (File.Exists(target)) File.Delete(target); else if (Directory.Exists(target)) Directory.Delete(target, true);
            }
            var stagedManifest = ReadManifest(stage);
            if (!string.Equals(stagedManifest.Version, latestVersion, StringComparison.Ordinal)) throw new InvalidDataException($"Staged manifest version is {stagedManifest.Version}; expected {latestVersion}.");
            if (!string.IsNullOrWhiteSpace(config.ManifestKey) && !string.Equals(config.ManifestKey, stagedManifest.Key, StringComparison.Ordinal)) throw new InvalidDataException("The release changed the fixed extension key.");

            var backup = Path.Combine(config.VersionsDir!, $"{current}-before-{latestVersion}-{DateTime.Now:yyyyMMdd-HHmmss}");
            Directory.Move(config.InstallDir, hold);
            try { Directory.Move(stage, config.InstallDir); }
            catch { if (!Directory.Exists(config.InstallDir) && Directory.Exists(hold)) Directory.Move(hold, config.InstallDir); throw; }
            try { CopyDirectory(hold, backup); } catch (Exception ex) { Log("BACKUP COPY WARNING " + ex.Message); }
            TryDeleteDirectory(hold);
            PruneBackups(config.VersionsDir!, config.MaxBackups);
            Log($"UPDATED {current} -> {latestVersion} @ {config.InstallDir}");
            return NativeResponse.CreateSuccess("updated", latestVersion, latestVersion, true, $"OSMINOG updated from {current} to {latestVersion}.");
        }
        finally
        {
            if (Directory.Exists(stage)) TryDeleteDirectory(stage);
            if (Directory.Exists(hold) && Directory.Exists(config.InstallDir)) TryDeleteDirectory(hold);
        }
    }

    private static NativeResponse Rollback(UpdaterConfig config)
    {
        var current = ReadInstalledVersion(config.InstallDir);
        if (!Directory.Exists(config.VersionsDir)) return NativeResponse.CreateError("NO_BACKUP", "No rollback build is available.", current);
        var candidate = new DirectoryInfo(config.VersionsDir!).EnumerateDirectories().Where(d => File.Exists(Path.Combine(d.FullName, "manifest.json"))).OrderByDescending(d => d.LastWriteTimeUtc).FirstOrDefault();
        if (candidate is null) return NativeResponse.CreateError("NO_BACKUP", "No rollback build is available.", current);
        var rollbackVersion = ReadInstalledVersion(candidate.FullName);
        var parent = Path.GetDirectoryName(Path.GetFullPath(config.InstallDir))!;
        var stage = Path.Combine(parent, ".osminog-rollback-" + Guid.NewGuid().ToString("N"));
        var hold = Path.Combine(parent, ".osminog-current-" + Guid.NewGuid().ToString("N"));
        CopyDirectory(candidate.FullName, stage);
        Directory.Move(config.InstallDir, hold);
        try { Directory.Move(stage, config.InstallDir); TryDeleteDirectory(hold); return NativeResponse.CreateSuccess("rolled_back", rollbackVersion, rollbackVersion, true, $"OSMINOG rolled back from {current} to {rollbackVersion}."); }
        catch { if (!Directory.Exists(config.InstallDir) && Directory.Exists(hold)) Directory.Move(hold, config.InstallDir); throw; }
    }

    private static void ApplyPatch(string stage, PatchEntry patch)
    {
        if (string.IsNullOrWhiteSpace(patch.Path)) throw new InvalidDataException("Patch path is empty.");
        var target = SafeChildPath(stage, patch.Path);
        if (!File.Exists(target)) throw new FileNotFoundException("Patch target is missing.", target);
        VerifyFileHash(target, patch.BeforeSha256, "Patch precondition failed");
        var content = File.ReadAllText(target, Encoding.UTF8);
        var search = patch.Search ?? throw new InvalidDataException("Patch search text is missing.");
        var index = content.IndexOf(search, StringComparison.Ordinal);
        if (index < 0) throw new InvalidDataException($"Patch search text was not found in {patch.Path}.");
        if (content.IndexOf(search, index + search.Length, StringComparison.Ordinal) >= 0) throw new InvalidDataException($"Patch search text is ambiguous in {patch.Path}.");
        var updated = content[..index] + (patch.Replace ?? string.Empty) + content[(index + search.Length)..];
        File.WriteAllText(target, updated, new UTF8Encoding(false));
        VerifyFileHash(target, patch.AfterSha256, "Patch result hash mismatch");
    }

    private static void ValidateFeed(UpdateFeed feed)
    {
        if (!string.Equals(feed.Schema, "briefcraft-update-feed/v1", StringComparison.Ordinal)) throw new InvalidDataException("Unsupported update feed schema.");
        if (feed.Latest is null) throw new InvalidDataException("The update feed has no latest release.");
    }

    private static ManifestInfo ReadManifest(string dir) => JsonSerializer.Deserialize<ManifestInfo>(File.ReadAllText(Path.Combine(dir, "manifest.json"), Encoding.UTF8), JsonOptions) ?? throw new InvalidDataException("manifest.json is invalid.");
    private static string ReadInstalledVersion(string dir) => ReadManifest(dir).Version ?? string.Empty;
    private static string SafeReadVersion(string dir) { try { return ReadInstalledVersion(dir); } catch { return string.Empty; } }

    private static async Task<T> DownloadJsonAsync<T>(string url) { var bytes = await DownloadBytesAsync(url); return JsonSerializer.Deserialize<T>(bytes, JsonOptions) ?? throw new InvalidDataException("Downloaded JSON is invalid."); }
    private static async Task<byte[]> DownloadBytesAsync(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps) throw new InvalidDataException("Only HTTPS downloads are allowed.");
        using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(45) };
        client.DefaultRequestHeaders.UserAgent.ParseAdd($"OSMINOG-DevHub/{HostVersion}");
        return await client.GetByteArrayAsync(uri);
    }
    private static void AssertReleaseUrl(string? url) { if (string.IsNullOrWhiteSpace(url) || !url.StartsWith(AllowedReleasePrefix, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException($"Release URL is outside the approved OSMINOG feed: {url}"); }
    private static void VerifySizeAndHash(byte[] bytes, long size, string? expectedHash, string label)
    {
        if (size > 0 && bytes.LongLength != size) throw new InvalidDataException($"{label} size mismatch. Expected {size}; received {bytes.LongLength}.");
        if (!string.IsNullOrWhiteSpace(expectedHash)) { var actual = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant(); if (!actual.Equals(expectedHash, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException($"{label} SHA-256 mismatch. Expected {expectedHash}; received {actual}."); }
    }
    private static void VerifyFileHash(string path, string? expectedHash, string prefix)
    {
        if (string.IsNullOrWhiteSpace(expectedHash)) return;
        using var stream = File.OpenRead(path); var actual = Convert.ToHexString(SHA256.HashData(stream)).ToLowerInvariant();
        if (!actual.Equals(expectedHash, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException($"{prefix} for {Path.GetFileName(path)}. Expected {expectedHash}; received {actual}.");
    }
    private static string SafeChildPath(string root, string relative)
    {
        if (string.IsNullOrWhiteSpace(relative) || Path.IsPathRooted(relative)) throw new InvalidDataException($"Unsafe release path: {relative}");
        var fullRoot = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        var full = Path.GetFullPath(Path.Combine(root, relative.Replace('/', Path.DirectorySeparatorChar)));
        if (!full.StartsWith(fullRoot, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException($"Release path escapes the extension directory: {relative}");
        return full;
    }
    private static void CopyDirectory(string source, string destination)
    {
        Directory.CreateDirectory(destination);
        foreach (var directory in Directory.EnumerateDirectories(source, "*", SearchOption.AllDirectories)) Directory.CreateDirectory(Path.Combine(destination, Path.GetRelativePath(source, directory)));
        foreach (var file in Directory.EnumerateFiles(source, "*", SearchOption.AllDirectories)) { var target = Path.Combine(destination, Path.GetRelativePath(source, file)); Directory.CreateDirectory(Path.GetDirectoryName(target)!); File.Copy(file, target, true); }
    }
    private static void PruneBackups(string versionsDir, int maxBackups) { foreach (var old in new DirectoryInfo(versionsDir).EnumerateDirectories().OrderByDescending(d => d.LastWriteTimeUtc).Skip(maxBackups)) TryDeleteDirectory(old.FullName); }
    private static void TryDeleteDirectory(string path) { try { Directory.Delete(path, true); } catch { } }
    private static int CompareVersions(string a, string b)
    {
        static int[] Parts(string value) => value.TrimStart('v', 'V').Split('.').Select(part => int.TryParse(part, out var number) ? number : 0).ToArray();
        var left = Parts(a); var right = Parts(b);
        for (var i = 0; i < Math.Max(left.Length, right.Length); i++) { var diff = (i < left.Length ? left[i] : 0).CompareTo(i < right.Length ? right[i] : 0); if (diff != 0) return diff; }
        return 0;
    }
    private static async Task<bool> ReadExactOrEofAsync(Stream stream, byte[] buffer, int count) { var offset = 0; while (offset < count) { var read = await stream.ReadAsync(buffer.AsMemory(offset, count - offset)); if (read == 0) return offset == 0 ? false : throw new EndOfStreamException("Unexpected end of native message header."); offset += read; } return true; }
    private static async Task ReadExactAsync(Stream stream, byte[] buffer, int count) { var offset = 0; while (offset < count) { var read = await stream.ReadAsync(buffer.AsMemory(offset, count - offset)); if (read == 0) throw new EndOfStreamException("Unexpected end of native message body."); offset += read; } }
    private static async Task WriteFrameAsync(Stream stream, NativeResponse response) { var payload = JsonSerializer.SerializeToUtf8Bytes(response, JsonOptions); var header = BitConverter.GetBytes(payload.Length); await stream.WriteAsync(header); await stream.WriteAsync(payload); await stream.FlushAsync(); }
    private static void Log(string message) { try { File.AppendAllText(LogPath, DateTime.UtcNow.ToString("O") + " " + message + Environment.NewLine, new UTF8Encoding(false)); } catch { } }
}

internal sealed class NativeRequest { public string? Action { get; set; } public string? Command { get; set; } public string? Operation { get; set; } public string? CurrentVersion { get; set; } public string? Channel { get; set; } }
internal sealed class NativeResponse
{
    public bool Ok { get; init; } public bool Success { get; init; } public bool Updated { get; init; }
    public string Status { get; init; } = "error"; public string Result { get; init; } = "error"; public string Code { get; init; } = "ERROR";
    public string? ErrorCode { get; init; } public string? Error { get; init; } public string Message { get; init; } = string.Empty;
    public string CurrentVersion { get; init; } = string.Empty; public string LatestVersion { get; init; } = string.Empty; public string Version { get; init; } = string.Empty;
    public bool Reload { get; init; } public bool ReloadRequired { get; init; } public bool RestartRequired { get; init; }
    public static NativeResponse CreateSuccess(string status, string current, string latest, bool updated, string message) => new() { Ok = true, Success = true, Updated = updated, Status = status, Result = status, Code = updated ? "UPDATED" : status.ToUpperInvariant(), Message = message, CurrentVersion = current, LatestVersion = latest, Version = latest, Reload = updated, ReloadRequired = updated, RestartRequired = false };
    public static NativeResponse CreateError(string code, string message, string current = "") => new() { Ok = false, Success = false, Updated = false, Status = "error", Result = "error", Code = code, ErrorCode = code, Error = message, Message = message, CurrentVersion = current, LatestVersion = current, Version = current };
}
internal sealed class UpdaterConfig { public string InstallDir { get; set; } = string.Empty; public string FeedUrl { get; set; } = string.Empty; public string? VersionsDir { get; set; } public string? WorkDir { get; set; } public int MaxBackups { get; set; } = 8; public string? ExtensionId { get; set; } public string? ManifestKey { get; set; } }
internal sealed class UpdateFeed { public string? Schema { get; set; } public ReleaseInfo? Latest { get; set; } }
internal sealed class ReleaseInfo { public string? Version { get; set; } public string? Kind { get; set; } public string? Url { get; set; } public string? Sha256 { get; set; } public long Size { get; set; } }
internal sealed class FileSet { public string? Schema { get; set; } public string? Version { get; set; } public string? BaseVersion { get; set; } public List<FileEntry>? Files { get; set; } public List<PatchEntry>? Patches { get; set; } public List<JsonElement>? Delete { get; set; } }
internal sealed class FileEntry { public string? Path { get; set; } public string? Url { get; set; } public string? Sha256 { get; set; } public long Size { get; set; } }
internal sealed class PatchEntry { public string? Path { get; set; } public string? Search { get; set; } public string? Replace { get; set; } public string? BeforeSha256 { get; set; } public string? AfterSha256 { get; set; } }
internal sealed class ManifestInfo { public string? Version { get; set; } public string? Key { get; set; } }
