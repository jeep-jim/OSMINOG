'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),{CodeProject}=require('./code-project.cjs');
test('folder tree preserves nested sources and binary assets; save detects conflicts',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'osminog-code-'));try{
 await fs.mkdir(path.join(root,'src'));await fs.writeFile(path.join(root,'src','main.tsx'),'export const hello = "Привет";');await fs.writeFile(path.join(root,'image.png'),Buffer.from([0,1,2,255]));
 const p=new CodeProject(),opened=await p.open(root);assert(opened.entries.some(e=>e.name==='src'&&e.directory));assert.equal((await p.list('src'))[0].path,'src/main.tsx');
 const f=await p.read('src/main.tsx');assert.equal(f.binary,false);await p.save('src/main.tsx',f.text+'\n// edited',f.hash);assert.match(await fs.readFile(path.join(root,'src','main.tsx'),'utf8'),/edited/);await assert.rejects(p.save('src/main.tsx','stale',f.hash),/изменён/);assert.equal((await p.read('image.png')).binary,true);
 await assert.rejects(p.read('../outside'),/путь/);await assert.rejects(p.read(path.resolve(root,'src/main.tsx')),/путь/);
 }finally{await fs.rm(root,{recursive:true,force:true})}
});
test('preview serves scoped HTML and assets, revokes previous project token',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'osminog-preview-'));try{
 await fs.writeFile(path.join(root,'index.html'),'<script src="main.js"></script>');await fs.writeFile(path.join(root,'main.js'),'document.title="works"');const p=new CodeProject(),a=await p.open(root);let response=await p.response('osminog-code://'+a.token+'/main.js');assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'text/javascript');assert.match(await response.text(),/works/);await p.open(root);assert.equal((await p.response('osminog-code://'+a.token+'/index.html')).status,403);
 }finally{await fs.rm(root,{recursive:true,force:true})}
});
