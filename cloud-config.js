/* OSMINOG unified development channel: code packages are delivered by the local signed updater from the GitHub release feed. */
globalThis.BRIEFCRAFT_CLOUD_CONFIG = Object.freeze({relayHttpBase:"",relayWsBase:"",chatGPTAppUrl:"https://chatgpt.com/",devMode:true,ownerBuild:true,updateChannel:"osminog-devhub",nativeUpdaterHost:"com.briefcraft.updater"});

/* Optional local MCP pilot. No content-script injection and no automatic connection. */
if(typeof document!=="undefined"&&location.pathname.endsWith("/editor.html")){
  const loadMCP=()=>{const contract=document.createElement("script");contract.src=chrome.runtime.getURL("osminog-mcp-contract.js");contract.onload=()=>{const board=document.createElement("script");board.src=chrome.runtime.getURL("osminog-mcp-board.js");document.head.append(board)};document.head.append(contract)};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",loadMCP,{once:true});else loadMCP();
}
