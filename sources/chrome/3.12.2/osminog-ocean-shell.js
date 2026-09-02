"use strict";
(()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const OCEAN_DEFAULTS={plankton:true,bubbles:true,organics:true,density:"medium",luminescence:"soft"};
  const SPACE_DEFAULTS={stars:true,satellites:true,meteors:true,galaxies:true,density:"medium",glow:"soft"};
  const isOcean=()=>document.documentElement.dataset.theme==="ocean";
  const isDark=()=>document.documentElement.dataset.theme==="dark";

  function safeParse(raw,fallback){try{return raw?{...fallback,...JSON.parse(raw)}:{...fallback}}catch{return {...fallback}}}
  function normalizeSpacePatch(input={}){const patch={...input};if(patch.galaxies===undefined&&patch.phenomena!==undefined)patch.galaxies=patch.phenomena;if(patch.glow===undefined&&patch.luminescence!==undefined)patch.glow=patch.luminescence;delete patch.phenomena;delete patch.luminescence;return patch}
  function normalizeSpacePrefs(input={}){const next={...SPACE_DEFAULTS,...normalizeSpacePatch(input)};next.stars=next.stars!==false;next.satellites=next.satellites!==false;next.meteors=next.meteors!==false;next.galaxies=next.galaxies!==false;next.density=["low","medium","high"].includes(next.density)?next.density:"medium";next.glow=["off","soft","bright"].includes(next.glow)?next.glow:"soft";return next}
  function legacySpacePrefs(input=getSpacePrefs()){const fx=normalizeSpacePrefs(input);return{...fx,phenomena:fx.galaxies,luminescence:fx.glow}}
  function getOceanPrefs(){return safeParse(localStorage.getItem("osminog-ocean-fx-v31121")||localStorage.getItem("osminog-ocean-fx-v31119")||localStorage.getItem("osminog-ocean-fx-v31118"),OCEAN_DEFAULTS)}
  function getSpacePrefs(){const raw=localStorage.getItem("osminog-space-fx-v31134")||localStorage.getItem("osminog-space-fx-v31131");return normalizeSpacePrefs(safeParse(raw,{}))}
  function setOceanPrefs(patch){const next={...getOceanPrefs(),...patch};try{localStorage.setItem("osminog-ocean-fx-v31121",JSON.stringify(next))}catch{}applyFx();return next}
  function setSpacePrefs(patch){const next=normalizeSpacePrefs({...getSpacePrefs(),...normalizeSpacePatch(patch)});try{localStorage.setItem("osminog-space-fx-v31134",JSON.stringify(next));localStorage.setItem("osminog-space-fx-v31131",JSON.stringify(legacySpacePrefs(next)))}catch{}applyFx();return next}

  const OCEAN_SVG={
    ring:`<svg viewBox="0 0 64 48" aria-hidden="true"><ellipse cx="32" cy="24" rx="24" ry="14" fill="none" stroke="currentColor" stroke-width="3"/><ellipse cx="35" cy="23" rx="12" ry="7" fill="currentColor" opacity=".28" transform="rotate(-14 35 23)"/></svg>`,
    oval:`<svg viewBox="0 0 64 48" aria-hidden="true"><ellipse cx="32" cy="24" rx="22" ry="12" fill="currentColor" opacity=".24" transform="rotate(-18 32 24)"/><ellipse cx="32" cy="24" rx="20" ry="10" fill="none" stroke="currentColor" stroke-width="2" opacity=".6"/></svg>`,
    burst:`<svg viewBox="0 0 64 64" aria-hidden="true"><g stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".8"><path d="M32 5v18M32 41v18M5 32h18M41 32h18M13 13l13 13M38 38l13 13M51 13L38 26M26 38L13 51M20 7l8 17M36 40l8 17M7 20l17 8M40 36l17 8M44 7l-8 17M28 40l-8 17M57 20l-17 8M24 36L7 44"/></g><circle cx="32" cy="32" r="4" fill="currentColor" opacity=".35"/></svg>`,
    jelly:`<svg viewBox="0 0 56 72" aria-hidden="true"><path d="M11 24c0-11 8-19 17-19s17 8 17 19v7H11z" fill="currentColor" opacity=".18"/><path d="M13 31v30M20 31v34M28 31v32M36 31v34M43 31v28" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".55"/><path d="M10 30h36" stroke="currentColor" stroke-width="2" opacity=".38"/></svg>`,
    microbe:`<svg viewBox="0 0 72 44" aria-hidden="true"><path d="M9 28c4-10 9-18 20-20 9-2 12 6 20 5 10-2 16 6 13 13-4 9-16 11-27 11-12 0-30 1-26-9z" fill="currentColor" opacity=".16" stroke="currentColor" stroke-width="2"/><g fill="currentColor" opacity=".55"><circle cx="20" cy="25" r="3"/><circle cx="31" cy="16" r="2"/><circle cx="42" cy="28" r="3"/><ellipse cx="52" cy="20" rx="5" ry="2" transform="rotate(-18 52 20)"/></g></svg>`,
    star:`<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 5l7 18 20 1-15 13 5 20-17-11-17 11 5-20L5 24l20-1z" fill="currentColor" opacity=".13" stroke="currentColor" stroke-width="2"/></svg>`,
    spore:`<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M31 5c6 8 5 13 14 10-2 9 2 11 11 14-8 4-8 9-5 17-9-1-12 2-15 11-6-7-11-6-18-1-2-9-6-11-14-12 6-7 4-12-2-18 9-1 12-5 12-14 8 4 12 3 17-7z" fill="currentColor" opacity=".12" stroke="currentColor" stroke-width="2"/><circle cx="31" cy="31" r="9" fill="currentColor" opacity=".12"/></svg>`,
    propeller:`<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M31 30C18 20 14 12 19 9c6-3 13 8 17 18 8-11 18-17 22-12 4 5-6 14-16 19 8 11 9 22 3 23-7 1-10-11-11-21-13 6-24 6-25 0-1-6 11-8 22-6z" fill="currentColor" opacity=".14" stroke="currentColor" stroke-width="2"/></svg>`,
    droplet:`<svg viewBox="0 0 58 72" aria-hidden="true"><path d="M48 8C39 21 33 32 26 43 20 52 9 60 11 66c2 5 14-2 21-8 11-10 18-26 16-50z" fill="currentColor" opacity=".17" stroke="currentColor" stroke-width="2"/><circle cx="25" cy="53" r="7" fill="currentColor" opacity=".13"/></svg>`,
    crescent:`<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M50 14c-8 7-11 15-8 25 2 6 7 10 12 12-13 4-28-2-34-14-6-13 1-28 14-34 6-3 12-2 16 0-7 2-12 6-15 12-5 10-1 23 9 28-4-11-2-21 6-29z" fill="currentColor" opacity=".14" stroke="currentColor" stroke-width="2"/></svg>`,
    diamond:`<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 4l7 21 21 7-21 7-7 21-7-21-21-7 21-7z" fill="currentColor" opacity=".14" stroke="currentColor" stroke-width="2"/></svg>`,
    cell:`<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="24" fill="currentColor" opacity=".10" stroke="currentColor" stroke-width="2"/><ellipse cx="36" cy="28" rx="13" ry="9" fill="currentColor" opacity=".18" transform="rotate(18 36 28)"/><circle cx="22" cy="38" r="3" fill="currentColor" opacity=".35"/></svg>`
  };
  const OCEAN_TYPES=Object.keys(OCEAN_SVG);
  function createOceanForm(type,index){
    const el=document.createElement("span");
    el.className=`ocean-form ocean-form-${type}${index%4===0?" ocean-luma":""}`;
    el.innerHTML=OCEAN_SVG[type];
    el.style.setProperty("--x",`${5+((index*31)%90)}%`);
    el.style.setProperty("--y",`${8+((index*47)%78)}%`);
    el.style.setProperty("--s",`${30+(index%6)*11}px`);
    el.style.setProperty("--d",`${20+(index%7)*4}s`);
    el.style.setProperty("--delay",`${-(index*2.7)}s`);
    el.style.setProperty("--r",`${(index*29)%180-90}deg`);
    el.style.setProperty("--o",`${0.14+(index%5)*0.025}`);
    return el;
  }
  function ensureOceanLayer(){
    let root=$("#oceanThemeFx");
    if(root)return root;
    root=document.createElement("div");root.id="oceanThemeFx";root.className="ocean-theme-fx";root.setAttribute("aria-hidden","true");
    const plank=document.createElement("div");plank.className="ocean-plankton-layer";
    const bubbles=document.createElement("div");bubbles.className="ocean-bubbles-layer";
    const organics=document.createElement("div");organics.className="ocean-organics-layer";
    for(let i=0;i<24;i++){
      const p=document.createElement("span");p.className=`ocean-speck${i%7===0?" ocean-luma":""}`;
      p.style.setProperty("--x",`${(i*37)%96}%`);p.style.setProperty("--y",`${(i*61)%94}%`);
      p.style.setProperty("--s",`${1+(i%4)}px`);p.style.setProperty("--d",`${12+(i%9)*2}s`);p.style.setProperty("--delay",`${-(i%11)*1.3}s`);plank.append(p);
    }
    OCEAN_TYPES.forEach((type,i)=>organics.append(createOceanForm(type,i)));
    OCEAN_TYPES.slice(0,7).forEach((type,i)=>{const f=createOceanForm(type,i+OCEAN_TYPES.length);f.classList.add("ocean-form-secondary");organics.append(f)});
    for(let i=0;i<18;i++){
      const b=document.createElement("span");b.className="ocean-bubble";
      b.style.setProperty("--x",`${3+((i*53)%94)}%`);b.style.setProperty("--y",`${52+((i*41)%44)}%`);
      b.style.setProperty("--s",`${5+(i%6)*4}px`);b.style.setProperty("--rise",`${150+(i%5)*52}px`);b.style.setProperty("--d",`${13+(i%8)*2}s`);b.style.setProperty("--delay",`${-(i%13)*1.5}s`);bubbles.append(b);
    }
    root.append(plank,bubbles,organics);
    $("#app")?.prepend(root);
    return root;
  }
  function createSpaceNode(cls,vars={}){const el=document.createElement("span");el.className=cls;for(const [k,v] of Object.entries(vars))el.style.setProperty(k,v);return el}
  function ensureSpaceLayer(){
    const viewport=$("#viewport");
    let root=$("#spaceThemeFx");
    if(root){
      if(viewport&&root.parentElement!==viewport)viewport.prepend(root);
      return root;
    }
    if(!viewport)return null;
    root=document.createElement("div");root.id="spaceThemeFx";root.className="space-theme-fx";root.setAttribute("aria-hidden","true");
    const stars=document.createElement("div");stars.className="space-stars-layer";
    const orbiters=document.createElement("div");orbiters.className="space-orbiters-layer";
    const meteors=document.createElement("div");meteors.className="space-meteors-layer";
    const phenomena=document.createElement("div");phenomena.className="space-phenomena-layer";
    for(let i=0;i<42;i++){
      stars.append(createSpaceNode(`space-star${i%8===0?" space-luma":""}`,{
        "--x":`${2+((i*23)%96)}%`,"--y":`${2+((i*37)%94)}%`,"--s":`${1+(i%4)}px`,"--d":`${9+(i%7)*2}s`,"--delay":`${-(i%9)*1.1}s`
      }));
    }
    const orbiterDefs=[
      ["space-satellite",{x:"12%",y:"18%",s:"28px",d:"48s",delay:"-12s",r:"12deg"}],
      ["space-satellite",{x:"72%",y:"26%",s:"24px",d:"54s",delay:"-30s",r:"-18deg"}],
      ["space-ufo",{x:"18%",y:"72%",s:"30px",d:"61s",delay:"-18s",r:"3deg"}],
      ["space-ufo",{x:"79%",y:"68%",s:"26px",d:"70s",delay:"-44s",r:"-8deg"}]
    ];
    orbiterDefs.forEach(([cls,v],i)=>orbiters.append(createSpaceNode(`${cls}${i%2?" space-luma":""}`,{"--x":v.x,"--y":v.y,"--s":v.s,"--d":v.d,"--delay":v.delay,"--r":v.r})));
    for(let i=0;i<6;i++){
      meteors.append(createSpaceNode(`space-meteor${i%3===0?" space-luma":""}`,{
        "--x":`${8+((i*17)%84)}%`,"--y":`${10+((i*13)%46)}%`,"--trail":`${110+(i%4)*36}px`,"--d":`${15+(i%4)*5}s`,"--delay":`${-(i*3.5)}s`
      }));
    }
    const phenomenaDefs=[
      ["space-galaxy",{x:"9%",y:"10%",s:"120px",d:"90s",delay:"-8s",r:"18deg"}],
      ["space-galaxy",{x:"76%",y:"12%",s:"148px",d:"120s",delay:"-42s",r:"-22deg"}],
      ["space-nebula",{x:"58%",y:"74%",s:"190px",d:"95s",delay:"-15s",r:"0deg"}],
      ["space-nebula",{x:"18%",y:"58%",s:"160px",d:"105s",delay:"-37s",r:"0deg"}],
      ["space-ringworld",{x:"48%",y:"24%",s:"88px",d:"80s",delay:"-24s",r:"10deg"}],
      ["space-ringworld",{x:"84%",y:"56%",s:"72px",d:"76s",delay:"-51s",r:"-11deg"}]
    ];
    phenomenaDefs.forEach(([cls,v],i)=>phenomena.append(createSpaceNode(`${cls}${i%2===0?" space-luma":""}`,{"--x":v.x,"--y":v.y,"--s":v.s,"--d":v.d,"--delay":v.delay,"--r":v.r})));
    root.append(stars,orbiters,meteors,phenomena);
    viewport.prepend(root);
    return root;
  }
  function applyFx(){
    const html=document.documentElement,ocean=getOceanPrefs(),space=getSpacePrefs();
    const oceanRoot=ensureOceanLayer(),spaceRoot=ensureSpaceLayer();
    html.dataset.oceanDensity=ocean.density||"medium";
    html.dataset.oceanLuminescence=ocean.luminescence||"soft";
    html.dataset.oceanPlankton=ocean.plankton===false?"off":"on";
    html.dataset.oceanBubbles=ocean.bubbles===false?"off":"on";
    html.dataset.oceanOrganics=ocean.organics===false?"off":"on";
    html.dataset.spaceDensity=space.density||"medium";
    html.dataset.spaceLuminescence=space.glow||"soft";
    html.dataset.spaceStars=space.stars===false?"off":"on";
    html.dataset.spaceSatellites=space.satellites===false?"off":"on";
    html.dataset.spaceMeteors=space.meteors===false?"off":"on";
    html.dataset.spacePhenomena=space.galaxies===false?"off":"on";
    if(oceanRoot)oceanRoot.hidden=!isOcean();
    if(spaceRoot)spaceRoot.hidden=!isDark();
  }
  let fxInjecting=false;
  let fxInjectQueued=false;
  function injectThemeFx(){
    if(fxInjecting)return;
    const body=$("#inspectorBody");if(!body)return;
    if(document.querySelectorAll('.canvas-object.selected').length)return;
    const ru=document.documentElement.lang==="ru";
    const oceanExisting=body.querySelector(".ocean-fx-settings");
    const spaceExisting=body.querySelector(".space-fx-settings");
    if(isOcean()&&oceanExisting&&!spaceExisting)return;
    if(isDark()&&spaceExisting&&!oceanExisting)return;
    if(!isOcean()&&!isDark()&&!oceanExisting&&!spaceExisting)return;
    fxInjecting=true;
    try{
      if(!isOcean())oceanExisting?.remove();
      if(!isDark())spaceExisting?.remove();
      if(isOcean()&&!body.querySelector(".ocean-fx-settings")){
        const fx=getOceanPrefs();
        const section=document.createElement("section");section.className="ocean-fx-settings";
        section.innerHTML=`<div class="section-title">OCEAN FX</div>
          <div class="ocean-fx-card">
            <div class="ocean-fx-row"><span>${ru?"Планктон":"Plankton"}</span><label class="ocean-switch"><input type="checkbox" data-ocean-fx="plankton" ${fx.plankton!==false?"checked":""}><i></i></label></div>
            <div class="ocean-fx-row"><span>${ru?"Пузыри":"Bubbles"}</span><label class="ocean-switch"><input type="checkbox" data-ocean-fx="bubbles" ${fx.bubbles!==false?"checked":""}><i></i></label></div>
            <div class="ocean-fx-row"><span>${ru?"Морские формы":"Sea forms"}</span><label class="ocean-switch"><input type="checkbox" data-ocean-fx="organics" ${fx.organics!==false?"checked":""}><i></i></label></div>
          </div>
          <div class="ocean-fx-card ocean-fx-selects">
            <label><span>${ru?"Плотность":"Density"}</span><select data-ocean-fx="density"><option value="low" ${fx.density==="low"?"selected":""}>Low</option><option value="medium" ${fx.density==="medium"?"selected":""}>Medium</option><option value="high" ${fx.density==="high"?"selected":""}>High</option></select></label>
            <label><span>${ru?"Свечение":"Glow"}</span><select data-ocean-fx="luminescence"><option value="off" ${fx.luminescence==="off"?"selected":""}>Off</option><option value="soft" ${fx.luminescence==="soft"?"selected":""}>Soft</option><option value="bright" ${fx.luminescence==="bright"?"selected":""}>Bright</option></select></label>
          </div>`;
        body.append(section);
        globalThis.OSMINOGUpgradeSelects?.(section);
        section.querySelectorAll("[data-ocean-fx]").forEach(el=>el.addEventListener("change",()=>setOceanPrefs({[el.dataset.oceanFx]:el.type==="checkbox"?el.checked:el.value})));
      }
      if(isDark()&&!body.querySelector(".space-fx-settings")){
        const fx=getSpacePrefs();
        const section=document.createElement("section");section.className="space-fx-settings";
        section.innerHTML=`<div class="section-title">SPACE FX</div>
          <div class="ocean-fx-card space-fx-card">
            <div class="ocean-fx-row"><span>${ru?"Звёзды":"Stars"}</span><label class="ocean-switch"><input type="checkbox" data-space-fx="stars" ${fx.stars!==false?"checked":""}><i></i></label></div>
            <div class="ocean-fx-row"><span>${ru?"Спутники и НЛО":"Satellites + UFO"}</span><label class="ocean-switch"><input type="checkbox" data-space-fx="satellites" ${fx.satellites!==false?"checked":""}><i></i></label></div>
            <div class="ocean-fx-row"><span>${ru?"Метеоры":"Meteors"}</span><label class="ocean-switch"><input type="checkbox" data-space-fx="meteors" ${fx.meteors!==false?"checked":""}><i></i></label></div>
            <div class="ocean-fx-row"><span>${ru?"Галактики и туманности":"Galaxies + nebulae"}</span><label class="ocean-switch"><input type="checkbox" data-space-fx="galaxies" ${fx.galaxies!==false?"checked":""}><i></i></label></div>
          </div>
          <div class="ocean-fx-card ocean-fx-selects space-fx-selects">
            <label><span>${ru?"Плотность":"Density"}</span><select data-space-fx="density"><option value="low" ${fx.density==="low"?"selected":""}>Low</option><option value="medium" ${fx.density==="medium"?"selected":""}>Medium</option><option value="high" ${fx.density==="high"?"selected":""}>High</option></select></label>
            <label><span>${ru?"Свечение":"Glow"}</span><select data-space-fx="glow"><option value="off" ${fx.glow==="off"?"selected":""}>Off</option><option value="soft" ${fx.glow==="soft"?"selected":""}>Soft</option><option value="bright" ${fx.glow==="bright"?"selected":""}>Bright</option></select></label>
          </div>`;
        body.append(section);
        globalThis.OSMINOGUpgradeSelects?.(section);
        section.querySelectorAll("[data-space-fx]").forEach(el=>el.addEventListener("change",()=>setSpacePrefs({[el.dataset.spaceFx]:el.type==="checkbox"?el.checked:el.value})));
      }
    }finally{fxInjecting=false}
  }
  function queueFxInject(){
    if(fxInjectQueued)return;
    fxInjectQueued=true;
    queueMicrotask(()=>{fxInjectQueued=false;injectThemeFx()});
  }
  function syncZoomPosition(){
    const app=$("#app"),inspector=$("#inspector"),zoom=$(".zoom-controls");
    if(!app||!zoom)return;
    if(zoom.parentElement!==app)app.append(zoom);
    zoom.classList.add("osminog-zoom-pill");
    const expanded=inspector && !inspector.classList.contains("collapsed") && !inspector.hidden;
    zoom.classList.toggle("with-expanded-inspector",!!expanded);
    zoom.classList.toggle("with-collapsed-inspector",!expanded);
    zoom.style.left="auto";zoom.style.top="auto";
    if(expanded){
      const rect=inspector.getBoundingClientRect();
      zoom.style.right=Math.max(16,(rect.width||340)+28)+"px";
      zoom.style.bottom="14px";
    }else{
      zoom.style.right="14px";
      zoom.style.bottom="14px";
    }
  }
  function moveCommonControls(){
    const app=$("#app"),layers=$("#layersToggle");
    if(app&&layers&&!layers.classList.contains("layers-floating-bubble")){layers.classList.add("layers-floating-bubble");app.append(layers)}
    syncZoomPosition();
  }
  function refresh(){moveCommonControls();applyFx();queueFxInject()}
  function init(){
    ["oceanAmbience","oceanEye","oceanBottomStrip","oceanSearchScrim","oceanSearchSheet","oceanArcLauncher","oceanArcIntro"].forEach(id=>document.getElementById(id)?.remove());
    refresh();
    new MutationObserver(()=>refresh()).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme","lang"]});
    document.addEventListener("osminog:theme-changed",refresh);
    window.addEventListener("resize",syncZoomPosition,{passive:true});
    const inspector=$("#inspector");if(inspector)new MutationObserver(syncZoomPosition).observe(inspector,{attributes:true,attributeFilter:["class","hidden","style"]});
    const body=$("#inspectorBody");if(body)new MutationObserver(()=>{if(!fxInjecting&&(isOcean()||isDark()))queueFxInject()}).observe(body,{childList:true});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
  globalThis.OSMINOGOceanTheme={getPrefs:getOceanPrefs,setPrefs:setOceanPrefs,getSpacePrefs,setSpacePrefs,getLegacySpacePrefs:legacySpacePrefs,setLegacySpacePrefs:setSpacePrefs,refresh,version:"3.11.34"};
})();
