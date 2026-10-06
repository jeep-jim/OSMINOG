/* OSMINOG external MCP pilot: one bounded contract for server and editor. */
(function(root){
  'use strict';
  const str=(min=1,max=200)=>({type:'string',minLength:min,maxLength:max});
  const int=(min,max)=>({type:'integer',minimum:min,maximum:max});
  const fields={projectId:str(),id:str(),offset:int(0,1000000),limit:int(1,100),max_chars:int(200,8000)};
  const tools=[];
  function add(name,description,properties={},required=[],write=false){
    tools.push({name,description,inputSchema:{type:'object',properties,required,additionalProperties:false},annotations:{readOnlyHint:!write,destructiveHint:write&&name==='update_canvas_note',idempotentHint:true,openWorldHint:false}});
  }
  function read(name,description,properties={},required=[]){add(name,description,{projectId:fields.projectId,...properties},['projectId',...required]);}
  add('canvas_status','Read the live status of the one explicitly connected OSMINOG board. Call first to obtain projectId and revision. Fails when the board is offline. No chat history is accessible.');
  read('get_project_map','Read the current board object map and relationships. Summaries are not image pixels. Use list_canvas_objects for pagination beyond the map limit.',{limit:int(1,400)});
  read('list_canvas_objects','List live objects with pagination.',{offset:fields.offset,limit:fields.limit,type:str(1,40),include_preview:{type:'boolean'}});
  read('get_selection','Read the current selection, not the selection from a previous message.',{include_neighbors:{type:'boolean'}});
  read('get_object','Read one live object by a verified ID.',{id:fields.id},['id']);
  read('get_connections','Read current object relationships.',{id:fields.id});
  read('search_canvas','Search names and textual content within this board only.',{query:str(1,500),limit:int(1,40)},['query']);
  read('get_recent_changes','Read the board revision and most recent change diff. This is not a complete change history.');
  read('read_object_text','Read the full text of a note/text/brief in bounded pages.',{id:fields.id,offset:fields.offset,max_chars:fields.max_chars},['id']);
  read('read_code','Read a code object as inert source text. Does not execute it.',{id:fields.id,offset:fields.offset,max_chars:fields.max_chars},['id']);
  read('document_read','Read text from an embedded PDF, text file or note. PDF pages are 1-based. No OCR; image-only PDFs require another workflow.',{id:fields.id,page:int(1,10000),offset:fields.offset,max_chars:fields.max_chars,max_items:int(1,500)},['id']);
  read('read_canvas_image','Return actual pixels of one embedded canvas image as MCP image content. Source image, not a screenshot of other tabs; canvas filters/masks are not included.',{id:fields.id,max_size:int(256,4096)},['id']);
  const write={projectId:fields.projectId,expectedRevision:int(0,Number.MAX_SAFE_INTEGER),requestKey:{...str(8,100),pattern:'^[A-Za-z0-9_-]+$'},name:str(1,120),text:str(0,50000)};
  add('create_canvas_note','Create a plain-text note on the connected board and save it. Requires local edit permission and the revision just read. Reuse requestKey with identical arguments after timeout; do not create another key until the first outcome is known. No deletion or arbitrary execution.',{...write,anchorId:fields.id},['projectId','expectedRevision','requestKey','name','text'],true);
  add('update_canvas_note','Replace the text/name of an existing note/text/brief. Requires local edit permission and a fresh board revision. Reuse the same requestKey and identical arguments for retries. Returns verified save outcome.',{...write,id:fields.id},['projectId','expectedRevision','requestKey','id','name','text'],true);
  function validate(name,args){
    const tool=tools.find(t=>t.name===name);if(!tool)throw Error('TOOL_NOT_ALLOWED');
    if(!args||typeof args!=='object'||Array.isArray(args))throw Error('INVALID_ARGUMENTS');
    const s=tool.inputSchema;
    for(const key of s.required)if(!Object.hasOwn(args,key))throw Error('MISSING_ARGUMENT: '+key);
    for(const[key,value]of Object.entries(args)){
      if(!Object.hasOwn(s.properties,key))throw Error('UNKNOWN_ARGUMENT: '+key);
      const p=s.properties[key];
      if(p.type==='string'&&(typeof value!=='string'||[...value].length<p.minLength||[...value].length>p.maxLength||p.pattern&&!new RegExp(p.pattern).test(value)))throw Error('INVALID_STRING: '+key);
      if(p.type==='integer'&&(!Number.isSafeInteger(value)||value<p.minimum||value>p.maximum))throw Error('INVALID_INTEGER: '+key);
      if(p.type==='boolean'&&typeof value!=='boolean')throw Error('INVALID_BOOLEAN: '+key);
    }
    return tool;
  }
  const api={version:'0.1.0',tools,validate,isWrite:name=>tools.some(t=>t.name===name&&!t.annotations.readOnlyHint)};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.OSMINOGMCPContract=api;
})(globalThis);
