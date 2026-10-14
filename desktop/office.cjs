'use strict';
const {inflateRawSync}=require('node:zlib');
// Read only the XML parts needed for a preview. Never execute macros or load external relationships.
function read(file){
 if(!(file?.data instanceof Uint8Array)||file.data.length>32*1024*1024)throw Error('Документ превышает 32 МБ');
 const b=Buffer.from(file.data);let end=-1;for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--)if(b.readUInt32LE(i)===0x06054b50){end=i;break}
 if(end<0)throw Error('Не удалось прочитать DOCX/XLSX: неверный ZIP');
 const count=b.readUInt16LE(end+10);let pos=b.readUInt32LE(end+16),total=0;const parts={};
 if(count>10000)throw Error('Слишком много частей документа');
 for(let i=0;i<count;i++){
  if(pos+46>b.length||b.readUInt32LE(pos)!==0x02014b50)throw Error('Повреждён каталог документа');
  const flags=b.readUInt16LE(pos+8),method=b.readUInt16LE(pos+10),compressed=b.readUInt32LE(pos+20),size=b.readUInt32LE(pos+24),n=b.readUInt16LE(pos+28),extra=b.readUInt16LE(pos+30),comment=b.readUInt16LE(pos+32),offset=b.readUInt32LE(pos+42);
  const name=b.subarray(pos+46,pos+46+n).toString('utf8');pos+=46+n+extra+comment;
  if(!/^(word\/document\.xml|xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/sheet\d+\.xml))$/.test(name))continue;
  if(flags&1||size>8*1024*1024||(total+=size)>24*1024*1024)throw Error('Документ защищён или слишком большой для просмотра');
  if(offset+30>b.length||b.readUInt32LE(offset)!==0x04034b50)throw Error('Повреждена часть документа');
  const start=offset+30+b.readUInt16LE(offset+26)+b.readUInt16LE(offset+28);if(start+compressed>b.length)throw Error('Неполный документ');
  const input=b.subarray(start,start+compressed),data=method===0?input:method===8?inflateRawSync(input,{maxOutputLength:8*1024*1024}):null;
  if(!data||data.length!==size)throw Error('Неверный формат сжатия');parts[name]=data.toString('utf8');
 }
 if(!parts['word/document.xml']&&!parts['xl/workbook.xml'])throw Error('Поддерживается просмотр DOCX и XLSX');return parts;
}
module.exports={read};
