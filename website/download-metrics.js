/* Optional own-server totals. Missing or stale data never becomes a fabricated zero. */
(() => {
  'use strict';
  const suffixes = { macos: 'mac-arm64.dmg', windows: 'Windows-x64.exe', linux: 'Linux-x64.AppImage' };
  const version = value => typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value) && value.split('.').every(part => Number.isSafeInteger(Number(part)));
  const isDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
  let catalog = null;
  let loading = false;
  let showZero = false;
  try { showZero = new URLSearchParams(window.location.search).get('stats') === '1'; } catch (_) { /* Optional owner view only. */ }

  function validStats(value) {
    if (!value || value.schema !== 1 || value.status !== 'active' || value.metric !== 'qualified_download_starts' ||
        !isDate(value.since) || !isDate(value.updatedAt) || !Array.isArray(value.files) || value.files.length > 1024) return null;
    const updated = Date.parse(value.updatedAt), since = Date.parse(value.since), now = Date.now();
    if (since > updated || updated > now + 300000 || now - updated > 600000) return null;
    const seen = new Set();
    for (const item of value.files) {
      if (!item || !Object.prototype.hasOwnProperty.call(suffixes, item.platform) || !version(item.version) ||
          item.filename !== 'Mouse-Browser-' + item.version + '-' + suffixes[item.platform] ||
          !Number.isSafeInteger(item.count) || item.count < 0 || seen.has(item.filename)) return null;
      seen.add(item.filename);
    }
    return value;
  }

  function update(next) {
    if (next && next.schema === 1 && Array.isArray(next.files)) catalog = next;
    const stats = validStats(window.MOUSE_DOWNLOAD_STATS);
    document.querySelectorAll('[data-download-stats]').forEach(host => {
      const platform = host.dataset.downloadStats;
      const current = catalog?.files.find(item => item.platform === platform);
      const record = stats?.files.find(item => item.filename === current?.filename && item.platform === platform && item.version === current?.version);
      const count = host.querySelector('[data-stats-count]');
      if (!record) {
        host.hidden = true;
        host.open = false;
        count.textContent = '';
        return;
      }
      host.hidden = false;
      // A fresh zero is available in the disclosure; it need not become a popularity badge.
      count.textContent = record.count === 0 && !showZero ? '···' : '· ' + record.count;
      const list = host.querySelector('[data-stats-versions]');
      list.replaceChildren();
      const records = stats.files.filter(item => item.platform === platform).sort((a, b) => {
        const left = a.version.split('.').map(Number), right = b.version.split('.').map(Number);
        for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return right[i] - left[i];
        return 0;
      });
      for (const item of records) {
        const label = document.createElement('dt'), total = document.createElement('dd');
        label.textContent = 'v' + item.version;
        label.dir = 'ltr';
        total.textContent = String(item.count);
        total.dir = 'ltr';
        list.append(label, total);
      }
      const period = host.querySelector('[data-stats-since]');
      period.dateTime = stats.since;
      period.textContent = stats.since.slice(0, 10) + ' — ' + stats.updatedAt.slice(0, 10);
      period.title = stats.updatedAt;
    });
  }

  function refresh() {
    if (loading || document.visibilityState === 'hidden') return;
    loading = true;
    const script = document.createElement('script');
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      script.onload = null;
      script.onerror = null;
      script.remove();
      loading = false;
      update();
    };
    const timeout = setTimeout(finish, 3500);
    script.async = true;
    script.src = '/download-stats.js?v=' + Date.now();
    script.onload = finish;
    script.onerror = finish;
    document.head.appendChild(script);
  }

  window.MouseDownloadStats = Object.freeze({ update });
  document.addEventListener('DOMContentLoaded', () => {
    update();
    setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    document.addEventListener('click', event => {
      document.querySelectorAll('[data-download-stats][open]').forEach(host => {
        if (!host.contains(event.target)) host.open = false;
      });
    });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      document.querySelectorAll('[data-download-stats][open]').forEach(host => {
        host.open = false;
        host.querySelector('summary').focus();
      });
    });
  }, { once: true });
})();
