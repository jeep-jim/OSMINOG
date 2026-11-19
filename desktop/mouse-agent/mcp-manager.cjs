'use strict';
const fs=require('node:fs'),path=require('node:path'),{EventEmitter}=require('node:events');
const dependency=require('./deps.cjs'),{cleanEnv}=require('./policy.cjs'),{TOOLS}=require('./mcp-files.cjs');
const names=new Set(TOOLS.map(t=>t.name));
function serverWorkingDirectory(server){
 const absolute=path.resolve(server),parts=absolute.split(path.sep),archive=parts.findIndex(part=>part.endsWith('.asar'));
 // Electron can load the absolute script from ASAR, but the OS cannot chdir
 // into that virtual directory. Keep cwd in the trusted physical bundle.
 return archive<0?path.dirname(absolute):(parts.slice(0,archive).join(path.sep)||path.parse(absolute).root);
}
class McpManager extends EventEmitter{
 constructor({command=process.execPath,server=path.join(__dirname,'mcp-server.cjs')}={}){
  super();this.command=command;this.server=server;this.generation=0;this.folder='';this.writeAllowed=false;this.connected=false;this.watching=false;this.watchLimited=false;this.tree=null;this.error='';this.client=null;this.refreshTimer=null;this.refreshed=null;
 }
 state(){return{connected:this.connected,writeAllowed:this.writeAllowed,watching:this.watching,watchLimited:this.watchLimited,tree:this.tree,error:this.error,tools:this.connected?TOOLS:[]};}
 emitState(){this.emit('state',this.state());}
 async start(folder,{write=false}={}){
  const generation=++this.generation,old=this.client;this.client=null;this.connected=false;this.writeAllowed=false;this.watching=false;this.watchLimited=false;this.error='';this.tree=null;clearTimeout(this.refreshTimer);this.emitState();
  await old?.close().catch(()=>{});if(generation!==this.generation)throw Error('Подключение папки отменено');
  const canonical=fs.realpathSync(folder);if(!fs.statSync(canonical).isDirectory())throw Error('Нужна папка проекта');
  const {Client}=dependency('@modelcontextprotocol/sdk/client/index.js'),{StdioClientTransport}=dependency('@modelcontextprotocol/sdk/client/stdio.js'),{LoggingMessageNotificationSchema}=dependency('@modelcontextprotocol/sdk/types.js');
  const client=new Client({name:'mouse-local-host',version:'6.0.28'},{capabilities:{}});
  const transport=new StdioClientTransport({command:this.command,args:[this.server,'--allow-dir',canonical,...(write?['--write-enabled']:[])],cwd:serverWorkingDirectory(this.server),env:{...cleanEnv(),ELECTRON_RUN_AS_NODE:'1'},stderr:'pipe'});
  this.client=client;this.transport=transport;this.folder=canonical;
  const current=()=>generation===this.generation&&this.client===client;
  client.setNotificationHandler(LoggingMessageNotificationSchema,notification=>{
   if(!current())return;const data=notification.params.data;if(!data||typeof data!=='object'||Array.isArray(data))return;
   if(data.kind==='file-action')this.emit('action',data);
   if(data.kind==='workspace-change'){this.emit('change',{event:String(data.event),path:String(data.path)});this.scheduleRefresh();}
   if(data.kind==='watch-ready'){this.watching=true;this.watchLimited=data.limited===true;this.emitState();}
   if(data.kind==='watch-limit'){this.watchLimited=true;this.emitState();}
   if(data.kind==='workspace-error'){this.error=String(data.message).slice(0,400);this.emitState();}
  });
  client.onclose=()=>{if(current()){this.connected=false;this.writeAllowed=false;this.watching=false;this.client=null;this.error='Файловый сервер остановлен';this.emitState();}};
  client.onerror=()=>{if(current()){this.error='Ошибка файлового MCP-сервера';this.emitState();}};
  transport.stderr?.on('data',()=>{});
  try{
   await client.connect(transport,{timeout:10000});if(!current())throw Error('Подключение папки отменено');
   const result=await client.listTools();if(result.tools?.length!==names.size||result.tools.some(tool=>!names.has(tool.name)))throw Error('Неожиданный набор MCP-инструментов');
   this.connected=true;this.writeAllowed=write===true;await this.refresh();if(!current())throw Error('Подключение папки отменено');this.emitState();return this.state();
  }catch(error){if(current()){this.client=null;this.connected=false;this.writeAllowed=false;this.watching=false;this.error=String(error.message).slice(0,400);this.emitState();}await client.close().catch(()=>{});throw error;}
 }
 async call(name,args={}){
  const client=this.client,generation=this.generation;if(!this.connected||!client)throw Error('Выберите папку проекта и подключите «Локал»');
  if(!names.has(name))throw Error('Неизвестный MCP-инструмент');if(name==='write_file'&&!this.writeAllowed)throw Error('Запись отключена. Включите «Разрешить редактирование»');
  if(JSON.stringify(args).length>1024*1024)throw Error('Превышен лимит файлового запроса');
  const result=await client.callTool({name,arguments:args},undefined,{timeout:15000});
  if(client!==this.client||generation!==this.generation||!this.connected)throw Error('Доступ к папке отозван');
  if(result.isError)throw Error(result.content?.find(x=>x.type==='text')?.text||'Файловая операция отклонена');
  if(!result.structuredContent||typeof result.structuredContent!=='object')throw Error('Файловый сервер вернул неполный результат');
  if(name==='write_file'){this.emit('write',{path:result.structuredContent.path,bytes:result.structuredContent.bytes});this.scheduleRefresh();}
  return result;
 }
 async listTools(){if(!this.connected)throw Error('«Локал» не подключён');return{tools:TOOLS,readOnly:!this.writeAllowed,root:this.folder,sandboxed:false};}
 async refresh(){
  if(!this.connected)return this.state();const generation=this.generation;
  const result=await this.call('list_directory',{path:'.',depth:4,limit:500});if(generation===this.generation){this.tree=result.structuredContent;this.emitState();}return this.state();
 }
 scheduleRefresh(){
  clearTimeout(this.refreshTimer);this.refreshTimer=setTimeout(()=>{this.refreshed=this.refresh().catch(error=>{if(this.connected){this.error=String(error.message).slice(0,400);this.emitState();}});},150);this.refreshTimer.unref?.();
 }
 async setWrite(value){if(typeof value!=='boolean')throw Error('Недопустимое разрешение записи');if(!this.folder)throw Error('Выберите папку проекта');if(this.connected&&this.writeAllowed===value)return this.state();return this.start(this.folder,{write:value});}
 async close(){
  ++this.generation;clearTimeout(this.refreshTimer);this.refreshTimer=null;const client=this.client;this.client=null;this.connected=false;this.writeAllowed=false;this.watching=false;this.watchLimited=false;this.tree=null;this.error='';this.emitState();await client?.close().catch(()=>{});
 }
}
module.exports={McpManager,serverWorkingDirectory};
