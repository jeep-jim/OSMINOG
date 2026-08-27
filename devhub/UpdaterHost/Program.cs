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
    private const string HostVersion = "1.0.0";
    private const int MaxNativeMessageBytes = 1024 * 1024;
    private const string AllowedReleasePrefix = "https://raw.githubusercontent.com/jeep-jim/chernogram_new/briefcraft-releases/";
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };
    private static readonly string BaseDirectory = AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
    private static readonly string LogPath = Path.Combine(BaseDirectory, "osminog-updater.log");

    public static async Task<int> Main(string[] args)
    {
        try
        {
            if (args.Length > 0)
            {
                return args[0].ToLowerInvariant() switch
                {
                    "--version" => PrintVersion(),
                    "--self-test" => await SelfTestAsync(),
                    "--check" => await ConsoleCommandAsync("check"),
                    "--update" => await ConsoleCommandAsync("update"),
                    "--status" => await ConsoleCommandAsync("status"),
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

    private static int PrintVersion()
    {
        Console.WriteLine($"OSMINOG Updater Host {HostVersion}");
        return 0;
    }

    private static Task<int> SelfTestAsync()
    {
        try
        {
            var config = LoadConfig();
            ValidateInstalledExtension(config);
            Console.WriteLine("SELF-TEST OK");
            Console.WriteLine(config.InstallDir);
            return Task.FromResult(0);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex.Message);
            return Task.FromResult(1);
        }
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
            var gotHeader = await ReadExactOrEofAsync(input, header, 4);
            if (!gotHeader) return;

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
                response = NativeResponse.CreateError("NATIVE_HOST_FAILURE", ex.Message);
            }

            await WriteFrameAsync(output, response);
        }
    }

    private static async Task<NativeResponse> HandleRequestAsync(NativeRequest request)
    {
        var action = (request.Action ?? request.Command ?? request.Operation ?? "status").Trim().ToLowerInvariant();
        var config = LoadConfig();
        ValidateInstalledExtension(config);

        return action switch
        {
            "check" => await CheckAsync(config),
            "update" or "upgrade" or "install" or "apply" => await UpdateAsync(config),
            "status" or "ping" or "health" => Ready(config),
            "rollback" => Rollback(config),
            _ => NativeResponse.CreateError("UNKNOWN_ACTION", $"Unknown updater action: {action}", ReadInstalledVersion(config.InstallDir))
        };
    }

    private static UpdaterConfig LoadConfig()
    {
        var path = Path.Combine(BaseDirectory, "config.json");
        if (!File.Exists(path)) throw new FileNotFoundException("Updater config is missing.", path);
        var config = JsonSerializer.Deserialize<UpdaterConfig>(File.ReadAllText(path, Encoding.UTF8), JsonOptions)
                     ?? throw new InvalidDataException("Updater config is invalid.");
        if (string.IsNullOrWhiteSpace(config.InstallDir)) throw new InvalidDataException("installDir is empty.");
        if (string.IsNullOrWhiteSpace(config.FeedUrl)) throw new InvalidDataException("feedUrl is empty.");
        if (!config.FeedUrl.Equals("https://raw.githubusercontent.com/jeep-jim/chernogram_new/briefcraft-releases/briefcraft/channels/dev/chrome-extension.json", StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("Unexpected update feed URL.");
        config.VersionsDir ??= Path.Combine(Path.GetDirectoryName(config.InstallDir)!, "versions");
        config.WorkDir ??= Path.Combine(Path.GetDirectoryName(config.InstallDir)!, "work");
        config.MaxBackups = Math.Max(1, config.MaxBackups <= 0 ? 8 : config.MaxBackups);
        return config;
    }

    private static void ValidateInstalledExtension(UpdaterConfig config)
    {
        var manifestPath = Path.Combine(config.InstallDir, "manifest.json");
        if (!File.Exists(manifestPath)) throw new FileNotFoundException("OSMINOG extension manifest was not found.", manifestPath);
        var manifest = ReadManifest(config.InstallDir);
        if (string.IsNullOrWhiteSpace(manifest.Version)) throw new InvalidDataException("Installed manifest version is empty.");
        if (!string.IsNullOrWhiteSpace(config.ManifestKey) && !string.Equals(config.ManifestKey, manifest.Key, StringComparison.Ordinal))
            throw new InvalidDataException("Installed extension key does not match the updater configuration.");
    }

    private static NativeResponse Ready(UpdaterConfig config)
    {
        var current = ReadInstalledVersion(config.InstallDir);
        return NativeResponse.CreateSuccess("ready", current, current, false, "OSMINOG Dev Updater is ready.");
    }

    private static async Task<NativeResponse> CheckAsync(UpdaterConfig config)
    {
        var current = ReadInstalledVersion(config.InstallDir);
        var feed = await DownloadJsonAsync<UpdateFeed>(config.FeedUrl);
        ValidateFeed(feed);
        var latest = feed.Latest?.Version ?? throw new InvalidDataException("The update feed has no latest version.");
        var available = CompareVersions(latest, current) > 0;
        return NativeResponse.CreateSuccess(
            available ? "update_available" : "up_to_date",
            current,
            latest,
            false,
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
        if (CompareVersions(latestVersion, current) <= 0)
            return NativeResponse.CreateSuccess("up_to_date", current, latestVersion, false, $"OSMINOG {current} is current.");

        if (!string.Equals(latest.Kind, "fileset", StringComparison.Ordinal))
            throw new InvalidDataException($"Unsupported release kind: {latest.Kind}");
        AssertReleaseUrl(latest.Url);
        var filesetBytes = await DownloadBytesAsync(latest.Url!);
        VerifySizeAndHash(filesetBytes, latest.Size, latest.Sha256, "fileset");
        var fileset = JsonSerializer.Deserialize<FileSet>(filesetBytes, JsonOptions) ?? throw new InvalidDataException("Fileset is invalid.");
        if (!string.Equals(fileset.Schema, "briefcraft-fileset/v1", StringComparison.Ordinal)) throw new InvalidDataException("Unsupported fileset schema.");
        if (!string.Equals(fileset.Version, latestVersion, StringComparison.Ordinal)) throw new InvalidDataException("Fileset version does not match the feed.");
        if (!string.Equals(fileset.BaseVersion, current, StringComparison.Ordinal))
            throw new InvalidDataException($"Release base mismatch. Installed {current}; required {fileset.BaseVersion}.");

        Directory.CreateDirectory(config.VersionsDir!);
        Directory.CreateDirectory(config.WorkDir!);
        var stage = Path.Combine(config.WorkDir!, "stage-" + Guid.NewGuid().ToString("N"));
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
                var relative = entry.ValueKind == JsonValueKind.String
                    ? entry.GetString()
                    : entry.ValueKind == JsonValueKind.Object && entry.TryGetProperty("path", out var pathElement)
                        ? pathElement.GetString()
                        : null;
                if (string.IsNullOrWhiteSpace(relative)) continue;
                var target = SafeChildPath(stage, relative!);
                if (File.Exists(target)) File.Delete(target);
                else if (Directory.Exists(target)) Directory.Delete(target, true);
            }

            var stagedManifest = ReadManifest(stage);
            if (!string.Equals(stagedManifest.Version, latestVersion, StringComparison.Ordinal))
                throw new InvalidDataException($"Staged manifest version is {stagedManifest.Version}; expected {latestVersion}.");
            if (!string.IsNullOrWhiteSpace(config.ManifestKey) && !string.Equals(config.ManifestKey, stagedManifest.Key, StringComparison.Ordinal))
                throw new InvalidDataException("The release changed the fixed extension key.");

            var backup = Path.Combine(config.VersionsDir!, $"{current}-before-{latestVersion}-{DateTime.Now:yyyyMMdd-HHmmss}");
            Directory.Move(config.InstallDir, backup);
            try
            {
                Directory.Move(stage, config.InstallDir);
            }
            catch
            {
                if (!Directory.Exists(config.InstallDir) && Directory.Exists(backup)) Directory.Move(backup, config.InstallDir);
                throw;
            }

            PruneBackups(config.VersionsDir!, config.MaxBackups);
            Log($"UPDATED {current} -> {latestVersion}");
            return NativeResponse.CreateSuccess("updated", latestVersion, latestVersion, true, $"OSMINOG updated from {current} to {latestVersion}.");
        }
        finally
        {
            if (Directory.Exists(stage)) TryDeleteDirectory(stage);
        }
    }

    private static NativeResponse Rollback(UpdaterConfig config)
    {
        var current = ReadInstalledVersion(config.InstallDir);
        if (!Directory.Exists(config.VersionsDir)) return NativeResponse.CreateError("NO_BACKUP", "No rollback build is available.", current);
        var candidate = new DirectoryInfo(config.VersionsDir!)
            .EnumerateDirectories()
            .Where(d => File.Exists(Path.Combine(d.FullName, "manifest.json")))
            .OrderByDescending(d => d.LastWriteTimeUtc)
            .FirstOrDefault();
        if (candidate is null) return NativeResponse.CreateError("NO_BACKUP", "No rollback build is available.", current);
        var rollbackVersion = ReadInstalledVersion(candidate.FullName);
        var hold = Path.Combine(config.WorkDir!, "rollback-current-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(config.WorkDir!);
        Directory.Move(config.InstallDir, hold);
        try
        {
            Directory.Move(candidate.FullName, config.InstallDir);
            TryDeleteDirectory(hold);
            return NativeResponse.CreateSuccess("rolled_back", rollbackVersion, rollbackVersion, true, $"OSMINOG rolled back from {current} to {rollbackVersion}.");
        }
        catch
        {
            if (!Directory.Exists(config.InstallDir) && Directory.Exists(hold)) Directory.Move(hold, config.InstallDir);
            throw;
        }
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
        if (content.IndexOf(search, index + search.Length, StringComparison.Ordinal) >= 0)
            throw new InvalidDataException($"Patch search text is ambiguous in {patch.Path}.");
        var updated = content[..index] + (patch.Replace ?? string.Empty) + content[(index + search.Length)..];
        File.WriteAllText(target, updated, new UTF8Encoding(false));
        VerifyFileHash(target, patch.AfterSha256, "Patch result hash mismatch");
    }

    private static void ValidateFeed(UpdateFeed feed)
    {
        if (!string.Equals(feed.Schema, "briefcraft-update-feed/v1", StringComparison.Ordinal)) throw new InvalidDataException("Unsupported update feed schema.");
        if (feed.Latest is null) throw new InvalidDataException("The update feed has no latest release.");
    }

    private static ManifestInfo ReadManifest(string dir)
    {
        var path = Path.Combine(dir, "manifest.json");
        return JsonSerializer.Deserialize<ManifestInfo>(File.ReadAllText(path, Encoding.UTF8), JsonOptions)
               ?? throw new InvalidDataException("manifest.json is invalid.");
    }

    private static string ReadInstalledVersion(string dir) => ReadManifest(dir).Version ?? string.Empty;

    private static async Task<T> DownloadJsonAsync<T>(string url)
    {
        var bytes = await DownloadBytesAsync(url);
        return JsonSerializer.Deserialize<T>(bytes, JsonOptions) ?? throw new InvalidDataException("Downloaded JSON is invalid.");
    }

    private static async Task<byte[]> DownloadBytesAsync(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps) throw new InvalidDataException("Only HTTPS downloads are allowed.");
        using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(45) };
        client.DefaultRequestHeaders.UserAgent.ParseAdd($"OSMINOG-Updater/{HostVersion}");
        return await client.GetByteArrayAsync(uri);
    }

    private static void AssertReleaseUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url) || !url.StartsWith(AllowedReleasePrefix, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException($"Release URL is outside the approved feed: {url}");
    }

    private static void VerifySizeAndHash(byte[] bytes, long size, string? expectedHash, string label)
    {
        if (size > 0 && bytes.LongLength != size) throw new InvalidDataException($"{label} size mismatch. Expected {size}; received {bytes.LongLength}.");
        if (!string.IsNullOrWhiteSpace(expectedHash))
        {
            var actual = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
            if (!actual.Equals(expectedHash, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException($"{label} SHA-256 mismatch. Expected {expectedHash}; received {actual}.");
        }
    }

    private static void VerifyFileHash(string path, string? expectedHash, string prefix)
    {
        if (string.IsNullOrWhiteSpace(expectedHash)) return;
        using var stream = File.OpenRead(path);
        var actual = Convert.ToHexString(SHA256.HashData(stream)).ToLowerInvariant();
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
        foreach (var directory in Directory.EnumerateDirectories(source, "*", SearchOption.AllDirectories))
            Directory.CreateDirectory(Path.Combine(destination, Path.GetRelativePath(source, directory)));
        foreach (var file in Directory.EnumerateFiles(source, "*", SearchOption.AllDirectories))
        {
            var target = Path.Combine(destination, Path.GetRelativePath(source, file));
            Directory.CreateDirectory(Path.GetDirectoryName(target)!);
            File.Copy(file, target, true);
        }
    }

    private static void PruneBackups(string versionsDir, int maxBackups)
    {
        foreach (var old in new DirectoryInfo(versionsDir).EnumerateDirectories().OrderByDescending(d => d.LastWriteTimeUtc).Skip(maxBackups)) TryDeleteDirectory(old.FullName);
    }

    private static void TryDeleteDirectory(string path)
    {
        try { Directory.Delete(path, true); } catch { }
    }

    private static int CompareVersions(string a, string b)
    {
        static int[] Parts(string value) => value.TrimStart('v', 'V').Split('.').Select(part => int.TryParse(part, out var number) ? number : 0).ToArray();
        var left = Parts(a); var right = Parts(b);
        for (var i = 0; i < Math.Max(left.Length, right.Length); i++)
        {
            var diff = (i < left.Length ? left[i] : 0).CompareTo(i < right.Length ? right[i] : 0);
            if (diff != 0) return diff;
        }
        return 0;
    }

    private static async Task<bool> ReadExactOrEofAsync(Stream stream, byte[] buffer, int count)
    {
        var offset = 0;
        while (offset < count)
        {
            var read = await stream.ReadAsync(buffer.AsMemory(offset, count - offset));
            if (read == 0) return offset == 0 ? false : throw new EndOfStreamException("Unexpected end of native message header.");
            offset += read;
        }
        return true;
    }

    private static async Task ReadExactAsync(Stream stream, byte[] buffer, int count)
    {
        var offset = 0;
        while (offset < count)
        {
            var read = await stream.ReadAsync(buffer.AsMemory(offset, count - offset));
            if (read == 0) throw new EndOfStreamException("Unexpected end of native message body.");
            offset += read;
        }
    }

    private static async Task WriteFrameAsync(Stream stream, NativeResponse response)
    {
        var payload = JsonSerializer.SerializeToUtf8Bytes(response, JsonOptions);
        var header = BitConverter.GetBytes(payload.Length);
        await stream.WriteAsync(header);
        await stream.WriteAsync(payload);
        await stream.FlushAsync();
    }

    private static void Log(string message)
    {
        try { File.AppendAllText(LogPath, DateTime.UtcNow.ToString("O") + " " + message + Environment.NewLine, new UTF8Encoding(false)); } catch { }
    }
}

internal sealed class NativeRequest
{
    public string? Action { get; set; }
    public string? Command { get; set; }
    public string? Operation { get; set; }
    public string? CurrentVersion { get; set; }
    public string? Channel { get; set; }
}

internal sealed class NativeResponse
{
    public bool Ok { get; init; }
    public bool Success { get; init; }
    public bool Updated { get; init; }
    public string Status { get; init; } = "error";
    public string Result { get; init; } = "error";
    public string Code { get; init; } = "ERROR";
    public string? ErrorCode { get; init; }
    public string? Error { get; init; }
    public string Message { get; init; } = string.Empty;
    public string CurrentVersion { get; init; } = string.Empty;
    public string LatestVersion { get; init; } = string.Empty;
    public string Version { get; init; } = string.Empty;
    public bool Reload { get; init; }
    public bool ReloadRequired { get; init; }
    public bool RestartRequired { get; init; }

    public static NativeResponse CreateSuccess(string status, string current, string latest, bool updated, string message) => new()
    {
        Ok = true, Success = true, Updated = updated, Status = status, Result = status,
        Code = updated ? "UPDATED" : status.ToUpperInvariant(), Message = message,
        CurrentVersion = current, LatestVersion = latest, Version = latest,
        Reload = updated, ReloadRequired = updated, RestartRequired = false
    };

    public static NativeResponse CreateError(string code, string message, string current = "") => new()
    {
        Ok = false, Success = false, Updated = false, Status = "error", Result = "error",
        Code = code, ErrorCode = code, Error = message, Message = message,
        CurrentVersion = current, LatestVersion = current, Version = current
    };
}

internal sealed class UpdaterConfig
{
    public string InstallDir { get; set; } = string.Empty;
    public string FeedUrl { get; set; } = string.Empty;
    public string? VersionsDir { get; set; }
    public string? WorkDir { get; set; }
    public int MaxBackups { get; set; } = 8;
    public string? ExtensionId { get; set; }
    public string? ManifestKey { get; set; }
}

internal sealed class UpdateFeed
{
    public string? Schema { get; set; }
    public ReleaseInfo? Latest { get; set; }
}

internal sealed class ReleaseInfo
{
    public string? Version { get; set; }
    public string? Kind { get; set; }
    public string? Url { get; set; }
    public string? Sha256 { get; set; }
    public long Size { get; set; }
}

internal sealed class FileSet
{
    public string? Schema { get; set; }
    public string? Version { get; set; }
    public string? BaseVersion { get; set; }
    public List<FileEntry>? Files { get; set; }
    public List<PatchEntry>? Patches { get; set; }
    public List<JsonElement>? Delete { get; set; }
}

internal sealed class FileEntry
{
    public string? Path { get; set; }
    public string? Url { get; set; }
    public string? Sha256 { get; set; }
    public long Size { get; set; }
}

internal sealed class PatchEntry
{
    public string? Path { get; set; }
    public string? Search { get; set; }
    public string? Replace { get; set; }
    public string? BeforeSha256 { get; set; }
    public string? AfterSha256 { get; set; }
}

internal sealed class ManifestInfo
{
    public string? Version { get; set; }
    public string? Key { get; set; }
}
