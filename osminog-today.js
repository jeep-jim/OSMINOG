// Used only to seed older installations before the compact daily counter exists.
async function osminogInitialTodayCount(day){
  const storage=chrome.storage.local, ids=new Set();
  const workspace=(await storage.get('briefCraftStudioV2')).briefCraftStudioV2;
  const isToday=at=>new Date(at).toLocaleDateString('en-CA')===day;
  for(const p of workspace?.projects||[])for(const o of p.objects||[]){
    if(o.captureId&&isToday(o.capturedAt))ids.add(o.captureId);
  }
  const keys=(await storage.getKeys()).filter(key=>key.startsWith('osminogCapture:'));
  for(const item of Object.values(await storage.get(keys)))if(item&&isToday(item.at))ids.add(item.id);
  return ids.size;
}
