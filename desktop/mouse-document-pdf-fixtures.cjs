'use strict';
// Synthetic local documents only. Reused by Node roundtrips and installed smoke.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const P=require('./mouse/document-vendor/pdf-lib.min.js'),fontkit=require('./mouse/document-vendor/fontkit.umd.min.js');
const N=P.PDFName.of;
const GRAPHICS='q 0.92 0.97 0.84 rg 0 0 440 320 re f 0.1 0.35 0.7 RG 2 w 12 12 416 296 re S Q';
const TEXT='Mouse627 original',REPLACEMENT='Mouse627 исправлен',CYRILLIC='Исходный русский';
async function createPDFTextFixture(){
 const doc=await P.PDFDocument.create();doc.setTitle('Mouse627 synthetic PDF text fixture');doc.registerFontkit(fontkit);
 const regular=await doc.embedFont(P.StandardFonts.Helvetica),unicode=await doc.embedFont(await fs.readFile(path.join(__dirname,'mouse/document-vendor/DejaVuSans.ttf')),{subset:true});
 const image=doc.context.register(doc.context.flateStream(Uint8Array.from([255,40,20,20,220,80,40,80,255,255,210,10]),{Type:'XObject',Subtype:'Image',Width:2,Height:2,ColorSpace:'DeviceRGB',BitsPerComponent:8}));
 const page=doc.addPage([440,320]);page.node.set(N('Resources'),doc.context.obj({Font:{F1:regular.ref},XObject:{Image1:image}}));
 const contents=GRAPHICS+'\nBT /F1 16 Tf 1.5 Tc 3 Tw 90 Tz 25 245 Td ('+TEXT+') Tj ( KEEP AFTER) Tj 0 -35 Td [(Repeated) -90 ( text)] TJ 0 -35 Td (Repeated text) Tj ET\nBT /F1 13 Tf 0 Tc 0 Tw 100 Tz 24 130 Td (Untouched footer) Tj ET\nq 60 0 0 60 340 50 cm /Image1 Do Q\n';
 page.node.set(N('Contents'),doc.context.obj([doc.context.register(doc.context.flateStream(contents))]));
 page.drawText(CYRILLIC,{x:24,y:85,size:16,font:unicode,color:P.rgb(.2,.15,.5)});
 const rotated=doc.addPage([320,240]);rotated.setRotation(P.degrees(90));rotated.drawText('Rotated original',{x:20,y:150,size:16,font:regular});
 const scan=doc.addPage([320,240]);scan.node.set(N('Resources'),doc.context.obj({XObject:{Image1:image}}));scan.node.set(N('Contents'),doc.context.obj([doc.context.register(doc.context.flateStream('q 320 0 0 240 0 0 cm /Image1 Do Q'))]));
 return new Uint8Array(await doc.save());
}
function pageSource(doc,index){const contents=doc.getPage(index).node.Contents(),streams=contents instanceof P.PDFArray?contents.asArray():[contents];return streams.map(ref=>{const stream=doc.context.lookup(ref);return Buffer.from(stream instanceof P.PDFRawStream?P.decodePDFRawStream(stream).decode():stream.getUnencodedContents()).toString('latin1');}).join('\n');}
function images(doc){return doc.context.enumerateIndirectObjects().map(([,object])=>object).filter(object=>object instanceof P.PDFRawStream&&object.dict.lookup(N('Subtype'))?.decodeText?.()==='Image').map(object=>({width:object.dict.lookup(N('Width')).asNumber(),height:object.dict.lookup(N('Height')).asNumber(),data:Buffer.from(P.decodePDFRawStream(object).decode()).toString('hex')})).sort((a,b)=>a.data.localeCompare(b.data));}
async function verifyUnrelatedPDFContent(original,output){const before=await P.PDFDocument.load(original),after=await P.PDFDocument.load(output);assert.equal(after.getPageCount(),before.getPageCount());assert.deepEqual(after.getPages().map(p=>({size:p.getSize(),rotation:p.getRotation().angle})),before.getPages().map(p=>({size:p.getSize(),rotation:p.getRotation().angle})));assert.deepEqual(images(after),images(before));assert.ok(pageSource(before,0).includes(GRAPHICS));assert.ok(pageSource(after,0).includes(GRAPHICS));assert.ok(pageSource(after,0).includes('q 60 0 0 60 340 50 cm /Image1 Do Q'));assert.equal(pageSource(after,1),pageSource(before,1));assert.equal(pageSource(after,2),pageSource(before,2));return true;}
module.exports={createPDFTextFixture,verifyUnrelatedPDFContent,pageSource,images,TEXT,REPLACEMENT,CYRILLIC,GRAPHICS};
