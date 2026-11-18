'use strict';
// Small, explicitly synthetic files for the installed 625 document proof.
// They are created inside its disposable profile, never in a user's documents.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {deflateRawSync,deflateSync}=require('node:zlib');
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const S='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const P='http://schemas.openxmlformats.org/package/2006/relationships';
const T='http://schemas.openxmlformats.org/package/2006/content-types';
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function crc(bytes){let n=0xffffffff;for(const b of bytes){n^=b;for(let k=0;k<8;k++)n=n&1?0xedb88320^n>>>1:n>>>1;}return(n^0xffffffff)>>>0;}
function packageZip(parts){
 let offset=0;const local=[],central=[];
 for(const [name,data]of Object.entries(parts)){
  const filename=Buffer.from(name),bytes=Buffer.from(data),compressed=deflateRawSync(bytes),sum=crc(bytes),a=Buffer.alloc(30),b=Buffer.alloc(46);
  a.writeUInt32LE(0x04034b50);a.writeUInt16LE(20,4);a.writeUInt16LE(0x800,6);a.writeUInt16LE(8,8);a.writeUInt16LE(33,12);a.writeUInt32LE(sum,14);a.writeUInt32LE(compressed.length,18);a.writeUInt32LE(bytes.length,22);a.writeUInt16LE(filename.length,26);
  b.writeUInt32LE(0x02014b50);b.writeUInt16LE(20,4);b.writeUInt16LE(20,6);b.writeUInt16LE(0x800,8);b.writeUInt16LE(8,10);b.writeUInt16LE(33,14);b.writeUInt32LE(sum,16);b.writeUInt32LE(compressed.length,20);b.writeUInt32LE(bytes.length,24);b.writeUInt16LE(filename.length,28);b.writeUInt32LE(offset,42);
  const record=Buffer.concat([a,filename,compressed]);local.push(record);central.push(Buffer.concat([b,filename]));offset+=record.length;
 }
 const table=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(local.length,8);end.writeUInt16LE(local.length,10);end.writeUInt32LE(table.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...local,table,end]);
}
function png(){
 const chunk=(kind,data)=>{const type=Buffer.from(kind),size=Buffer.alloc(4),sum=Buffer.alloc(4);size.writeUInt32BE(data.length);sum.writeUInt32BE(crc(Buffer.concat([type,data])));return Buffer.concat([size,type,data,sum]);};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(1,0);ihdr.writeUInt32BE(1,4);ihdr[8]=8;ihdr[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(Buffer.from([0,50,199,106,255]))),chunk('IEND',Buffer.alloc(0))]);
}
function pdf(){
 const content='BT /F1 14 Tf 24 196 Td (Mouse625 PDF fixture) Tj ET\n';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 360 240] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`];
 let output='%PDF-1.7\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(output));output+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
 const xref=Buffer.byteLength(output);output+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return Buffer.from(output);
}
function docx(){return{
 '[Content_Types].xml':`<Types xmlns="${T}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="bin" ContentType="application/octet-stream"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`,
 '_rels/.rels':`<Relationships xmlns="${P}"><Relationship Id="office" Type="${R}/officeDocument" Target="word/document.xml"/></Relationships>`,
 'word/document.xml':`<w:document xmlns:w="${W}" xmlns:r="${R}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body><w:p><w:r><w:t>Mouse625 body original</w:t></w:r></w:p><w:p><w:r><w:t>Only the first paragraph is edited in this local fixture.</w:t></w:r></w:p><w:tbl><w:tblPr/><w:tblGrid><w:gridCol w:w="5000"/></w:tblGrid><w:tr><w:tc><w:tcPr/><w:p><w:r><w:t>Mouse625 table retained</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><w:r><w:drawing><wp:inline><wp:extent cx="228600" cy="228600"/><wp:docPr id="1" name="Mouse625 image"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="Mouse625 image"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="image1"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="228600" cy="228600"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p><w:sectPr><w:headerReference w:type="default" r:id="header1"/><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1000" w:right="1000" w:bottom="1000" w:left="1000"/></w:sectPr></w:body></w:document>`,
 'word/_rels/document.xml.rels':`<Relationships xmlns="${P}"><Relationship Id="header1" Type="${R}/header" Target="header1.xml"/><Relationship Id="styles" Type="${R}/styles" Target="styles.xml"/><Relationship Id="image1" Type="${R}/image" Target="media/image1.png"/></Relationships>`,
 'word/header1.xml':`<w:hdr xmlns:w="${W}"><w:p><w:r><w:t>Mouse625 header retained</w:t></w:r></w:p></w:hdr>`,
 'word/styles.xml':`<w:styles xmlns:w="${W}"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:sz w:val="22"/></w:rPr></w:style></w:styles>`,
 'word/media/image1.png':png(),
 'customXml/proof.xml':'<mouse-fixture version="625">Unknown Word part must remain byte-identical.</mouse-fixture>',
 'customXml/proof.bin':Buffer.from([0,25,6,255,10,13,128])
};}
function xlsx(){return{
 '[Content_Types].xml':`<Types xmlns="${T}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="bin" ContentType="application/octet-stream"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/xl/calcChain.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.calcChain+xml"/></Types>`,
 '_rels/.rels':`<Relationships xmlns="${P}"><Relationship Id="office" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
 'xl/workbook.xml':`<workbook xmlns="${S}" xmlns:r="${R}"><bookViews><workbookView activeTab="0"/></bookViews><sheets><sheet name="Main" sheetId="1" r:id="sheet1"/><sheet name="Keep" sheetId="2" r:id="sheet2"/></sheets><definedNames><definedName name="KeepName">Main!$A$1</definedName></definedNames><calcPr calcId="191029"/></workbook>`,
 'xl/_rels/workbook.xml.rels':`<Relationships xmlns="${P}"><Relationship Id="sheet1" Type="${R}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="sheet2" Type="${R}/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="styles" Type="${R}/styles" Target="styles.xml"/><Relationship Id="strings" Type="${R}/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="chain" Type="${R}/calcChain" Target="calcChain.xml"/></Relationships>`,
 'xl/styles.xml':`<styleSheet xmlns="${S}"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>`,
 'xl/sharedStrings.xml':`<sst xmlns="${S}" count="2" uniqueCount="1"><si><t>Shared original retained</t></si></sst>`,
 'xl/worksheets/sheet1.xml':`<worksheet xmlns="${S}"><dimension ref="A1:D2"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetData><row r="1"><c r="A1" s="0"><v>2</v></c><c r="B1" t="s"><v>0</v></c><c r="C1" t="s"><v>0</v></c><c r="D1"><f>SUM(A1,A2)</f><v>5</v></c></row><row r="2"><c r="A2"><v>3</v></c></row></sheetData></worksheet>`,
 'xl/worksheets/sheet2.xml':`<worksheet xmlns="${S}"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Second sheet retained</t></is></c></row></sheetData></worksheet>`,
 'xl/calcChain.xml':`<calcChain xmlns="${S}"><c r="D1" i="1"/></calcChain>`,
 'customXml/proof.xml':'<mouse-fixture version="625">Unknown Excel part must remain byte-identical.</mouse-fixture>',
 'xl/printerSettings/printerSettings1.bin':Buffer.from([25,6,0,255,128,10,13])
};}
async function createFixtures(directory){
 await fs.mkdir(directory,{recursive:true});const word=docx(),sheet=xlsx(),bytes={pdf:pdf(),docx:packageZip(word),xlsx:packageZip(sheet),private:Buffer.from('Private document fixture\n')};const paths={};
 for(const [kind,data]of Object.entries(bytes)){paths[kind]=path.join(directory,'Mouse625-original.'+(kind==='private'?'txt':kind));await fs.writeFile(paths[kind],data,{flag:'wx'});}
 return{paths,bytes,parts:{docx:word,xlsx:sheet},hashes:Object.fromEntries(Object.entries(bytes).map(([kind,data])=>[kind,hash(data)]))};
}
module.exports={createFixtures,packageZip,hash};
