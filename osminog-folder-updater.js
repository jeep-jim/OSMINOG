"use strict";
(() => {
  if (globalThis.OSMINOGFolderUpdater) return;
  const VERSION = "2.0.0";
  const DB_NAME = "osminog-managed-folder-updater-v1", DB_VERSION = 2;
  const STORE = "state", BACKUPS = "backupFiles", JOURNAL = "installJournalV2", LAST_BACKUP = "lastBackupV2";
  const LOCK = "osminog-managed-folder-install-v2", REGISTRY_REPO = "jeep-jim/OSMINOG-Releases";
  const PENDING_FILE = ".osminog-update.pending.json";
  const CHANNEL_PATH = "channels/dev/chrome-extension.json";
  const FEED_SOURCES = [
    {id: "github-api", url: `https://api.github.com/repos/${REGISTRY_REPO}/contents/${CHANNEL_PATH}?ref=main`, kind: "github-content"},
    {id: "github-raw", url: `https://raw.githubusercontent.com/${REGISTRY_REPO}/main/${CHANNEL_PATH}`, kind: "json"},
    {id: "jsdelivr", url: `https://cdn.jsdelivr.net/gh/${REGISTRY_REPO}@main/${CHANNEL_PATH}`, kind: "json"}
  ];
  const PUBLIC_KEY_B64 = "koq4dSGl1Rd8GGTE+PCEWtVTkGzycGhinv9zACLl7lg=";
  const MiB = 1024 * 1024;
  // Allocation limits, not progress estimates. The updater never enumerates a directory tree.
  const LIMITS = Object.freeze({packageBytes: 32 * MiB, fileBytes: 16 * MiB, totalBytes: 128 * MiB,
    backupBytes: 128 * MiB, entries: 2048, pathBytes: 768, feedBytes: MiB, manifestBytes: 256 * 1024,
    feedTimeoutMs: 10000, packageTimeoutMs: 60000});
  const decoder = new TextDecoder("utf-8", {fatal: true}), encoder = new TextEncoder();
  let mutationActive = false;

  function failure(code, message) { const error = new Error(message); error.code = code; return error; }
  function status(cb, stage, message, progress = 0) { try { cb?.({stage, message, progress}); } catch {} }
  const record = (stage, details = {}) => dbPut("lastOperationV2", {at: Date.now(), stage, updaterVersion: VERSION, ...details});
  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION); let failed = false;
      request.onupgradeneeded = () => {
        for (const name of [STORE, BACKUPS]) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name);
      };
      request.onsuccess = () => { if (failed) request.result.close(); else resolve(request.result); };
      request.onerror = () => { failed = true; reject(request.error); };
      request.onblocked = () => { failed = true; reject(failure("DATABASE_BLOCKED", "Закройте другие окна обновления Осьминога и повторите.")); };
    });
  }
  async function transaction(storeName, mode, action) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode); let result;
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onabort = tx.onerror = () => { db.close(); reject(tx.error || failure("DATABASE_ERROR", "Не удалось сохранить состояние обновления.")); };
      try { action(tx.objectStore(storeName), value => { result = value; }); }
      catch (error) { try { tx.abort(); } catch {} db.close(); reject(error); }
    });
  }
  const dbGet = (key, storeName = STORE) => transaction(storeName, "readonly", (store, done) => {
    const request = store.get(key); request.onsuccess = () => done(request.result);
  });
  const dbPut = (key, value, storeName = STORE) => transaction(storeName, "readwrite", store => store.put(value, key));
  const dbDelete = (key, storeName = STORE) => transaction(storeName, "readwrite", store => store.delete(key));
  const stateChange = (puts = {}, deletes = []) => transaction(STORE, "readwrite", store => {
    for (const [key, value] of Object.entries(puts)) store.put(value, key);
    for (const key of deletes) store.delete(key);
  });
  async function exclusively(action) {
    if (mutationActive) throw failure("UPDATE_BUSY", "Обновление уже выполняется. Дождитесь его завершения.");
    mutationActive = true;
    try {
      if (!globalThis.navigator?.locks?.request) throw failure("LOCK_UNAVAILABLE", "Браузер не поддерживает безопасную блокировку обновления. Установка не начата.");
      return await navigator.locks.request(LOCK, {mode: "exclusive", ifAvailable: true}, async lock => {
        if (!lock) throw failure("UPDATE_BUSY", "Обновление уже выполняется в другом окне Осьминога.");
        return action();
      });
    } finally { mutationActive = false; }
  }
  async function withFolderLock(dir, action) {
    let writer;
    try {
      const handle = await dir.getFileHandle(".osminog-update.lock", {create: true});
      // Native exclusive writer also coordinates the extension and the recovery HTML's different origin.
      writer = await handle.createWritable({mode: "exclusive"});
    } catch (error) {
      if (error.name === "NoModificationAllowedError") throw failure("UPDATE_BUSY", "Эту папку уже обновляет другое окно Осьминога.");
      throw error;
    }
    try { return await action(); }
    finally { await writer.abort().catch(() => {}); }
  }
  async function permission(handle, prompt) {
    if (!handle) return false;
    if (await handle.queryPermission({mode: "readwrite"}) === "granted") return true;
    return prompt && await handle.requestPermission({mode: "readwrite"}) === "granted";
  }
  async function readFile(dir, path) {
    const parts = path.split("/"), name = parts.pop();
    try {
      for (const part of parts) dir = await dir.getDirectoryHandle(part);
      const handle = await dir.getFileHandle(name);
      return {handle, file: await handle.getFile(), dir, name};
    } catch (error) { if (error.name === "NotFoundError") return null; throw error; }
  }
  async function fileBytes(file, limit = LIMITS.fileBytes) {
    if (!Number.isSafeInteger(file.size) || file.size < 0 || file.size > limit) throw failure("FILE_TOO_LARGE", "Файл программы превышает безопасный размер. Установка остановлена.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength !== file.size) throw failure("FILE_CHANGED", "Файл изменился во время чтения. Установка остановлена.");
    return bytes;
  }
  async function readJsonFile(dir, path) {
    const found = await readFile(dir, path);
    if (!found) throw failure("FILE_MISSING", "В выбранной папке нет корневого manifest.json.");
    return JSON.parse(decoder.decode(await fileBytes(found.file, LIMITS.manifestBytes)));
  }
  function validateIdentity(manifest, version) {
    const running = chrome.runtime.getManifest();
    if (manifest.name !== "OSMINOG" || !manifest.key || manifest.key !== running.key) throw failure("IDENTITY_MISMATCH", "Имя или постоянный ключ расширения не совпадают. Установка запрещена.");
    if (manifest.manifest_version !== 3 || (version && manifest.version !== version)) throw failure("MANIFEST_MISMATCH", "manifest.json не совпадает с проверяемой версией Осьминога.");
    return manifest;
  }
  async function validateManagedFolder(dir) { return validateIdentity(await readJsonFile(dir, "manifest.json")); }
  async function readPendingMarker(dir) {
    const found = await readFile(dir, PENDING_FILE); if (!found) return null;
    let marker;
    try { marker = JSON.parse(decoder.decode(await fileBytes(found.file, 2048))); }
    catch { throw failure("PENDING_INVALID", "Не удалось прочитать запись прерванного обновления. Установка остановлена."); }
    if (marker?.schema !== "osminog-folder-pending/v2" || !/^[a-f\d-]{36}$/i.test(marker.id || "") || !/^[a-f\d]{64}$/i.test(marker.identity || "")) {
      throw failure("PENDING_INVALID", "Запись прерванного обновления повреждена. Установка остановлена.");
    }
    return marker;
  }
  async function removePendingMarker(dir) {
    try { await dir.removeEntry(PENDING_FILE); } catch (error) { if (error.name !== "NotFoundError") throw error; }
  }
  async function inspectPendingMarker(dir, cleanup = false) {
    const marker = await readPendingMarker(dir); if (!marker) return null;
    const identity = await sha256(encoder.encode(chrome.runtime.getManifest().key));
    if (marker.identity !== identity) throw failure("IDENTITY_MISMATCH", "Ключ прерванного обновления не совпадает с Осьминогом.");
    const [journal, installed, operation] = await Promise.all([dbGet(JOURNAL), dbGet("lastInstall"), dbGet("lastOperationV2")]);
    if (journal?.id === marker.id && journal.identity === identity) {
      validateJournal(journal); await assertJournalDirectory(dir, journal); return marker;
    }
    const completed = installed?.schema === "osminog-folder-commit/v2" && installed.id === marker.id ? installed :
      operation?.stage === "recovered" && operation.id === marker.id && operation.identity === identity ? operation : null;
    if (completed && typeof completed.directoryHandle?.isSameEntry === "function" && await completed.directoryHandle.isSameEntry(dir)) {
      if (cleanup) await removePendingMarker(dir); return null;
    }
    throw failure("FOREIGN_UPDATE_PENDING", "В этой папке осталось прерванное обновление из другого окна или профиля. Откройте исходный Осьминог или тот же файл помощника и завершите восстановление там.");
  }
  async function writePendingMarker(dir, journal) {
    const marker = {schema: "osminog-folder-pending/v2", id: journal.id, identity: journal.identity};
    await writeEntry(dir, {path: PENDING_FILE}, encoder.encode(JSON.stringify(marker)), null);
    const written = await readPendingMarker(dir);
    if (written?.id !== marker.id || written.identity !== marker.identity) throw failure("PENDING_INVALID", "Не удалось сохранить запись восстановления. Установка остановлена.");
  }
  async function getManagedFolder({prompt = true} = {}) {
    const pending = await dbGet(JOURNAL); let handle = await dbGet("directoryHandle");
    if (handle && await permission(handle, prompt)) {
      await inspectPendingMarker(handle);
      if (pending) {
        validateJournal(pending);
        await assertJournalDirectory(handle, pending);
        if (pending.identity !== await sha256(encoder.encode(chrome.runtime.getManifest().key))) throw failure("IDENTITY_MISMATCH", "Ключ журнала восстановления не совпадает с Осьминогом.");
        // The original manifest itself may need recovery. Use the journal's already-authorized handle.
      } else await validateManagedFolder(handle);
      return handle;
    }
    if (!prompt) return null;
    if (pending) throw failure("RECOVERY_PERMISSION", "Для восстановления нужен доступ к ранее выбранной папке Осьминога.");
    if (typeof showDirectoryPicker !== "function") throw failure("PICKER_UNAVAILABLE", "Этот браузер не поддерживает выбор папки установленного Осьминога.");
    handle = await showDirectoryPicker({id: "osminog-extension-root", mode: "readwrite"});
    if (!await permission(handle, true)) throw failure("FOLDER_PERMISSION", "Осьминог не получил доступ к выбранной папке.");
    await inspectPendingMarker(handle);
    await validateManagedFolder(handle); await dbPut("directoryHandle", handle); return handle;
  }
  function compareVersions(a, b) {
    const A = String(a || "").replace(/^v/i, "").split(".").map(n => parseInt(n, 10) || 0), B = String(b || "").replace(/^v/i, "").split(".").map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(A.length, B.length); i++) { const diff = (A[i] || 0) - (B[i] || 0); if (diff) return diff > 0 ? 1 : -1; }
    return 0;
  }
  const validVersion = value => /^\d+(?:\.\d+){0,3}$/.test(String(value)) && String(value).split(".").every(n => Number(n) <= 65535);
  async function sha256(bytes) { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(b => b.toString(16).padStart(2, "0")).join(""); }
  const b64bytes = value => Uint8Array.from(atob(String(value || "").replace(/\s/g, "")), c => c.charCodeAt(0));
  function canonical(value) {
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
    return JSON.stringify(value);
  }
  async function verifyEnvelope(envelope) {
    if (envelope?.schema !== "osminog-update-feed-envelope/v1" || !envelope.signed) throw failure("FEED_FORMAT", "Неверный формат канала обновлений.");
    if (!envelope.signature) return {verified: false, bootstrap: true};
    if (envelope.signature.algorithm !== "ed25519") throw failure("FEED_SIGNATURE", "Неподдерживаемая подпись канала.");
    const key = await crypto.subtle.importKey("raw", b64bytes(PUBLIC_KEY_B64), {name: "Ed25519"}, false, ["verify"]);
    if (!await crypto.subtle.verify({name: "Ed25519"}, key, b64bytes(envelope.signature.value), encoder.encode(canonical(envelope.signed)))) throw failure("FEED_SIGNATURE", "Подпись канала обновлений не прошла проверку.");
    return {verified: true, bootstrap: false};
  }
  async function normalizeFeed(payload, source) {
    const direct = payload?.schema === "osminog-update-feed/v2", envelope = direct ? {schema: "osminog-update-feed-envelope/v1", signed: payload, signature: null} : payload;
    const verification = await verifyEnvelope(envelope), feed = envelope.signed;
    if (feed.product !== "OSMINOG" || feed.platform !== "chrome-extension") throw failure("FEED_PRODUCT", "Канал предназначен для другого продукта.");
    return {envelope, feed, verification, source};
  }
  async function fetchBytes(url, {headers = {}, limit, timeout} = {}) {
    const controller = new AbortController(); let timer;
    const expired = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(failure("NETWORK_TIMEOUT", "Истекло время ожидания загрузки.")); }, timeout); });
    const download = (async () => {
      const response = await fetch(url, {cache: "no-store", headers, signal: controller.signal});
      if (!response.ok) throw failure("NETWORK_HTTP", `Сервер обновлений вернул HTTP ${response.status}.`);
      if (Number(response.headers.get("content-length")) > limit) throw failure("DOWNLOAD_LIMIT", "Загрузка превышает безопасный размер.");
      if (!response.body?.getReader) throw failure("STREAM_UNAVAILABLE", "Браузер не поддерживает безопасную потоковую загрузку.");
      const reader = response.body.getReader(), chunks = []; let total = 0;
      try {
        while (true) { const {done, value} = await reader.read(); if (done) break; total += value.byteLength;
          if (total > limit) throw failure("DOWNLOAD_LIMIT", "Загрузка превышает безопасный размер."); chunks.push(value); }
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      const bytes = new Uint8Array(total); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return bytes;
    })();
    try { return await Promise.race([download, expired]); }
    finally { clearTimeout(timer); controller.abort(); }
  }
  async function loadFeedSource(source) {
    const url = `${source.url}${source.url.includes("?") ? "&" : "?"}t=${Date.now()}`;
    const bytes = await fetchBytes(url, {headers: source.kind === "github-content" ? {Accept: "application/vnd.github+json"} : {}, limit: LIMITS.feedBytes, timeout: LIMITS.feedTimeoutMs});
    let payload = JSON.parse(decoder.decode(bytes));
    if (source.kind === "github-content") { if (!payload?.content) throw failure("FEED_FORMAT", "GitHub API не вернул содержимое канала."); payload = JSON.parse(decoder.decode(b64bytes(payload.content))); }
    return normalizeFeed(payload, source.id);
  }
  async function fetchFeed() {
    const results = await Promise.allSettled(FEED_SOURCES.map(loadFeedSource)), good = [], errors = [];
    results.forEach((result, i) => { if (result.status === "fulfilled") good.push(result.value); else errors.push(`${FEED_SOURCES[i].id}: ${result.reason?.message || "ошибка загрузки"}`); });
    if (!good.length) throw failure("FEED_UNAVAILABLE", `Не удалось проверить канал обновлений. ${errors.join(" · ")}`);
    good.sort((a, b) => compareVersions(b.feed?.latest?.version, a.feed?.latest?.version));
    return {...good[0], sources: good.map(item => ({source: item.source, version: item.feed?.latest?.version || ""})), errors};
  }
  async function check() {
    const current = chrome.runtime.getManifest().version, {feed, verification, source, sources, errors} = await fetchFeed();
    if (feed.status !== "active" || !feed.latest) return {ok: true, currentVersion: current, latestVersion: current, available: false, message: "В dev-канале пока нет опубликованной сборки.", verification, source, sources, errors};
    const latest = feed.latest, available = compareVersions(latest.version, current) > 0;
    return {ok: true, currentVersion: current, latestVersion: latest.version, available, latest, verification, source, sources, errors, message: available ? `Доступна OSMINOG ${latest.version}` : `OSMINOG ${current} актуальна`};
  }
  function releasePackageCandidates(latest) {
    const out = [String(latest?.packageUrl || "")], version = String(latest?.version || ""), name = decodeURIComponent(new URL(out[0]).pathname.split("/").pop() || "");
    if (version && name) {
      out.push(`https://raw.githubusercontent.com/${REGISTRY_REPO}/main/platforms/chrome-extension/releases/${encodeURIComponent(version)}/${encodeURIComponent(name)}`);
      out.push(`https://cdn.jsdelivr.net/gh/${REGISTRY_REPO}@main/platforms/chrome-extension/releases/${encodeURIComponent(version)}/${encodeURIComponent(name)}`);
    }
    return [...new Set(out.filter(Boolean))];
  }
  function validateRelease(latest) {
    if (!validVersion(latest.version) || !/^[a-f\d]{64}$/i.test(latest.sha256 || "") || !Number.isSafeInteger(latest.size) || latest.size < 22 || latest.size > LIMITS.packageBytes) throw failure("PACKAGE_METADATA", "Размер, версия или SHA-256 пакета обновления некорректны.");
    const url = new URL(latest.packageUrl);
    if (url.protocol !== "https:" || url.username || url.password) throw failure("PACKAGE_URL", "Некорректный адрес пакета обновления.");
    if (latest.minUpdaterVersion && (!validVersion(latest.minUpdaterVersion) || compareVersions(VERSION, latest.minUpdaterVersion) < 0)) throw failure("UPDATER_VERSION", `Для этой сборки требуется updater ${latest.minUpdaterVersion}.`);
  }
  async function downloadPackage(latest, cb) {
    validateRelease(latest); const errors = [];
    for (const url of releasePackageCandidates(latest)) {
      try {
        cb?.(url);
        const bytes = await fetchBytes(`${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`, {limit: latest.size, timeout: LIMITS.packageTimeoutMs});
        if (bytes.byteLength !== latest.size) throw failure("PACKAGE_SIZE", "Размер загруженного пакета не совпал с каналом.");
        const digest = await sha256(bytes);
        if (digest.toLowerCase() !== latest.sha256.toLowerCase()) throw failure("PACKAGE_HASH", "SHA-256 пакета не совпал с каналом.");
        return {bytes, packageSha: digest};
      } catch (error) { errors.push(`${new URL(url).hostname}: ${error.message}`); }
    }
    throw failure("PACKAGE_UNAVAILABLE", `Не удалось скачать проверенный пакет. ${errors.join(" · ")}`);
  }

  const crcTable = Uint32Array.from({length: 256}, (_, value) => { for (let i = 0; i < 8; i++) value = value & 1 ? 0xedb88320 ^ value >>> 1 : value >>> 1; return value >>> 0; });
  function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ crc >>> 8; return (crc ^ 0xffffffff) >>> 0; }
  function safePath(raw, directory = false) {
    if (!raw || raw.includes("\\") || raw.startsWith("/") || /[\x00-\x1f\x7f<>:"|?*]/.test(raw)) throw failure("ZIP_PATH", "ZIP содержит недопустимый путь.");
    const path = directory ? raw.slice(0, -1) : raw;
    if (encoder.encode(path).length > LIMITS.pathBytes || path.split("/").length > 32) throw failure("ZIP_PATH", "ZIP содержит слишком длинный путь.");
    for (const part of path.split("/")) {
      if (!part || part === "." || part === ".." || /[ .]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part) || [".git", ".osminog", ".briefcraft", "node_modules"].includes(part.toLowerCase()) || /^\.osminog-/i.test(part)) throw failure("ZIP_PATH", "ZIP содержит недопустимый или пользовательский путь.");
    }
    return path;
  }
  function indexZip(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    if (bytes.byteLength < 22 || bytes.byteLength > LIMITS.packageBytes) throw failure("ZIP_SIZE", "ZIP превышает безопасный размер или повреждён.");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), u16 = offset => view.getUint16(offset, true), u32 = offset => view.getUint32(offset, true);
    const invalid = () => failure("ZIP_FORMAT", "ZIP повреждён: неверный каталог или границы файла."); let end = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (u32(i) === 0x06054b50 && i + 22 + u16(i + 20) === bytes.length) { end = i; break; }
    if (end < 0) throw invalid();
    const count = u16(end + 10), centralSize = u32(end + 12), centralOffset = u32(end + 16);
    if (u16(end + 4) || u16(end + 6) || u16(end + 8) !== count || !count || count > LIMITS.entries || centralOffset + centralSize !== end || centralOffset >= end) throw invalid();
    const entries = [], paths = new Map(), ranges = []; let pos = centralOffset, total = 0;
    for (let i = 0; i < count; i++) {
      if (pos + 46 > end || u32(pos) !== 0x02014b50) throw invalid();
      const flags = u16(pos + 8), method = u16(pos + 10), crc = u32(pos + 16), compressedSize = u32(pos + 20), size = u32(pos + 24);
      const nameLength = u16(pos + 28), extra = u16(pos + 30), comment = u16(pos + 32), local = u32(pos + 42), mode = u32(pos + 38) >>> 16;
      if (!nameLength || nameLength > LIMITS.pathBytes || pos + 46 + nameLength + extra + comment > end || u16(pos + 34) || flags & ~0x080e || ![0, 8].includes(method) || size > LIMITS.fileBytes || compressedSize > LIMITS.packageBytes || ![0, 0x8000, 0x4000].includes(mode & 0xf000)) throw invalid();
      const rawName = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLength)), directory = rawName.endsWith("/"), path = safePath(rawName, directory), folded = path.normalize("NFC").toLowerCase();
      if (paths.has(folded)) throw failure("ZIP_DUPLICATE", "ZIP содержит повторяющиеся пути.");
      paths.set(folded, directory ? "directory" : "file");
      if (local + 30 > centralOffset || u32(local) !== 0x04034b50 || u16(local + 6) !== flags || u16(local + 8) !== method) throw invalid();
      const localNameLength = u16(local + 26), localExtra = u16(local + 28), start = local + 30 + localNameLength + localExtra;
      if (start > centralOffset || start + compressedSize > centralOffset || localNameLength !== nameLength || decoder.decode(bytes.subarray(local + 30, local + 30 + localNameLength)) !== rawName) throw invalid();
      let stop = start + compressedSize;
      if (flags & 8) {
        if (stop + 12 > centralOffset) throw invalid(); let descriptor = stop;
        if (u32(descriptor) === 0x08074b50) descriptor += 4;
        if (descriptor + 12 > centralOffset || u32(descriptor) !== crc || u32(descriptor + 4) !== compressedSize || u32(descriptor + 8) !== size) throw invalid(); stop = descriptor + 12;
      } else if (u32(local + 14) !== crc || u32(local + 18) !== compressedSize || u32(local + 22) !== size) throw invalid();
      if (method === 0 && size !== compressedSize || directory && (size || compressedSize || crc)) throw invalid();
      ranges.push([local, stop]);
      if (!directory) { total += size; if (total > LIMITS.totalBytes) throw failure("ZIP_LIMIT", "Распакованный пакет превышает безопасный размер."); entries.push({path, start, compressedSize, size, method, crc}); }
      pos += 46 + nameLength + extra + comment;
    }
    if (pos !== end || !entries.length) throw invalid(); ranges.sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < ranges.length; i++) if (ranges[i][0] < ranges[i - 1][1]) throw invalid();
    for (const path of paths.keys()) { const parts = path.split("/"); parts.pop(); while (parts.length) { if (paths.get(parts.join("/")) === "file") throw failure("ZIP_COLLISION", "ZIP содержит пересекающиеся имена файлов и папок."); parts.pop(); } }
    const manifest = entries.find(entry => entry.path === "manifest.json");
    if (!manifest || manifest.size > LIMITS.manifestBytes) throw failure("ZIP_MANIFEST", "В пакете нет допустимого корневого manifest.json.");
    return {bytes, entries: [...entries.filter(entry => entry !== manifest), manifest], total};
  }
  async function extractEntry(archive, entry) {
    const compressed = archive.bytes.subarray(entry.start, entry.start + entry.compressedSize); let bytes;
    if (entry.method === 0) bytes = compressed;
    else {
      if (typeof DecompressionStream !== "function") throw failure("INFLATE_UNAVAILABLE", "Браузер не поддерживает распаковку ZIP.");
      const reader = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader();
      // Stop a ZIP bomb at the first excess chunk, without accumulating its expanded output.
      bytes = new Uint8Array(entry.size); let offset = 0;
      try { while (true) { const {done, value} = await reader.read(); if (done) break; if (offset + value.length > entry.size) throw failure("ZIP_INFLATE_LIMIT", "Распакованный файл превышает заявленный размер."); bytes.set(value, offset); offset += value.length; }
        if (offset !== entry.size) throw failure("ZIP_ENTRY_SIZE", "Размер распакованного файла не совпал.");
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    }
    if (bytes.byteLength !== entry.size || crc32(bytes) !== entry.crc) throw failure("ZIP_CRC", "Контрольная сумма файла в ZIP не совпала."); return bytes;
  }
  async function validateArchive(archive, version, cb) {
    let manifest;
    for (let i = 0; i < archive.entries.length; i++) {
      const entry = archive.entries[i], bytes = await extractEntry(archive, entry); entry.sha256 = await sha256(bytes);
      if (entry.path === "manifest.json") manifest = validateIdentity(JSON.parse(decoder.decode(bytes)), version);
      status(cb, "verify", `Проверяю файлы ${i + 1}/${archive.entries.length}…`, 20 + Math.round(20 * (i + 1) / archive.entries.length));
    }
    return manifest;
  }

  function validateJournal(journal) {
    const invalid = () => failure("JOURNAL_INVALID", "Журнал обновления повреждён. Файлы не изменены.");
    if (journal?.schema !== "osminog-folder-install/v2" || !Array.isArray(journal.entries) || !journal.entries.length || journal.entries.length > LIMITS.entries ||
        !Number.isInteger(journal.dirtyCount) || journal.dirtyCount < 0 || journal.dirtyCount > journal.entries.length || !validVersion(journal.from) || !validVersion(journal.to) ||
        !/^[a-f\d-]{36}$/i.test(journal.id || "") || !/^[a-f\d]{64}$/i.test(journal.identity || "") || typeof journal.directoryHandle?.isSameEntry !== "function" ||
        !["backing-up", "installing", "rolling-back", "committed"].includes(journal.phase) || !["update", "rollback"].includes(journal.purpose) ||
        !Array.isArray(journal.createdDirectories) || journal.createdDirectories.length > LIMITS.entries * 32 || journal.entries.at(-1)?.path !== "manifest.json") throw invalid();
    const seen = new Set(); let total = 0;
    for (const entry of journal.entries) {
      const path = safePath(entry.path), folded = path.normalize("NFC").toLowerCase(), index = seen.size;
      if (seen.has(folded) || entry.backupKey !== `${journal.id}:${index}` || ![true, false, null].includes(entry.existed) || index < journal.dirtyCount && entry.existed === null) throw invalid();
      if (entry.existed === true) {
        if (!Number.isSafeInteger(entry.size) || entry.size < 0 || entry.size > LIMITS.fileBytes || !/^[a-f\d]{64}$/i.test(entry.sha256 || "")) throw invalid();
        total += entry.size; if (total > LIMITS.backupBytes) throw invalid();
      }
      seen.add(folded);
    }
    const directories = new Set();
    for (const raw of journal.createdDirectories) {
      const path = safePath(raw), folded = path.normalize("NFC").toLowerCase();
      if (directories.has(folded) || !journal.entries.some(entry => entry.path.startsWith(path + "/"))) throw invalid();
      directories.add(folded);
    }
    return journal;
  }
  async function assertJournalDirectory(dir, journal) {
    if (!await journal.directoryHandle.isSameEntry(dir)) throw failure("JOURNAL_FOLDER", "Резервная копия относится к другой папке Осьминога. Файлы не изменены.");
  }
  async function clearBackups(journal) {
    if (!journal?.entries) return;
    await transaction(BACKUPS, "readwrite", store => { for (const entry of journal.entries) store.delete(entry.backupKey); });
  }
  async function writeEntry(root, entry, data, journal) {
    const parts = entry.path.split("/"), name = parts.pop(); let dir = root, prefix = "";
    for (const part of parts) {
      prefix = prefix ? `${prefix}/${part}` : part;
      try { dir = await dir.getDirectoryHandle(part); }
      catch (error) { if (error.name !== "NotFoundError") throw error;
        if (journal && !journal.createdDirectories.includes(prefix)) { journal.createdDirectories.push(prefix); await dbPut(JOURNAL, journal); }
        dir = await dir.getDirectoryHandle(part, {create: true});
      }
    }
    const handle = await dir.getFileHandle(name, {create: true}), writer = await handle.createWritable();
    try { await writer.write(data); await writer.close(); } catch (error) { await writer.abort().catch(() => {}); throw error; }
  }
  async function verifyFile(dir, entry) {
    const found = await readFile(dir, entry.path);
    if (!found || found.file.size !== entry.size || await sha256(await fileBytes(found.file)) !== entry.sha256) throw failure("INSTALLED_HASH", "Проверка записанных файлов программы не пройдена.");
  }
  async function prepareBackup(dir, archive, from, to, packageSha, cb) {
    const previous = await dbGet("lastInstall");
    const previousInstall = previous?.to === from && typeof previous.directoryHandle?.isSameEntry === "function" && await previous.directoryHandle.isSameEntry(dir) ? previous : null;
    const journal = {schema: "osminog-folder-install/v2", id: crypto.randomUUID(), from, to, packageSha,
      identity: await sha256(encoder.encode(chrome.runtime.getManifest().key)), directoryHandle: dir, at: Date.now(), phase: "backing-up", purpose: "update", dirtyCount: 0,
      createdDirectories: [], previousInstall, entries: []};
    journal.entries = archive.entries.map((entry, index) => ({path: entry.path, backupKey: `${journal.id}:${index}`, existed: null, size: 0}));
    await dbPut(JOURNAL, journal); let total = 0;
    for (let i = 0; i < journal.entries.length; i++) {
      const entry = journal.entries[i], found = await readFile(dir, entry.path); entry.existed = !!found;
      if (found) {
        total += found.file.size;
        if (total > LIMITS.backupBytes) throw failure("BACKUP_LIMIT", "Резервная копия файлов программы превышает безопасный размер. Установка не начата.");
        const bytes = await fileBytes(found.file); entry.size = bytes.byteLength; entry.sha256 = await sha256(bytes);
        // Freeze one file's bytes. An FSA File may become stale after its source is replaced.
        await dbPut(entry.backupKey, {blob: new Blob([bytes]), size: entry.size, sha256: entry.sha256}, BACKUPS);
      }
      status(cb, "backup", `Сохраняю файлы программы ${i + 1}/${journal.entries.length}…`, 40 + Math.round(15 * (i + 1) / journal.entries.length));
    }
    journal.phase = "installing"; await dbPut(JOURNAL, journal); return journal;
  }
  async function restoreJournal(dir, journal, cb) {
    validateJournal(journal); await assertJournalDirectory(dir, journal); journal.phase = "rolling-back"; await dbPut(JOURNAL, journal);
    const dirty = journal.entries.slice(0, journal.dirtyCount);
    // Restore code before the manifest, including when recovery itself was interrupted.
    const order = [...dirty.filter(entry => entry.path !== "manifest.json").reverse(), ...dirty.filter(entry => entry.path === "manifest.json")];
    for (let i = 0; i < order.length; i++) {
      const entry = order[i];
      if (entry.existed === true) {
        const stored = await dbGet(entry.backupKey, BACKUPS);
        if (!stored?.blob || stored.size !== entry.size || stored.blob.size !== entry.size) throw failure("BACKUP_MISSING", "Не найдена полная резервная копия. Повторная установка остановлена.");
        const bytes = await fileBytes(stored.blob);
        if (await sha256(bytes) !== entry.sha256) throw failure("BACKUP_HASH", "Проверка резервной копии не пройдена.");
        await writeEntry(dir, entry, bytes, null); await verifyFile(dir, entry);
      } else if (entry.existed === false) { const found = await readFile(dir, entry.path); if (found) await found.dir.removeEntry(found.name); }
      else throw failure("BACKUP_INCOMPLETE", "Резервная копия не завершена. Повторная установка остановлена.");
      status(cb, "rollback", `Восстанавливаю файлы ${i + 1}/${order.length}…`, 5 + Math.round(90 * (i + 1) / Math.max(1, order.length)));
    }
    for (const path of [...(journal.createdDirectories || [])].sort((a, b) => b.split("/").length - a.split("/").length)) {
      const parts = safePath(path).split("/"), name = parts.pop(); let parent = dir;
      try { for (const part of parts) parent = await parent.getDirectoryHandle(part); await parent.removeEntry(name); }
      catch (error) { if (!["NotFoundError", "InvalidModificationError"].includes(error.name)) throw error; }
    }
    validateIdentity(await readJsonFile(dir, "manifest.json"), journal.from);
    const deletes = [JOURNAL], puts = {lastOperationV2: {at: Date.now(), stage: "recovered", updaterVersion: VERSION,
      id: journal.id, identity: journal.identity, directoryHandle: dir, from: journal.to, to: journal.from}};
    if (journal.purpose === "rollback") { deletes.push(LAST_BACKUP); if (journal.previousInstall) puts.lastInstall = journal.previousInstall; else deletes.push("lastInstall"); }
    // Completion proof and journal removal are atomic. A crash before marker removal is safely retried.
    await stateChange(puts, deletes); await removePendingMarker(dir); await clearBackups(journal).catch(() => {});
    return {ok: true, recovered: true, version: journal.from, reloadRequired: chrome.runtime.getManifest().version !== journal.from};
  }
  async function recoverInterrupted(dir, cb) {
    await inspectPendingMarker(dir, true);
    const journal = await dbGet(JOURNAL); if (!journal) return {ok: true, recovered: false};
    validateJournal(journal); status(cb, "rollback", "Восстанавливаю прерванное обновление…", 1); return restoreJournal(dir, journal, cb);
  }
  async function committedInstall(dir, folderVersion) {
    const installed = await dbGet("lastInstall");
    if (installed?.schema !== "osminog-folder-commit/v2" || installed.to !== folderVersion || !Array.isArray(installed.files) || !installed.files.length || installed.files.length > LIMITS.entries ||
        typeof installed.directoryHandle?.isSameEntry !== "function" || !await installed.directoryHandle.isSameEntry(dir)) return null;
    for (const file of installed.files) { safePath(file.path); await verifyFile(dir, file); }
    validateIdentity(await readJsonFile(dir, "manifest.json"), installed.to); return installed;
  }
  async function update(options = {}) {
    return exclusively(async () => {
      const cb = options.onStatus, current = chrome.runtime.getManifest().version;
      status(cb, "folder", "Проверяю папку и состояние обновления…", 2);
      const dir = await getManagedFolder({prompt: true});
      return withFolderLock(dir, async () => {
      await recoverInterrupted(dir, cb);
      const folderManifest = await validateManagedFolder(dir);
      if (folderManifest.version !== current) {
        const installed = compareVersions(folderManifest.version, current) > 0 ? await committedInstall(dir, folderManifest.version) : null;
        if (installed) return {ok: true, updated: true, alreadyInstalled: true, from: current, currentVersion: installed.to, latestVersion: installed.to, transactionId: installed.id};
        throw failure("FOLDER_VERSION", `В папке версия ${folderManifest.version}, запущена ${current}. Перезагрузите только расширение Осьминога; повторная запись не начата.`);
      }
      status(cb, "feed", "Проверяю канал обновлений…", 4);
      const result = options.preflight?.latest ? options.preflight : await check();
      if (!result.available || compareVersions(result.latest?.version, current) <= 0) return {...result, updated: false};
      const latest = result.latest; validateRelease(latest); await record("download", {from: current, to: latest.version});
      const downloaded = await downloadPackage(latest, url => status(cb, "download", `Скачиваю OSMINOG ${latest.version} · ${new URL(url).hostname}…`, 10));
      const archive = indexZip(downloaded.bytes);
      await record("verify", {from: current, to: latest.version, files: archive.entries.length});
      await validateArchive(archive, latest.version, cb); // All entries pass before any installation write.
      const previousBackup = await dbGet(LAST_BACKUP); let committed = false;
      try {
        await record("backup", {from: current, to: latest.version, files: archive.entries.length});
        const journal = await prepareBackup(dir, archive, current, latest.version, downloaded.packageSha, cb);
        await writePendingMarker(dir, journal);
        await record("install", {from: current, to: latest.version, files: archive.entries.length});
        for (let i = 0; i < archive.entries.length; i++) {
          const entry = archive.entries[i], bytes = await extractEntry(archive, entry); journal.dirtyCount = i + 1;
          await dbPut(JOURNAL, journal); // Write intent is durable before file/directory creation or replacement.
          status(cb, entry.path === "manifest.json" ? "manifest" : "install", `Записываю ${i + 1}/${archive.entries.length}…`, 55 + Math.round(42 * (i + 1) / archive.entries.length));
          await writeEntry(dir, entry, bytes, journal); await verifyFile(dir, entry);
        }
        validateIdentity(await readJsonFile(dir, "manifest.json"), latest.version);
        const installed = {schema: "osminog-folder-commit/v2", id: journal.id, directoryHandle: dir, from: current, to: latest.version, at: Date.now(), sha256: downloaded.packageSha,
          files: archive.entries.map(({path, size, sha256: digest}) => ({path, size, sha256: digest}))};
        journal.phase = "committed";
        await stateChange({lastInstall: installed, [LAST_BACKUP]: journal, lastOperationV2: {at: Date.now(), stage: "committed", updaterVersion: VERSION, from: current, to: latest.version}}, [JOURNAL, "lastBackup"]);
        committed = true; await removePendingMarker(dir); await clearBackups(previousBackup).catch(() => {});
        status(cb, "done", `OSMINOG ${latest.version} записана и проверена.`, 100);
        return {ok: true, updated: true, from: current, currentVersion: latest.version, latestVersion: latest.version, transactionId: journal.id, message: `OSMINOG обновлена ${current} → ${latest.version}`};
      } catch (error) {
        if (!committed) { try { await recoverInterrupted(dir, cb); } catch (restoreError) { throw failure("RECOVERY_REQUIRED", `Установка остановлена. Требуется восстановление: ${restoreError.message}`); } }
        await record("failed", {code: error.code || error.name || "Error"}).catch(() => {}); throw error;
      }
      });
    });
  }
  async function rollback(options = {}) {
    return exclusively(async () => {
      const dir = await getManagedFolder({prompt: true});
      return withFolderLock(dir, async () => {
      const recovery = await recoverInterrupted(dir, options.onStatus); if (recovery.recovered) return recovery;
      const backup = await dbGet(LAST_BACKUP); if (!backup) throw failure("NO_BACKUP", "Резервная копия безопасного обновления ещё не создана.");
      validateJournal(backup); await assertJournalDirectory(dir, backup); validateIdentity(await readJsonFile(dir, "manifest.json"), backup.to);
      const journal = {...backup, phase: "rolling-back", purpose: "rollback", dirtyCount: backup.entries.length}; await dbPut(JOURNAL, journal);
      await writePendingMarker(dir, journal);
      const result = await restoreJournal(dir, journal, options.onStatus); status(options.onStatus, "done", `Восстановлена OSMINOG ${result.version}.`, 100); return result;
      });
    });
  }
  async function recover(options = {}) {
    return exclusively(async () => {
      const pending = await dbGet(JOURNAL), dir = await getManagedFolder({prompt: options.prompt === true});
      if (!dir) { if (pending) throw failure("RECOVERY_PERMISSION", "Для восстановления подтвердите доступ к папке Осьминога."); return {ok: true, recovered: false}; }
      return withFolderLock(dir, () => recoverInterrupted(dir, options.onStatus));
    });
  }
  async function diagnostics() {
    const [operation, pending, installed, backup] = await Promise.all([dbGet("lastOperationV2"), dbGet(JOURNAL), dbGet("lastInstall"), dbGet(LAST_BACKUP)]);
    const summary = operation ? Object.fromEntries(Object.entries(operation).filter(([key]) => !["directoryHandle", "identity"].includes(key))) : null;
    return {updaterVersion: VERSION, runningVersion: chrome.runtime.getManifest().version, operation: summary,
      pending: pending ? {from: pending.from, to: pending.to, phase: pending.phase, completed: pending.dirtyCount, files: pending.entries.length} : null,
      installed: installed ? {from: installed.from, to: installed.to, at: installed.at, sha256: installed.sha256} : null, backupAvailable: !!backup};
  }
  globalThis.OSMINOGFolderUpdater = {version: VERSION, check, update, rollback, recover, diagnostics,
    selectFolder: () => exclusively(() => getManagedFolder({prompt: true})),
    forgetFolder: () => exclusively(async () => { if (await dbGet(JOURNAL)) throw failure("RECOVERY_REQUIRED", "Сначала восстановите прерванное обновление в выбранной папке."); await dbDelete("directoryHandle"); }),
    feedUrl: FEED_SOURCES[0].url,
    __test: {LIMITS, indexZip, extractEntry, validateArchive, crc32, sha256, compareVersions, canonical, fetchFeed, fetchBytes, releasePackageCandidates, validateRelease, safePath, recoverInterrupted, committedInstall}
  };
})();
