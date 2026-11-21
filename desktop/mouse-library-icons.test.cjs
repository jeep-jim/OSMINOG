'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createIcons}=require('./mouse-library-icons.cjs');
const {MAX_IMAGE}=require('./mouse-capture-archive.cjs');
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jY3sAAAAASUVORK5CYII=','base64');
async function fixture(t,nativeImage){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'mouse-library-preview-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const file=path.join(dir,'picture.png');await fs.writeFile(file,PNG);
 const row={id:'owned-download',filename:'picture.png',path:file,state:'completed'},library={data:{downloads:[row]}};
 return{dir,file,row,library,icons:createIcons({app:{},browser:{},library,nativeImage})};
}
function image(width,height,calls){return{isEmpty:()=>false,getSize:()=>({width,height}),resize:size=>{calls.push(size);return{toDataURL:()=>`data:image/png;base64,${width}x${height}`};}};}
test('Linux without OS thumbnail API decodes bounded file bytes and preserves aspect ratio',async t=>{
 const calls=[],decoded=[];const f=await fixture(t,{createFromBuffer:bytes=>{decoded.push(Buffer.from(bytes));return image(1600,1000,calls);}});
 assert.equal(await f.icons.preview(f.row.id),'data:image/png;base64,1600x1000');
 assert.deepEqual(decoded,[PNG]);assert.deepEqual(calls,[{width:480,height:300}]);
 assert.equal(await f.icons.preview(f.row.id),'data:image/png;base64,1600x1000');assert.equal(decoded.length,1);
});
test('platform thumbnail API is retained and final portrait preview stays within both bounds',async t=>{
 const calls=[],requested=[];const f=await fixture(t,{createThumbnailFromPath:async(file,size)=>{requested.push({file,size});return image(480,960,calls);},createFromBuffer:()=>{throw Error('Unexpected fallback');}});
 await f.icons.preview(f.row.id);assert.deepEqual(requested,[{file:f.file,size:{width:480,height:320}}]);assert.deepEqual(calls,[{width:160,height:320}]);
});
test('preview cache invalidates on replaced download bytes and path changes',async t=>{
 const decoded=[];const f=await fixture(t,{createFromBuffer:bytes=>{decoded.push(Buffer.from(bytes));return image(160,96,[]);}});
 await f.icons.preview(f.row.id);
 const changed=Buffer.concat([PNG,Buffer.from('changed')]);await fs.writeFile(f.file,changed);await f.icons.preview(f.row.id);
 f.row.path=path.join(f.dir,'other.png');await fs.writeFile(f.row.path,PNG);await f.icons.preview(f.row.id);
 assert.deepEqual(decoded,[PNG,changed,PNG]);
});
test('preview rejects unknown, unfinished, non-image, empty, oversized and symlink files before decode',async t=>{
 let decodes=0;const f=await fixture(t,{createFromBuffer:()=>{decodes++;return image(1,1,[]);}});
 assert.equal(await f.icons.preview('unknown'),'');f.row.state='progressing';assert.equal(await f.icons.preview(f.row.id),'');f.row.state='completed';
 for(const filename of ['picture.svg','picture.html','picture.txt']){f.row.filename=filename;assert.equal(await f.icons.preview(f.row.id),'');}f.row.filename='picture.png';
 await fs.truncate(f.file,0);assert.equal(await f.icons.preview(f.row.id),'');
 await fs.truncate(f.file,MAX_IMAGE+1);assert.equal(await f.icons.preview(f.row.id),'');
 if(process.platform!=='win32'){const link=path.join(f.dir,'link.png');await fs.symlink(f.file,link);f.row.path=link;assert.equal(await f.icons.preview(f.row.id),'');}
 assert.equal(decodes,0);
});
test('replacing an image during thumbnail generation is rejected even with matching size and mtime',async t=>{
 let f;f=await fixture(t,{createThumbnailFromPath:async()=>{const before=await fs.stat(f.file),replacement=path.join(f.dir,'replacement.png');await fs.writeFile(replacement,PNG);await fs.utimes(replacement,before.atime,before.mtime);await fs.rename(replacement,f.file);return image(160,96,[]);}});
 assert.equal(await f.icons.preview(f.row.id),'');
});
test('empty or unbounded decoded images do not reach thumbnail serialization',async t=>{
 for(const decoded of [{isEmpty:()=>true},image(0,1,[]),image(1,Infinity,[]),image(10000,10000,[])]){
  const f=await fixture(t,{createFromBuffer:()=>decoded});assert.equal(await f.icons.preview(f.row.id),'');
 }
});
