'use strict';
// Dedicated trusted stdio MCP child. stdout is reserved for JSON-RPC.
const path=require('node:path');
const dependency=require('./deps.cjs');
const {ScopedFiles,TOOLS,IGNORED,LIMITS}=require('./mcp-files.cjs');
function argumentsFor(argv){
 let folder,write=false;
 for(let i=0;i<argv.length;i++){
  if(argv[i]==='--allow-dir'&&folder===undefined&&typeof argv[i+1]==='string')folder=argv[++i];
  else if(argv[i]==='--write-enabled'&&!write)write=true;
  else throw Error('Unsupported file-server option');
 }
 if(!folder||!path.isAbsolute(folder))throw Error('Missing --allow-dir');return{folder,write};
}
async function serve({folder,write=false,stdin=process.stdin,stdout=process.stdout}={}){
 const {Server}=dependency('@modelcontextprotocol/sdk/server/index.js');
 const {StdioServerTransport}=dependency('@modelcontextprotocol/sdk/server/stdio.js');
 const {ListToolsRequestSchema,CallToolRequestSchema}=dependency('@modelcontextprotocol/sdk/types.js');
 const server=new Server({name:'mouse-local-files',version:'6.0.28'},{capabilities:{tools:{},logging:{}}});
 let connected=false,watcher,closing=false;const notify=data=>{if(connected&&!closing)void server.sendLoggingMessage({level:'info',logger:'mouse-local',data}).catch(()=>{});};
 const files=new ScopedFiles(folder,{write,onAction:data=>notify({kind:'file-action',...data})});
 server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:TOOLS}));
 server.setRequestHandler(CallToolRequestSchema,async request=>{
  try{const result=files.execute(request.params.name,request.params.arguments||{});return{content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result};}
  catch(error){return{isError:true,content:[{type:'text',text:String(error.message).slice(0,500)}]};}
 });
 const close=async()=>{if(closing)return;closing=true;connected=false;files.close();await watcher?.close();await server.close().catch(()=>{});};
 const transport=new StdioServerTransport(stdin,stdout);server.onclose=()=>void close();await server.connect(transport);connected=true;
 const seen=new Set();let watchLimited=false;
 watcher=dependency('chokidar').watch(files.root,{ignoreInitial:true,followSymlinks:false,depth:LIMITS.depth,awaitWriteFinish:{stabilityThreshold:100,pollInterval:25},
  ignored:(candidate,stats)=>{
   const rel=path.relative(files.root,candidate);if(rel==='')return false;
   if(rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))return true;
   const pieces=rel.split(path.sep);if(pieces.some(p=>IGNORED.has(p)||p.startsWith('.mouse-local-')))return true;
   if(stats?.isSymbolicLink())return true;
   if(!seen.has(rel)){if(seen.size>=5000){if(!watchLimited){watchLimited=true;notify({kind:'watch-limit',limit:5000});}return true;}seen.add(rel);}return false;
  }});
 watcher.on('all',(event,file)=>{
  if(closing)return;try{files.checkRoot();const relative=path.relative(files.root,file).split(path.sep).join('/');
   // Chokidar is a freshness hint, never the authority for filenames or access.
   // Suppress its path even under concurrent ancestor replacement. The UI tree
   // is rebuilt only through the native, no-follow directory capabilities.
   if(relative&&relative!== '..'&&!relative.startsWith('../')&&!path.isAbsolute(relative))notify({kind:'workspace-change',event:'dirty',path:'.'});
  }catch(error){notify({kind:'workspace-error',message:String(error.message).slice(0,400)});void close();}
 });
 watcher.on('error',()=>notify({kind:'workspace-error',message:'Наблюдение за папкой недоступно; используйте «Обновить»'}));
 watcher.on('ready',()=>notify({kind:'watch-ready',limited:watchLimited}));
 stdin.once('end',()=>void close());return{server,files,close};
}
if(require.main===module){
 serve(argumentsFor(process.argv.slice(2))).then(handle=>{
  for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>void handle.close().finally(()=>process.exit(0)));
 }).catch(error=>{process.stderr.write('Mouse Local: '+String(error.message).slice(0,500)+'\n');process.exitCode=1;});
}
module.exports={serve,argumentsFor};
