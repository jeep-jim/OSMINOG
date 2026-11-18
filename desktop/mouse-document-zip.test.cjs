'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {deflateRawSync,deflateSync}=require('node:zlib');
const ZIP=require('./mouse-document-zip.cjs');
function crc(bytes){let n=0xffffffff;for(const b of bytes){n^=b;for(let k=0;k<8;k++)n=n&1?0xedb88320^n>>>1:n>>>1;}return(n^0xffffffff)>>>0;}
function png(width=1,height=1){
  const chunk=(type,data)=>{const name=Buffer.from(type),header=Buffer.alloc(4),sum=Buffer.alloc(4);header.writeUInt32BE(data.length);sum.writeUInt32BE(crc(Buffer.concat([name,data])));return Buffer.concat([header,name,data,sum]);};
  const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.from([0,255,0,0,255]))),chunk('IEND',Buffer.alloc(0))]);
}
function packageZip(files,{comment='mouse preservation fixture',reverse=false}={}) {
  let offset=0;const records=[],centrals=[];
  for(const file of files) {
    const name=Buffer.from(file.path),bytes=Buffer.from(file.data??''),method=file.method??8,body=method===8?deflateRawSync(bytes):bytes;
    const extra=Buffer.from([0xfe,0xca,3,0,4,5,6]),flag=0x800|(file.descriptor?8:0),sum=crc(bytes);
    const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(flag,6);header.writeUInt16LE(method,8);header.writeUInt16LE(123,10);header.writeUInt16LE(234,12);
    if(!file.descriptor){header.writeUInt32LE(sum,14);header.writeUInt32LE(body.length,18);header.writeUInt32LE(bytes.length,22);}
    header.writeUInt16LE(name.length,26);header.writeUInt16LE(extra.length,28);
    const descriptor=Buffer.alloc(file.descriptor?16:0);if(file.descriptor){descriptor.writeUInt32LE(0x08074b50);descriptor.writeUInt32LE(sum,4);descriptor.writeUInt32LE(body.length,8);descriptor.writeUInt32LE(bytes.length,12);}
    const record=Buffer.concat([header,name,extra,body,descriptor]);
    const memo=Buffer.from('preserve comment '+file.path),central=Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50);central.writeUInt16LE(0x314,4);central.writeUInt16LE(20,6);central.writeUInt16LE(flag,8);central.writeUInt16LE(method,10);central.writeUInt16LE(123,12);central.writeUInt16LE(234,14);central.writeUInt32LE(sum,16);central.writeUInt32LE(body.length,20);central.writeUInt32LE(bytes.length,24);central.writeUInt16LE(name.length,28);central.writeUInt16LE(extra.length,30);central.writeUInt16LE(memo.length,32);central.writeUInt32LE(0x81a40000,38);central.writeUInt32LE(offset,42);
    records.push(record);centrals.push(Buffer.concat([central,name,extra,memo]));offset+=record.length;
  }
  if(reverse)centrals.reverse();const table=Buffer.concat(centrals),end=Buffer.alloc(22),note=Buffer.from(comment);
  end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(table.length,12);end.writeUInt32LE(offset,16);end.writeUInt16LE(note.length,20);
  return Buffer.concat([...records,table,end,note]);
}
function docx(extra=[]) {return packageZip([
  {path:'[Content_Types].xml',data:'<Types><Override ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'},
  {path:'_rels/.rels',data:'<Relationships/>'},
  {path:'word/document.xml',data:'<w:document xmlns:w="urn:word"><w:body><w:p><w:r><w:t>Original</w:t></w:r></w:p></w:body></w:document>',descriptor:true},
  {path:'word/styles.xml',data:'<w:styles xmlns:w="urn:word"><w:style w:styleId="Keep"/></w:styles>'},
  {path:'customXml/item1.xml',data:'<unknown keep="yes"><binary-ref/></unknown>',descriptor:true},
  {path:'word/media/image1.png',data:png(),method:0},...extra
],{reverse:true});}
function record(bytes,path) {
  const end=bytes.lastIndexOf(Buffer.from([0x50,0x4b,5,6]));let p=bytes.readUInt32LE(end+16);
  while(p<end){const name=bytes.toString('utf8',p+46,p+46+bytes.readUInt16LE(p+28));if(name===path){const local=bytes.readUInt32LE(p+42),start=local+30+bytes.readUInt16LE(local+26)+bytes.readUInt16LE(local+28),stop=start+bytes.readUInt32LE(p+20)+(bytes.readUInt16LE(p+8)&8?16:0);return{local,central:p,start,bytes:bytes.subarray(local,stop)};}p+=46+bytes.readUInt16LE(p+28)+bytes.readUInt16LE(p+30)+bytes.readUInt16LE(p+32);}
  throw Error(path);
}
test('patches DOCX text while preserving compressed unknown parts, media, styles and comments byte for byte',()=>{
  const original=docx(),archive=ZIP.read(original),xml=ZIP.extract(archive,'word/document.xml').toString();
  const changed=ZIP.replace(archive,{'word/document.xml':xml.replace('Original','Изменённый текст &amp; ещё')}),next=ZIP.read(changed);
  assert.match(ZIP.extract(next,'word/document.xml').toString(),/Изменённый текст/);
  for(const path of ['customXml/item1.xml','word/styles.xml','word/media/image1.png','[Content_Types].xml'])assert.deepEqual(record(changed,path).bytes,record(original,path).bytes,path);
  assert.equal(changed.subarray(-27).toString(),original.subarray(-27).toString());
  assert.deepEqual(ZIP.replace(archive,{}),original);assert.deepEqual(ZIP.replace(archive,{'word/document.xml':xml}),original);
});
test('snapshot exposes bounded XML and raster images, omits executable SVG/unknown parts, does not mutate source',()=>{
  const source=docx([{path:'word/media/vector.svg',data:'<svg onload="alert(1)"/>'}]),archive=ZIP.read(source),data=ZIP.snapshot(archive);
  assert.equal(data.kind,'docx');assert.match(data.parts['word/document.xml'],/Original/);assert.equal(data.parts['customXml/item1.xml'],undefined);
  assert.equal(data.media['word/media/image1.png'].mime,'image/png');assert.equal(data.media['word/media/vector.svg'],undefined);
  const extracted=ZIP.extract(archive,'word/document.xml');extracted.fill(0);assert.match(ZIP.extract(archive,'word/document.xml').toString(),/Original/);
});
test('XLSX snapshot includes arbitrary worksheet names and retains formulas/styles/other package parts',()=>{
  const source=packageZip([{path:'[Content_Types].xml',data:'<Types/>'},{path:'_rels/.rels',data:'<Relationships/>'},{path:'xl/workbook.xml',data:'<workbook/>'},{path:'xl/_rels/workbook.xml.rels',data:'<Relationships/>'},{path:'xl/worksheets/budget.xml',data:'<worksheet><c r="A1" s="4"><f>SUM(B1:B8)</f><v>17</v></c></worksheet>'},{path:'xl/pivotTables/pivotTable1.xml',data:'<pivotTableDefinition/>'}]);
  const archive=ZIP.read(source);assert.equal(archive.kind,'xlsx');assert.match(ZIP.snapshot(archive).parts['xl/worksheets/budget.xml'],/SUM\(B1:B8\)/);
  const output=ZIP.replace(archive,{'xl/worksheets/budget.xml':ZIP.extract(archive,'xl/worksheets/budget.xml').toString().replace('<v>17</v>','<v>18</v>')});
  assert.deepEqual(record(output,'xl/pivotTables/pivotTable1.xml').bytes,record(source,'xl/pivotTables/pivotTable1.xml').bytes);
});
test('rejects mismatched central/local metadata, payload CRC, and data descriptors',()=>{
  for(const mutate of [
    bytes=>{bytes[record(bytes,'word/media/image1.png').start+9]^=1;},
    bytes=>{bytes.writeUInt32LE(123,record(bytes,'word/styles.xml').local+14);},
    bytes=>{const r=record(bytes,'word/document.xml');bytes[r.local+r.bytes.length-1]^=1;}
  ]){const bytes=docx();mutate(bytes);assert.throws(()=>ZIP.read(bytes),/части|пакет/);}
});
test('rejects overlapping local records and duplicate/traversal names',()=>{
  const source=docx(),a=record(source,'word/styles.xml'),b=record(source,'customXml/item1.xml');source.writeUInt32LE(a.local,b.central+42);assert.throws(()=>ZIP.read(source));
  assert.throws(()=>ZIP.read(docx([{path:'word/STYLES.xml',data:'duplicate'}])),{code:'OFFICE_DUPLICATE'});
  assert.throws(()=>ZIP.read(docx([{path:'../outside',data:'bad'}])),{code:'OFFICE_PATH'});
});
test('rejects encrypted, ZIP64, macros and XML external entities with explicit errors',()=>{
  const encrypted=docx(),r=record(encrypted,'word/document.xml');encrypted.writeUInt16LE(0x809,r.central+8);assert.throws(()=>ZIP.read(encrypted),{code:'OFFICE_ENCRYPTED'});
  const zip64=docx(),r2=record(zip64,'word/document.xml');zip64.writeUInt32LE(0xffffffff,r2.central+24);assert.throws(()=>ZIP.read(zip64),{code:'OFFICE_ZIP64'});
  assert.throws(()=>ZIP.read(docx([{path:'word/vbaProject.bin',data:'macro'}])),{code:'OFFICE_MACROS'});
  const entity=ZIP.read(docx([{path:'word/header1.xml',data:'<!DOCTYPE x SYSTEM "file:///etc/passwd"><x/>'}]));assert.throws(()=>ZIP.snapshot(entity),{code:'OFFICE_XML_ENTITY'});
});
test('decompression stops at declared size; missing/new parts and excessive edits cannot be saved',()=>{
  const source=docx(),r=record(source,'word/styles.xml');source.writeUInt32LE(1,r.central+24);source.writeUInt32LE(1,r.local+22);assert.throws(()=>ZIP.read(source),{code:'OFFICE_INFLATE'});
  const archive=ZIP.read(docx());assert.throws(()=>ZIP.replace(archive,{'word/added.xml':'<x/>'}),{code:'OFFICE_PATCH_PART'});
  assert.throws(()=>ZIP.replace(archive,{'word/document.xml':'x'.repeat(ZIP.LIMITS.xmlBytes+1)}),{code:'OFFICE_PATCH_SIZE'});
  assert.throws(()=>ZIP.replace(archive,{'word/document.xml':'<!DOCTYPE x><x/>'}),{code:'OFFICE_XML_ENTITY'});
});
function xlsxWithChain({chainTarget='calcChain.xml',rels,types}={}) {
  const relationNS='http://schemas.openxmlformats.org/package/2006/relationships',typeNS='http://schemas.openxmlformats.org/package/2006/content-types';
  return packageZip([
    {path:'[Content_Types].xml',data:types||`<?xml version="1.0"?><Types xmlns="${typeNS}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><!-- preserve this comment --><Override PartName="/xl/calcChain.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.calcChain+xml" /></Types>`},
    {path:'_rels/.rels',data:`<Relationships xmlns="${relationNS}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`},
    {path:'xl/workbook.xml',data:'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Budget" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="191029" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>'},
    {path:'xl/_rels/workbook.xml.rels',data:rels||`<r:Relationships xmlns:r="${relationNS}"><r:Relationship Id='rId1' Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet' Target='worksheets/sheet1.xml'/><!-- calcChain comment must remain --><r:Relationship Id='rId2' Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/calcChain' Target='${chainTarget}'></r:Relationship></r:Relationships>`},
    {path:'xl/worksheets/sheet1.xml',data:'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1"><v>4</v></c><c r="B1"><f>A1*2</f><v>8</v></c></row></sheetData></worksheet>',descriptor:true},
    {path:'xl/calcChain.xml',data:'<calcChain xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><c r="B1" i="1"/></calcChain>',descriptor:true},
    {path:'customXml/unknown.xml',data:'<unknown>retain this compressed stream</unknown>',descriptor:true},
    {path:'xl/printerSettings/printerSettings1.bin',data:Buffer.from([0,2,8,127,255]),method:0}
  ],{reverse:true});
}
test('host save removes the stale XLSX calculation chain and only its metadata after a real cell edit',()=>{
  const input=xlsxWithChain(),archive=ZIP.read(input),sheet=ZIP.extract(archive,'xl/worksheets/sheet1.xml').toString();
  assert.equal(ZIP.snapshot(archive).hasCalcChain,true);
  const output=ZIP.save(archive,{'xl/worksheets/sheet1.xml':sheet.replace('<v>4</v>','<v>5</v>')}),saved=ZIP.read(output);
  assert.equal(ZIP.snapshot(saved).hasCalcChain,false);assert.equal(saved.entries.length,archive.entries.length-1);assert.throws(()=>ZIP.extract(saved,'xl/calcChain.xml'),{code:'OFFICE_PART'});
  const rels=ZIP.extract(saved,'xl/_rels/workbook.xml.rels').toString(),types=ZIP.extract(saved,'[Content_Types].xml').toString();
  assert.doesNotMatch(rels,/relationships\/calcChain/);assert.match(rels,/calcChain comment must remain/);assert.match(rels,/Target='worksheets\/sheet1.xml'/);
  assert.doesNotMatch(types,/PartName="\/xl\/calcChain.xml"/);assert.match(types,/preserve this comment/);assert.match(types,/PartName="\/xl\/workbook.xml"/);
  assert.match(ZIP.extract(saved,'xl/worksheets/sheet1.xml').toString(),/<f>A1\*2<\/f>/);
  for(const path of ['xl/workbook.xml','_rels/.rels','customXml/unknown.xml','xl/printerSettings/printerSettings1.bin'])assert.deepEqual(record(output,path).bytes,record(input,path).bytes,path);
});
test('no-op saving retains calcChain and all original bytes; generic replace has no deletion interface',()=>{
  const input=xlsxWithChain(),archive=ZIP.read(input),sheet=ZIP.extract(archive,'xl/worksheets/sheet1.xml').toString();
  assert.deepEqual(ZIP.save(archive,{}),input);assert.deepEqual(ZIP.save(archive,{'xl/worksheets/sheet1.xml':sheet}),input);
  const replaced=ZIP.read(ZIP.replace(archive,{'xl/worksheets/sheet1.xml':sheet.replace('<v>4</v>','<v>6</v>')}));assert.equal(ZIP.snapshot(replaced).hasCalcChain,true);
  assert.throws(()=>ZIP.save(archive,{'xl/calcChain.xml':null}),{code:'OFFICE_PATCH_VALUE'});
});
test('calcChain removal understands prefixes, quotes, entities and explicit closing tags while keeping unknown metadata bytes',()=>{
  const relationNS='http://schemas.openxmlformats.org/package/2006/relationships',rels=`<Relationships xmlns="${relationNS}" xmlns:q="urn:custom"><q:Metadata note="a > b &amp; c"/><Relationship Id="keep" Type="urn:keep" Target="other.xml"/><Relationship Target="calcCh&#97;in.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/calcChain" Id="chain" /></Relationships>`;
  const input=xlsxWithChain({rels}),archive=ZIP.read(input),workbook=ZIP.extract(archive,'xl/workbook.xml').toString();
  const saved=ZIP.read(ZIP.save(archive,{'xl/workbook.xml':workbook.replace('191029','191030')}));
  assert.equal(ZIP.extract(saved,'xl/_rels/workbook.xml.rels').toString(),rels.replace(/<Relationship Target="calcCh[^]*?\/>/,''));
  assert.equal(saved.entries.some(e=>e.path==='xl/calcChain.xml'),false);
});
test('an unexpected calcChain target cannot cause the host to delete a worksheet or other arbitrary part',()=>{
  const archive=ZIP.read(xlsxWithChain({chainTarget:'worksheets/sheet1.xml'})),sheet=ZIP.extract(archive,'xl/worksheets/sheet1.xml').toString();
  assert.throws(()=>ZIP.save(archive,{'xl/worksheets/sheet1.xml':sheet.replace('<v>4</v>','<v>9</v>')}),{code:'OFFICE_CALC_CHAIN'});
  assert.match(ZIP.extract(archive,'xl/worksheets/sheet1.xml').toString(),/<v>4<\/v>/);
});
test('image preview rejects enormous decoded dimensions without removing original image bytes',()=>{
  const huge=png(100000,100000),source=docx([{path:'word/media/huge.png',data:huge}]),archive=ZIP.read(source),preview=ZIP.snapshot(archive);
  assert.equal(preview.media['word/media/image1.png'].width,1);assert.equal(preview.media['word/media/huge.png'],undefined);
  assert.deepEqual(ZIP.extract(archive,'word/media/huge.png'),huge);assert.deepEqual(ZIP.save(archive,{}),source);
});
test('image preview has a total decoded-pixel budget across separate compressed parts',()=>{
  const archive=ZIP.read(docx([1,2,3].map(n=>({path:`word/media/photo${n}.png`,data:png(4000,3000)})))),preview=ZIP.snapshot(archive);
  const photos=Object.entries(preview.media).filter(([path])=>/photo\d\.png$/.test(path));assert.equal(photos.length,2);assert.equal(photos.reduce((n,[,image])=>n+image.width*image.height,0),24000000);assert.equal(archive.entries.filter(e=>e.path.startsWith('word/media/')).length,4);
});
test('bounded ordinary GIF and WebP dimensions remain available to the Word preview',()=>{
  const gif=Buffer.from('R0lGODdhAgADAIEAAP8AAAAAAAAAAAAAACwAAAAAAgADAAAIBgABCBwYEAA7','base64');
  const webp=Buffer.from('UklGRjwAAABXRUJQVlA4IDAAAADQAQCdASoCAAMAAUAmJaACdLoB+AADsAD+8ut//NgVzXPv9//S4P0uD9Lg/9KQAAA=','base64');
  const preview=ZIP.snapshot(ZIP.read(docx([{path:'word/media/ordinary.gif',data:gif},{path:'word/media/ordinary.webp',data:webp}])));
  for(const path of ['word/media/ordinary.gif','word/media/ordinary.webp'])assert.deepEqual([preview.media[path].width,preview.media[path].height],[2,3]);
});
module.exports={packageZip,docx};
