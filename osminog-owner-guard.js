"use strict";
(()=>{
  if(globalThis.OSMINOGOwnerGuard)return;
  const MODULE_KEY="briefCraftModulesV1",AUTH_KEY="osminogOwnerAuthV1",GRANT_KEY="osminogOwnerGrantV1",SETUP_KEY="osminogOwnerEnrollmentV1";
  const OWNER_REPOS=["jeep-jim/OSMINOG","jeep-jim/OSMINOG-Releases"];
  const SESSION_MS=15*60*1000;
  let unlockedUntil=0,modal=null,activeGate=null,mode="auth",setupSecret="";
  const $=(s,r=document)=>r.querySelector(s);
  const esc=s=>String(s??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  function bytesToBase32(bytes){const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";let bits=0,value=0,out="";for(const b of bytes){value=(value<<8)|b;bits+=8;while(bits>=5){out+=alphabet[(value>>>(bits-5))&31];bits-=5}}if(bits>0)out+=alphabet[(value<<(5-bits))&31];return out}
  function base32ToBytes(value){const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",clean=String(value||"").toUpperCase().replace(/[^A-Z2-7]/g,"");let bits=0,acc=0,out=[];for(const ch of clean){const n=alphabet.indexOf(ch);if(n<0)continue;acc=(acc<<5)|n;bits+=5;if(bits>=8){out.push((acc>>>(bits-8))&255);bits-=8}}return new Uint8Array(out)}
  async function totp(secret,step=Math.floor(Date.now()/30000)){const key=await crypto.subtle.importKey("raw",base32ToBytes(secret),{name:"HMAC",hash:"SHA-1"},false,["sign"]),counter=new Uint8Array(8);let n=BigInt(step);for(let i=7;i>=0;i--){counter[i]=Number(n&255n);n>>=8n}const sig=new Uint8Array(await crypto.subtle.sign("HMAC",key,counter)),off=sig[sig.length-1]&15,bin=((sig[off]&127)<<24)|((sig[off+1]&255)<<16)|((sig[off+2]&255)<<8)|(sig[off+3]&255);return String(bin%1000000).padStart(6,"0")}
  async function verifyCode(secret,code){code=String(code||"").replace(/\s/g,"");if(!/^[0-9]{6}$/.test(code)||!secret)return false;const step=Math.floor(Date.now()/30000);for(const delta of [-1,0,1])if(await totp(secret,step+delta)===code)return true;return false}
  async function storage(){return chrome.storage.local.get([MODULE_KEY,AUTH_KEY,GRANT_KEY,SETUP_KEY])}
  async function ownerToken(){const got=await storage();return String(got?.[MODULE_KEY]?.github?.token||"").trim()}
  async function verifyGitHubToken(token){if(!token)return{ok:false,reason:"token",error:"Для первого Owner Unlock нужен GitHub token владельца."};const r=await chrome.runtime.sendMessage({type:"BC_MODULE_TEST",module:"github",token}).catch(e=>({ok:false,error:e?.message||String(e)}));if(!r?.ok)return{ok:false,reason:r?.code||"github",error:r?.error||"GitHub Owner не подтверждён"};if(!r?.owner?.ok)return{ok:false,reason:"owner",error:"GitHub подключён, но write-доступ к OSMINOG не подтверждён."};return{ok:true,name:r.name||"GitHub",repositories:r.owner.repositories||OWNER_REPOS}}
  async function saveToken(token,verified){const got=await storage(),mods=got?.[MODULE_KEY]||{};mods.github={connected:true,token,name:verified.name||"GitHub",ownerVerified:true,at:Date.now()};await chrome.storage.local.set({[MODULE_KEY]:mods,[GRANT_KEY]:{verified:true,ownerMax:true,repo:OWNER_REPOS[0],repos:verified.repositories||OWNER_REPOS,user:verified.name||"GitHub",verifiedAt:Date.now()}})}
  function ensureModal(){if(modal?.isConnected)return modal;modal=document.createElement("section");modal.id="osminogOwnerGate";modal.className="osminog-owner-gate";modal.hidden=true;modal.innerHTML=`<div class="osminog-owner-card"><div class="osminog-owner-head"><div><small>OSMINOG · OWNER</small><strong data-owner-title>Подтверждение владельца</strong></div><button type="button" data-owner-close>×</button></div><p data-owner-text></p><div data-owner-token-step hidden><input data-owner-token type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…"><small>Нужен только один раз для привязки этой установки к приватным репозиториям OSMINOG. Токен остаётся локально.</small></div><div data-owner-setup-step hidden><div class="osminog-owner-secret"><span>Ключ Google Authenticator</span><code data-owner-secret></code><button type="button" data-owner-copy>Копировать</button></div><small>В Google Authenticator выбери «Ввести ключ настройки»: аккаунт <b>OSMINOG Owner</b>, тип «По времени». Это отдельная запись OSMINOG, не код для входа в GitHub. Затем введи её шестизначный код ниже.</small></div><div data-owner-code-step><input data-owner-code inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000"><small data-owner-hint>Код Google Authenticator</small></div><div class="osminog-owner-actions"><button type="button" data-owner-token-change>Переподключить GitHub</button><button type="button" data-owner-cancel>Отмена</button><button type="button" class="primary" data-owner-submit>Продолжить</button></div><output data-owner-error></output></div>`;document.body.append(modal);$('[data-owner-close]',modal).onclick=()=>finish(false);$('[data-owner-cancel]',modal).onclick=()=>finish(false);$('[data-owner-copy]',modal).onclick=async()=>{try{await navigator.clipboard.writeText(setupSecret)}catch{setError("Не удалось скопировать ключ. Выдели и скопируй его вручную.")}};
    const codeInput=$('[data-owner-code]',modal);
    codeInput.onpaste=e=>{const code=String(e.clipboardData?.getData("text")||"").replace(/\s/g,"");if(/^[0-9]{6}$/.test(code)){e.preventDefault();codeInput.value=code}};
    $('[data-owner-submit]',modal).onclick=submit;$('[data-owner-token-change]',modal).onclick=()=>{if(!activeGate?.ready||activeGate.busy)return;mode="token";setError("");$('[data-owner-token-step]',modal).hidden=false;$('[data-owner-code-step]',modal).hidden=true;$('[data-owner-setup-step]',modal).hidden=true;$('[data-owner-text]',modal).textContent="Токен вводится только здесь и не передаётся в чат. Для исходников нужен Contents: Read and write, для PR — Pull requests: Read and write, для сборок — Actions: Read and write. Выбери оба репозитория OSMINOG.";$('[data-owner-token]',modal).value="";$('[data-owner-token]',modal).focus()};modal.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();submit();}if(e.key==="Escape")finish(false)});return modal}
  function setError(text=""){const out=$('[data-owner-error]',modal);if(out)out.textContent=text}
  function finish(ok,gate=activeGate){
    if(!gate||gate!==activeGate)return;
    activeGate=null;modal.hidden=true;setupSecret="";
    $('[data-owner-code]',modal).value="";$('[data-owner-token]',modal).value="";
    $('[data-owner-submit]',modal).disabled=false;$('[data-owner-token-change]',modal).disabled=false;
    gate.resolve(!!ok);
  }
  function enrollmentLock(task){
    // Same-origin tabs must not generate two different keys for one installation.
    const locks=globalThis.navigator?.locks;
    return locks?.request?locks.request(SETUP_KEY,task):task();
  }
  function showAuth(text){
    mode="auth";setupSecret="";
    $('[data-owner-title]',modal).textContent="Подтверждение владельца";
    $('[data-owner-token-step]',modal).hidden=true;$('[data-owner-setup-step]',modal).hidden=true;
    $('[data-owner-code-step]',modal).hidden=false;$('[data-owner-text]',modal).textContent=text;
    $('[data-owner-code]',modal).value="";$('[data-owner-code]',modal).focus();
  }
  async function submit(){
    const gate=activeGate;
    if(!gate?.ready||gate.busy)return;
    const btn=$('[data-owner-submit]',modal),reconnect=$('[data-owner-token-change]',modal);
    gate.busy=true;btn.disabled=true;reconnect.disabled=true;setError("");
    const live=()=>activeGate===gate;
    try{
      if(mode==="token"){
        const token=String($('[data-owner-token]',modal)?.value||"").trim(),verified=await verifyGitHubToken(token);
        if(!live())return;
        if(!verified.ok)throw new Error(verified.error);
        await saveToken(token,verified);if(!live())return;
        const existing=(await storage())?.[AUTH_KEY];if(!live())return;
        if(existing?.totpSecret)showAuth("GitHub проверен. Введи код записи OSMINOG Owner в Google Authenticator.");
        else await beginEnrollment(gate);
        return;
      }
      const enrolling=mode==="setup",shownSecret=setupSecret,code=$('[data-owner-code]',modal)?.value||"";
      const got=await storage();if(!live())return;
      const secret=enrolling?shownSecret:String(got?.[AUTH_KEY]?.totpSecret||"");
      const valid=await verifyCode(secret,code);if(!live())return;
      if(!valid)throw new Error("Неверный код Google Authenticator. "+(enrolling?"Используй отдельную запись OSMINOG Owner с ключом из этого окна, не код GitHub. ":"Используй запись OSMINOG Owner, не код GitHub. ")+"Проверь автоматические дату и время на телефоне и компьютере.");
      const token=await ownerToken();if(!live())return;
      const verified=await verifyGitHubToken(token);if(!live())return;
      if(!verified.ok)throw new Error(verified.error);
      await saveToken(token,verified);if(!live())return;
      // Commit enrollment only after BOTH factors pass. Never overwrite a key
      // that another tab has already enrolled, and never unlock a cancelled gate.
      await enrollmentLock(async()=>{
        const latest=await storage();if(!live())return;
        const enrolled=latest?.[AUTH_KEY]?.totpSecret;
        if(enrolled&&enrolled!==secret)throw new Error("Привязка Authenticator изменилась в другом окне. Закрой это окно и подтверди вход заново.");
        if(enrolling&&!enrolled){
          if(latest?.[SETUP_KEY]?.secret!==secret)throw new Error("Ключ настройки изменился. Открой подключение заново и используй показанный ключ.");
          await chrome.storage.local.set({[AUTH_KEY]:{method:"totp",totpSecret:secret,label:"OSMINOG Owner",createdAt:Date.now()},[SETUP_KEY]:null});
        }else if(!enrolled)throw new Error("Привязка Authenticator отсутствует. Открой подключение заново.");
      });
      if(!live())return;
      unlockedUntil=Date.now()+SESSION_MS;globalThis.OSMINOGOwnerVerified=true;
      document.dispatchEvent(new CustomEvent("osminog:owner-unlocked",{detail:{until:unlockedUntil}}));finish(true,gate);
    }catch(error){if(live())setError(error?.message||String(error))}
    finally{gate.busy=false;if(live()){btn.disabled=false;reconnect.disabled=false}}
  }
  async function beginEnrollment(gate){
    const draft=await enrollmentLock(async()=>{
      const got=await storage();if(activeGate!==gate)return null;
      if(got?.[AUTH_KEY]?.totpSecret)return{enrolled:true};
      const saved=got?.[SETUP_KEY];
      if(/^[A-Z2-7]{32}$/.test(saved?.secret||""))return saved;
      const created={secret:bytesToBase32(crypto.getRandomValues(new Uint8Array(20))),createdAt:Date.now()};
      // Persist BEFORE showing/copying the key. Closing or reloading must not
      // silently invalidate the record the owner has added on their phone.
      await chrome.storage.local.set({[SETUP_KEY]:created});return created;
    });
    if(activeGate!==gate||!draft)return;
    if(draft.enrolled){showAuth("Введи код записи OSMINOG Owner в Google Authenticator.");return}
    mode="setup";setupSecret=draft.secret;
    $('[data-owner-title]',modal).textContent="Подключить Google Authenticator";
    $('[data-owner-text]',modal).textContent="Это единственная настройка владельца. После привязки OSMINOG будет спрашивать код только перед изменением самого продукта.";
    $('[data-owner-token-step]',modal).hidden=true;$('[data-owner-setup-step]',modal).hidden=false;$('[data-owner-code-step]',modal).hidden=false;
    $('[data-owner-secret]',modal).textContent=setupSecret;$('[data-owner-code]',modal).value="";$('[data-owner-code]',modal).focus();
  }
  async function promptOwner(scope,gate){
    modal.hidden=false;setError("");
    $('[data-owner-submit]',modal).disabled=true;$('[data-owner-token-change]',modal).disabled=true;
    $('[data-owner-title]',modal).textContent="Подтверждение владельца";$('[data-owner-text]',modal).textContent="Проверка подключения…";
    $('[data-owner-token-step]',modal).hidden=true;$('[data-owner-setup-step]',modal).hidden=true;$('[data-owner-code-step]',modal).hidden=true;
    $('[data-owner-code]',modal).value="";
    const got=await storage();if(activeGate!==gate)return;
    const auth=got?.[AUTH_KEY]||{},token=String(got?.[MODULE_KEY]?.github?.token||"").trim();
    if(!token){
      mode="token";$('[data-owner-title]',modal).textContent="Первый вход владельца";
      $('[data-owner-text]',modal).textContent="Для привязки этой установки к исходникам OSMINOG один раз подтверди GitHub Owner. После этого токен больше не показывается в настройках.";
      $('[data-owner-token-step]',modal).hidden=false;$('[data-owner-token]',modal).value="";$('[data-owner-token]',modal).focus();
    }else if(!auth.totpSecret){
      const verified=await verifyGitHubToken(token);if(activeGate!==gate)return;
      if(!verified.ok){
        mode="token";$('[data-owner-title]',modal).textContent="Обновить Owner-доступ";$('[data-owner-text]',modal).textContent=verified.error;
        $('[data-owner-token-step]',modal).hidden=false;$('[data-owner-token]',modal).value="";$('[data-owner-token]',modal).focus();
      }else{await saveToken(token,verified);if(activeGate===gate)await beginEnrollment(gate)}
    }else showAuth(`Изменение самого OSMINOG: ${scope}. Введи код записи OSMINOG Owner в Google Authenticator.`);
  }
  function require(scope="product-source"){
    if(Date.now()<unlockedUntil)return Promise.resolve(true);
    // Set the shared promise synchronously, before storage or GitHub awaits.
    if(activeGate)return activeGate.promise;
    ensureModal();
    const gate={ready:false,busy:false};gate.promise=new Promise(resolve=>{gate.resolve=resolve});activeGate=gate;
    promptOwner(scope,gate).then(()=>{
      if(activeGate!==gate)return;
      gate.ready=true;$('[data-owner-submit]',modal).disabled=false;$('[data-owner-token-change]',modal).disabled=false;
    }).catch(error=>{if(activeGate===gate){setError(error?.message||String(error));finish(false,gate)}});
    return gate.promise;
  }
  function isUnlocked(){return Date.now()<unlockedUntil}
  function lock(){unlockedUntil=0;globalThis.OSMINOGOwnerVerified=false;finish(false)}
  globalThis.OSMINOGOwnerGuard={require,isUnlocked,lock,ownerToken};
})();

