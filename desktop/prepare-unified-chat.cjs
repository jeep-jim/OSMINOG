'use strict';
// Native-only compatibility for the retired Team API. Keep Chrome's shared
// source unchanged and fail the build if its integration contract moves.
function appendTeamMessage(message = {}) {
  const pid = projectId(), epoch = historyEpoch('main', pid);
  const current = () => {
    if (projectId() !== pid || (message.projectId && message.projectId !== pid)) throw Error('Project changed');
    if (historyEpoch('main', pid) !== epoch || clearingChats.has(scopeKey('main', pid))) throw Error('Chat history cleared');
  };
  current();
  const text = String(message.text || '').trim();
  if (!text) return Promise.reject(Error('Message is empty'));
  const role = message.kind === 'user' ? 'user' : 'assistant';
  const task = teamMessageSerial.then(async () => {
    await globalThis.OSMINOGStateReady;
    current();
    if (loadedChatProject !== pid) { await loadThreads(); current(); await loadChat(); current(); }
    const key = `briefCraftGptLiteChat:${pid}:main`;
    const before = await chrome.storage.local.get(key); current();
    const ids = new Set((Array.isArray(before[key]) ? before[key] : []).map(m => m.id));
    await addToThread('main', role, text, message.attachments || [], {
      author: message.name || 'OSMINOG', provider: message.provider || '', color: message.color || '', source: 'team'
    });
    current();
    const after = await chrome.storage.local.get(key); current();
    const saved = (Array.isArray(after[key]) ? after[key] : []).find(m =>
      m.id && !ids.has(m.id) && m.source === 'team' && m.role === role && m.text === text && m.author === (message.name || 'OSMINOG'));
    if (!saved) throw Error('Message persistence was not confirmed');
    if (activeThreadId === 'main' && role === 'user') scrollChatBottom(true);
    return {ok: true, messageId: saved.id, projectId: pid};
  });
  teamMessageSerial = task.catch(() => {});
  return task;
}
function prepareUnifiedChat(source) {
  const event = /^  document\.addEventListener\("osminog:team-message",event=>\{[^\n]+\}\);$/m;
  const append = 'append:(m={})=>document.dispatchEvent(new CustomEvent("osminog:team-message",{detail:m}))';
  if (!event.test(source) || !source.includes(append)) throw Error('Unified chat integration contract changed');
  return source.replace(event, appendTeamMessage.toString() + '\n  document.addEventListener("osminog:team-message",event=>{appendTeamMessage(event.detail||{}).catch(error=>activity(error.message,true))});')
    .replace(append, 'append:appendTeamMessage');
}
module.exports = {prepareUnifiedChat, appendTeamMessage};
