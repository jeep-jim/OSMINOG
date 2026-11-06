// The index holds only metadata. Keep a permanent ID marker after purge so
// an older folder or cloud snapshot cannot silently re-import that project.
(() => {
  const indexKey = 'osminogTrashIndex', prefix = 'osminogTrashProject:';
  const week = 7 * 24 * 60 * 60 * 1000;
  const storage = chrome.storage.local;
  const read = async () => (await storage.get(indexKey))[indexKey] || {};
  const lock = task => navigator.locks.request(indexKey, task);
  const snapshotKeys = ['briefCraftStudioV2', 'briefCraftStudioV2Backup'];
  async function change(action, id, project) {
    return lock(async () => {
      const index = await read(), entry = index[id], now = Date.now();
      if (action === 'move' && entry) return;
      if (action !== 'move' && !entry?.expires) return;
      const key = prefix + id, update = {};
      if (action === 'restore' && entry.expires <= now) action = 'purge';
      if (action === 'restore') {
        project = (await storage.get(key))[key];
        if (!project) throw Error('Project snapshot is missing');
        delete index[id];
      } else if (action === 'move') {
        index[id] = {name:project.name, expires:now + week};
        update[key] = project;
      } else {
        index[id] = {purged:true};
        update[key] = null;
        const revKey = 'osminogProjectRevisionsV1';
        const revisions = (await storage.get(revKey))[revKey] || {};
        delete revisions[id];
        update[revKey] = revisions;
      }
      const snapshots = await storage.get(snapshotKeys);
      for (const k of snapshotKeys) {
        const workspace = snapshots[k];
        if (!workspace && action !== 'restore') continue;
        const list = (workspace?.projects || []).filter(p => p.id !== id);
        if (action === 'restore') list.unshift(project);
        update[k] = {...workspace, projects:list, activeProject:list.some(p=>p.id===workspace?.activeProject)?workspace.activeProject:list[0]?.id||null};
      }
      update[indexKey] = index;
      await storage.set(update);
      if (action !== 'move') await storage.remove(key);
      return action === 'restore' ? project : null;
    });
  }
  async function sweep() {
    for (const [id, entry] of Object.entries(await read())) {
      if (entry.expires && entry.expires <= Date.now()) await change('purge', id);
    }
  }
  globalThis.OSMINOGTrash = {indexKey, read, change, sweep};
})();
