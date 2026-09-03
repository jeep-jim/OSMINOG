from pathlib import Path
import json

ROOT=Path('.')
def read(p): return (ROOT/p).read_text(encoding='utf-8')
def write(p,s): (ROOT/p).write_text(s,encoding='utf-8')
def once(s,old,new,label):
    n=s.count(old)
    if n!=1: raise SystemExit(f'{label}: expected 1 match, got {n}')
    return s.replace(old,new,1)
def append_once(path,marker,text):
    s=read(path)
    if marker not in s: write(path,s.rstrip()+"\n\n"+text.strip()+"\n")

m=json.loads(read('manifest.json')); assert m['version']=='3.14.4'; m['version']=m['version_name']='3.14.5'; write('manifest.json',json.dumps(m,ensure_ascii=False,indent=2)+'\n')
b=json.loads(read('OSMINOG_BUILD.json')); assert b['version']=='3.14.4'; b.update(version='3.14.5',codename='LEGACY CHAT POLISH',baseVersion='3.14.4',artifact='OSMINOG-Chrome-3.14.5-LEGACY-CHAT-POLISH.zip',manifestVersion='3.14.5',runtimeVerified=False,binaryInGitHub=False,notes='Finishes the legacy chat recovery by migrating old OSMINOG telemetry out of saved conversations and preserving the single-provider elapsed progress strip and reader-aware scrolling.'); write('OSMINOG_BUILD.json',json.dumps(b,ensure_ascii=False,indent=2)+'\n')

s=read('gpt-presence.js')
old='async function loadChat(revealLatest=true){const id=activeThreadId;try{const keys=[threadChatKey(id),threadContextKey(id)];if(id==="main")keys.push(LEGACY_CHAT_KEY(),LEGACY_CONTEXT_KEY());const x=await chrome.storage.local.get(keys);chat=Array.isArray(x[threadChatKey(id)])?x[threadChatKey(id)]:(id==="main"&&Array.isArray(x[LEGACY_CHAT_KEY()])?x[LEGACY_CHAT_KEY()]:[]);pinnedContexts=Array.isArray(x[threadContextKey(id)])?x[threadContextKey(id)]:(id==="main"&&Array.isArray(x[LEGACY_CONTEXT_KEY()])?x[LEGACY_CONTEXT_KEY()]:[])}catch{chat=[];pinnedContexts=[]}renderChat(revealLatest);renderContextTray();renderThreadTabs();drawAgentTethers()}'
new='async function loadChat(revealLatest=true){const id=activeThreadId;let migratedTelemetry=false;try{const keys=[threadChatKey(id),threadContextKey(id)];if(id==="main")keys.push(LEGACY_CHAT_KEY(),LEGACY_CONTEXT_KEY());const x=await chrome.storage.local.get(keys),raw=Array.isArray(x[threadChatKey(id)])?x[threadChatKey(id)]:(id==="main"&&Array.isArray(x[LEGACY_CHAT_KEY()])?x[LEGACY_CHAT_KEY()]:[]);chat=raw.filter(m=>!(m?.source==="progress"||(m?.author==="OSMINOG"&&m?.source==="runtime")));migratedTelemetry=chat.length!==raw.length;pinnedContexts=Array.isArray(x[threadContextKey(id)])?x[threadContextKey(id)]:(id==="main"&&Array.isArray(x[LEGACY_CONTEXT_KEY()])?x[LEGACY_CONTEXT_KEY()]:[]);if(migratedTelemetry)await chrome.storage.local.set({[threadChatKey(id)]:chat.slice(-140)})}catch{chat=[];pinnedContexts=[]}renderChat(revealLatest);renderContextTray();renderThreadTabs();drawAgentTethers()}'
s=once(s,old,new,'load chat telemetry migration')
# Make the elapsed strip read like the proven older UX: selected provider + stage + live seconds + continuing state.
old='function renderResponseProgress(){const elapsed=Math.max(0,Math.floor((Date.now()-responseStartedAt)/1000)),provider=activeThread()?.provider||"gpt";activity(`${providerLabel(provider)} · ${responseStage} · ${elapsed}с`,true,{pct:responseProgress,color:providerColor(provider)})}'
new='function renderResponseProgress(){const elapsed=Math.max(0,Math.floor((Date.now()-responseStartedAt)/1000)),provider=activeThread()?.provider||"gpt",tail=elapsed?" · продолжает":"";activity(`${providerLabel(provider)} · ${responseStage} · ${elapsed}с${tail}`,true,{pct:responseProgress,color:providerColor(provider)})}'
s=once(s,old,new,'progress wording')
write('gpt-presence.js',s)

notes='''# OSMINOG Chrome 3.14.5 — LEGACY CHAT POLISH

- Removes saved 3.14.2/3.14.3 OSMINOG progress/runtime cards from provider conversation history on load, so the selected provider is visually the only assistant speaker.
- Keeps execution stages in the inline progress strip instead of the message stream.
- The progress strip shows live elapsed seconds and a continuing state while the response is pending.
- Reader-aware scrolling from 3.14.4 is preserved: follow the newest answer near the bottom, preserve position when the owner scrolls up.
- All 3.14.4 widget lifecycle, direct internet image placement, version badge and interface-text fixes are preserved.
'''
write('RELEASE_NOTES_3.14.5.md',notes)
append_once('OSMINOG_PROJECT_LOG.md','3.14.5 LEGACY CHAT POLISH','''## 2026-09-03 — 3.14.5 LEGACY CHAT POLISH

Owner supplied the 3.11.34-era chat as the visual/behavior reference. Historical project records confirm the intended chat contract: progress belongs in `#gptPresenceActivity`, uses provider colour, live elapsed timing and an inline moving fill, while the conversation itself remains the provider/user transcript. 3.14.5 completes the migration by deleting previously persisted OSMINOG progress/runtime telemetry cards from loaded chat histories and keeping new execution stages solely in the status strip. The strip now reads as the selected provider + stage + live seconds + continuing state, while reader-aware bottom following remains intact.
''')
append_once('OSMINOG_ROADMAP.md','3.14.5 legacy chat polish','''### 3.14.5 legacy chat polish
- Treat the 3.11.34-era provider chat as the interaction baseline: one visible provider speaker, execution telemetry only in the inline progress strip, live elapsed seconds, stable scroll behavior.
- Migrate old saved OSMINOG progress/runtime cards out of conversation history on first load after update.
- Preserve all 3.14.4 execution fixes while polishing only chat continuity.
''')
write('project-log-archive/2026-09-03-3145-legacy-chat-polish.md',notes)
print('patched 3.14.5')
