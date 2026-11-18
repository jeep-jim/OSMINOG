'use strict';
// Exact content-stream edits, not paint-over annotations. PDF text is positioned
// glyph runs, not paragraphs: preserve each run's final advance so later text,
// paths and images keep their original positions (ISO 32000-1, 9.4.3/9.4.4).
(function(root){
 const MAX_CONTENT=8*1024*1024,MAX_TOKENS=250000,MAX_GLYPHS=65536,MAX_RUNS=3000;
 const identity=()=>[1,0,0,1,0,0];
 const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
 const point=(m,x,y)=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
 const hex=bytes=>Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('').toUpperCase();
 const binary=bytes=>{let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return s;};
 const rawBytes=s=>Uint8Array.from(s,c=>c.charCodeAt(0)&255);
 const numeric=n=>{if(!Number.isFinite(n)||Math.abs(n)>1e9)throw Error('Слишком большое смещение текста PDF');return Number(n.toFixed(7)).toString();};
 const name=n=>'/'+n.replace(/[^!-~]|[#%()/<>\[\]{}]/g,c=>'#'+c.charCodeAt(0).toString(16).padStart(2,'0'));
 const fail=message=>{throw Error(message);};
 function tokenize(source){
  let i=0,count=0;const whitespace=c=>c!==undefined&&/[\x00\t\n\f\r ]/.test(c),delimiter=c=>c===undefined||whitespace(c)||'()<>[]{}/%'.includes(c);
  function skip(){while(i<source.length){if(whitespace(source[i])){i++;continue;}if(source[i]==='%'){while(i<source.length&&!/[\r\n]/.test(source[i]))i++;continue;}break;}}
  function token(depth=0){
   if(depth>24||++count>MAX_TOKENS)fail('Слишком сложная структура текста PDF');
   skip();
   if(i>=source.length)return null;const start=i,c=source[i++];
   if(c==='('){let nesting=1;const bytes=[];while(i<source.length&&nesting){let ch=source[i++];if(ch==='\\'){if(i===source.length)fail('Незавершённая строка PDF');ch=source[i++];if(ch==='\r'||ch==='\n'){if(ch==='\r'&&source[i]==='\n')i++;continue;}if(/[0-7]/.test(ch)){let oct=ch;for(let k=0;k<2&&/[0-7]/.test(source[i]||'x');k++)oct+=source[i++];bytes.push(parseInt(oct,8)&255);continue;}bytes.push(({n:10,r:13,t:9,b:8,f:12})[ch]??ch.charCodeAt(0));continue;}if(ch==='(')nesting++;if(ch===')'&&!--nesting)break;if(ch==='\r'){if(source[i]==='\n')i++;bytes.push(10);}else bytes.push(ch.charCodeAt(0));}if(nesting)fail('Незавершённая строка PDF');return{kind:'string',bytes:Uint8Array.from(bytes),start,end:i};}
   if(c==='<'&&source[i]!=='<'){let value='';while(i<source.length&&source[i]!=='>'){if(!whitespace(source[i]))value+=source[i];i++;}if(source[i++]!=='>'||/[^\da-f]/i.test(value))fail('Неверная строка PDF');if(value.length%2)value+='0';return{kind:'string',bytes:Uint8Array.from(value.match(/../g)||[],v=>parseInt(v,16)),start,end:i};}
   if(c==='['||(c==='<'&&source[i]==='<')){const dictionary=c==='<';if(dictionary)i++;const value=[];while(i<source.length){skip();if(dictionary?source.slice(i,i+2)==='>>':source[i]===']'){i+=dictionary?2:1;return{kind:dictionary?'dict':'array',value,start,end:i};}const child=token(depth+1);if(!child)break;value.push(child);}fail('Незавершённый объект PDF');}
   if(c==='/'){let value='';while(!delimiter(source[i]))value+=source[i++];return{kind:'name',value:value.replace(/#([\da-f]{2})/ig,(_,h)=>String.fromCharCode(parseInt(h,16))),start,end:i};}
   if(']>}'.includes(c))fail('Неверная структура PDF');
   let value=c;while(!delimiter(source[i]))value+=source[i++];return{kind:/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(value)?'number':'operator',value:/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(value)?Number(value):value,start,end:i};
  }
  const tokens=[];for(let t;(t=token());){tokens.push(t);if(t.kind==='operator'&&t.value==='BI')fail('В этой странице встроенные изображения особого формата: редактирование исходного текста пока недоступно');}return tokens;
 }
 function unicode(bytes){if(bytes.length%2)return null;let s='';for(let i=0;i<bytes.length;i+=2)s+=String.fromCharCode(bytes[i]*256+bytes[i+1]);if(s.startsWith('\uFEFF'))s=s.slice(1);return s&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffd]/.test(s)?s:null;}
 function parseCMap(source){
  const tokens=tokenize(source),map=new Map();
  const add=(src,dst)=>{const value=unicode(dst);if(!src.length||src.length>4||!value||map.size>=MAX_GLYPHS)fail('Неподдерживаемая таблица символов PDF');map.set(hex(src),value);};
  for(let i=0;i<tokens.length;i++){
   const t=tokens[i];if(t.value==='usecmap')fail('Составная таблица символов PDF пока не поддерживается');
   if(t.value==='beginbfchar'){const count=tokens[i-1]?.value;if(!Number.isInteger(count)||count<0||count>MAX_GLYPHS)fail('Неверная таблица символов PDF');for(let j=0;j<count;j++){const a=tokens[++i],b=tokens[++i];if(a?.kind!=='string'||b?.kind!=='string')fail('Неверная таблица символов PDF');add(a.bytes,b.bytes);}}
   if(t.value==='beginbfrange'){const count=tokens[i-1]?.value;if(!Number.isInteger(count)||count<0||count>MAX_GLYPHS)fail('Неверная таблица символов PDF');for(let j=0;j<count;j++){const a=tokens[++i],b=tokens[++i],dst=tokens[++i];if(a?.kind!=='string'||b?.kind!=='string'||a.bytes.length!==b.bytes.length||a.bytes.length>4)fail('Неверная таблица символов PDF');const start=parseInt(hex(a.bytes),16),end=parseInt(hex(b.bytes),16);if(end<start||end-start>MAX_GLYPHS)fail('Слишком большая таблица символов PDF');if(dst?.kind==='array'&&dst.value.length!==end-start+1)fail('Неверная таблица символов PDF');for(let code=start;code<=end;code++){const src=Uint8Array.from((code.toString(16).padStart(a.bytes.length*2,'0')).match(/../g),v=>parseInt(v,16));let out;if(dst?.kind==='array'){if(dst.value[code-start]?.kind!=='string')fail('Неверная таблица символов PDF');out=dst.value[code-start].bytes;}else if(dst?.kind==='string'){out=dst.bytes.slice();let carry=code-start;for(let k=out.length-1;k>=0&&carry;k--){carry+=out[k];out[k]=carry&255;carry>>>=8;}if(carry)fail('Неверная таблица символов PDF');}else fail('Неверная таблица символов PDF');add(src,out);}}}
  }
  if(!map.size)fail('У шрифта нет доступной таблицы символов');return map;
 }
 function decodedStream(P,stream){if(stream instanceof P.PDFRawStream)return P.decodePDFRawStream(stream).decode();if(typeof stream?.getUnencodedContents==='function')return stream.getUnencodedContents();fail('Неподдерживаемый поток PDF');}
 function codec(P,context,font){
  const N=P.PDFName.of,get=(d,k)=>d?.lookup(N(k)),num=(d,k,fallback)=>{const n=get(d,k);return n instanceof P.PDFNumber?n.asNumber():fallback;},fontName=get(font,'BaseFont')?.decodeText?.()||'',subtype=get(font,'Subtype')?.decodeText?.(),encoding=get(font,'Encoding');
  if(!['Type0','Type1','TrueType'].includes(subtype))fail('Этот тип шрифта пока не поддерживается');
  const isCID=subtype==='Type0';if(isCID&&encoding?.decodeText?.()!=='Identity-H')fail('Вертикальная или составная кодировка пока не поддерживается');
  let widths,first=0,defaultWidth=0,cidWidths=new Map(),standard=null;
  if(isCID){const descendant=get(font,'DescendantFonts')?.lookup?.(0);if(!(descendant instanceof P.PDFDict))fail('Неверный составной шрифт PDF');defaultWidth=num(descendant,'DW',1000);const w=get(descendant,'W');if(w instanceof P.PDFArray){for(let i=0;i<w.size();){const start=w.lookup(i++)?.asNumber?.(),entry=w.lookup(i++);if(!Number.isInteger(start)||start<0||start>65535)fail('Неверные размеры шрифта PDF');if(entry instanceof P.PDFArray){if(start+entry.size()>65536)fail('Слишком большая таблица шрифта');for(let j=0;j<entry.size();j++){const width=entry.lookup(j)?.asNumber?.();if(!Number.isFinite(width))fail('Неверные размеры шрифта PDF');cidWidths.set(start+j,width);}}else{const end=entry?.asNumber?.(),width=w.lookup(i++)?.asNumber?.();if(!Number.isInteger(end)||end<start||end>65535||!Number.isFinite(width))fail('Неверные размеры шрифта PDF');for(let c=start;c<=end;c++)cidWidths.set(c,width);}}}}
  else{widths=get(font,'Widths');first=num(font,'FirstChar',0);defaultWidth=num(get(font,'FontDescriptor'),'MissingWidth',NaN);if(Object.values(P.StandardFonts).includes(fontName))standard=P.StandardFontEmbedder.for(fontName);}
  let map;const cmap=get(font,'ToUnicode');if(cmap){const decoded=decodedStream(P,cmap);if(decoded.length>MAX_CONTENT)fail('Слишком большая таблица символов PDF');map=parseCMap(binary(decoded));}
  else if(!isCID){
   const enc=encoding instanceof P.PDFDict?get(encoding,'BaseEncoding')?.decodeText?.():encoding?.decodeText?.();if(encoding instanceof P.PDFDict&&get(encoding,'Differences'))fail('У шрифта нет однозначной таблицы символов');if(!['WinAnsiEncoding','StandardEncoding',undefined].includes(enc)||(!encoding&&!standard))fail('У шрифта нет однозначной таблицы символов');map=new Map();
   if(enc==='WinAnsiEncoding'){const win=P.StandardFontEmbedder.for('Helvetica').encoding;for(const cp of win.supportedCodePoints){const code=win.encodeUnicodeCodePoint(cp).code;if(code>=32)map.set(code.toString(16).padStart(2,'0').toUpperCase(),String.fromCodePoint(cp));}}
   else if(standard&&!['Symbol','ZapfDingbats'].includes(fontName)){for(let code=32;code<127;code++)map.set(code.toString(16).padStart(2,'0').toUpperCase(),code===39?'\u2019':code===96?'\u2018':String.fromCharCode(code));}
   else fail('У шрифта нет однозначной таблицы символов');
  }else fail('У шрифта нет таблицы Unicode');
  const lengths=new Set([...map.keys()].map(k=>k.length/2));if(lengths.size!==1)fail('Переменная длина кодов шрифта пока не поддерживается');const codeSize=[...lengths][0];if(isCID?codeSize!==2:codeSize!==1)fail('Неоднозначная кодировка шрифта PDF');
  const reverse=new Map(),observed=new Set();for(const [key,value]of map)if(!reverse.has(value))reverse.set(value,key);
  const width=(code,text)=>{if(isCID)return cidWidths.get(code)??defaultWidth;if(widths instanceof P.PDFArray){const value=widths.lookup(code-first)?.asNumber?.();if(Number.isFinite(value))return value;}if(standard&&[...text].length===1){try{return standard.widthOfTextAtSize(text,1000);}catch{}}if(Number.isFinite(defaultWidth))return defaultWidth;fail('Нет точных размеров символов шрифта');};
  function decode(bytes){if(bytes.length%codeSize)fail('Неполный код символа PDF');const glyphs=[];let text='';for(let i=0;i<bytes.length;i+=codeSize){const key=hex(bytes.subarray(i,i+codeSize)),value=map.get(key);if(value===undefined)fail('В тексте есть символы без таблицы Unicode');const code=parseInt(key,16);glyphs.push({code,width:width(code,value),space:codeSize===1&&code===32});text+=value;observed.add(key);}return{text,glyphs};}
  function encode(text){let encoded='';for(const c of text){const key=reverse.get(c);if(!key||(!cmap&&!standard&&!observed.has(key)))return null;encoded+=key;}const bytes=Uint8Array.from(encoded.match(/../g)||[],v=>parseInt(v,16));return{hex:encoded,...decode(bytes)};}
  return{decode,encode,name:fontName,isCID};
 }
 async function inspect(P,doc,pageNumber){
  const target=doc.getPage(pageNumber-1),context=doc.context,N=P.PDFName.of,resources=target.node.Resources(),fonts=resources?.lookup(N('Font')),contents=target.node.Contents(),streams=contents instanceof P.PDFArray?contents.asArray():contents?[contents]:[];
  let source='';for(const ref of streams){const data=decodedStream(P,context.lookup(ref));if(source.length+data.length>MAX_CONTENT)fail('Страница слишком велика для редактирования текста');source+=binary(data)+'\n';}
  const digest=hex(new Uint8Array(await root.crypto.subtle.digest('SHA-256',rawBytes(source)))),tokens=tokenize(source),runs=[],unsupported=[];let operands=[],active=false,textObjectUnsafe=false,textObjectStart=0,marked=[],stack=[],state={ctm:identity(),tm:identity(),line:identity(),font:'',size:0,char:0,word:0,hscale:1,rise:0,leading:0,mode:0,positionKnown:true},fontCache=new Map();
  const copy=s=>({...s,ctm:[...s.ctm],tm:[...s.tm],line:[...s.line]});
  const nextLine=(x,y)=>{state.line=multiply(state.line,[1,0,0,1,x,y]);state.tm=[...state.line];state.positionKnown=true;};
  const fontCodec=()=>{if(!fontCache.has(state.font)){try{const font=fonts?.lookup(N(state.font));if(!(font instanceof P.PDFDict))fail('Шрифт фрагмента не найден');fontCache.set(state.font,codec(P,context,font));}catch(error){fontCache.set(state.font,error);}}const item=fontCache.get(state.font);if(item instanceof Error)throw item;return item;};
  for(const t of tokens){if(t.kind!=='operator'){operands.push(t);if(operands.length>10000)fail('Слишком много операндов PDF');continue;}const op=t.value,values=operands.map(v=>v.value),numbers=count=>operands.length===count&&operands.every(v=>v.kind==='number'&&Number.isFinite(v.value)),start=operands[0]?.start??t.start;
   // q/Q inside BT differs between legacy PDF and the PDF 2.0 errata. Do not
   // offer a fragment if its geometry depends on that ambiguous combination.
   if(active&&(op==='q'||op==='Q')){textObjectUnsafe=true;runs.length=textObjectStart;}
   if(op==='q'){if(stack.length>=64)fail('Слишком глубокое состояние PDF');stack.push(copy(state));}
   else if(op==='Q'){if(!stack.length)fail('Неверное состояние PDF');state=stack.pop();}
   else if(op==='cm'){if(!numbers(6))fail('Неверная матрица PDF');state.ctm=multiply(state.ctm,values);}
   else if(op==='BT'){if(active)fail('Вложенный текстовый блок PDF');active=true;textObjectUnsafe=false;textObjectStart=runs.length;state.tm=state.line=identity();state.positionKnown=true;}
   else if(op==='ET')active=false;
   else if(op==='Tf'){if(operands.length!==2||operands[0].kind!=='name'||operands[1].kind!=='number')fail('Неверный шрифт PDF');state.font=values[0];state.size=values[1];}
   else if(['Tc','Tw','Tz','TL','Tr','Ts'].includes(op)){if(!numbers(1))fail('Неверные параметры текста PDF');state[({Tc:'char',Tw:'word',Tz:'hscale',TL:'leading',Tr:'mode',Ts:'rise'})[op]]=op==='Tz'?values[0]/100:values[0];}
   else if(op==='Tm'){if(!numbers(6))fail('Неверная позиция текста PDF');state.tm=[...values];state.line=[...values];state.positionKnown=true;}
   else if(op==='Td'||op==='TD'){if(!numbers(2))fail('Неверная позиция текста PDF');if(op==='TD')state.leading=-values[1];nextLine(...values);}
   else if(op==='T*')nextLine(0,-state.leading);
   else if(op==='gs'){const gs=resources?.lookup(N('ExtGState'))?.lookup?.(N(values[0]||''));if(gs?.get?.(N('Font')))state.font='';}
   else if(op==='BMC')marked.push(false);
   else if(op==='BDC'){const property=operands[1];let actual=false;if(property?.kind==='dict')actual=property.value.some(v=>v.kind==='name'&&v.value==='ActualText');else if(property?.kind==='name')actual=!!resources?.lookup(N('Properties'))?.lookup?.(N(property.value))?.get?.(N('ActualText'));else actual=true;marked.push(actual);}
   else if(op==='EMC')marked.pop();
   else if(['Tj','TJ',"'",'"'].includes(op)){
    let prefix='',parts;
    if(op==='"'){if(operands.length!==3||operands[0].kind!=='number'||operands[1].kind!=='number')fail('Неверный текстовый оператор PDF');state.word=values[0];state.char=values[1];prefix=numeric(state.word)+' Tw '+numeric(state.char)+' Tc T* ';nextLine(0,-state.leading);parts=[operands[2]];}
    else if(op==="'"){prefix='T* ';nextLine(0,-state.leading);parts=operands;}
    else parts=op==='TJ'&&operands[0]?.kind==='array'?operands[0].value:operands;
    try{
     if(!active||textObjectUnsafe||state.size<=0||state.hscale<=0||!state.positionKnown||state.mode>=3||marked.some(Boolean))fail('Скрытый текст, маска или специальная разметка PDF пока не редактируются');
     const font=fontCodec();let before='',advance=0;
     if(!parts.length||parts.some(p=>!['string','number'].includes(p.kind))||(op!=='TJ'&&(parts.length!==1||parts[0].kind!=='string')))fail('Неподдерживаемый текстовый оператор PDF');
     for(const part of parts){if(part.kind==='number')advance-=part.value*state.size/1000;else{const decoded=font.decode(part.bytes);before+=decoded.text;for(const glyph of decoded.glyphs)advance+=glyph.width*state.size/1000+state.char+(glyph.space?state.word:0);}}
     if(before.length>4000)fail('Слишком длинный фрагмент текста PDF');
     const matrix=multiply(state.ctm,state.tm),corners=[[0,state.rise-state.size*.25],[advance*state.hscale,state.rise-state.size*.25],[advance*state.hscale,state.rise+state.size],[0,state.rise+state.size]].map(p=>point(matrix,...p));
     if(before.trim()){if(runs.length>=MAX_RUNS)fail('Слишком много текстовых фрагментов на странице');runs.push({sourceId:pageNumber+':'+start+':'+t.end+':'+digest,page:pageNumber,before,sourceFont:font.name,corners,start,end:t.end,prefix,advance,state:copy(state),font});}
     state.tm=multiply(state.tm,[1,0,0,1,advance*state.hscale,0]);
    }catch(error){unsupported.push(error.message);state.positionKnown=false;}
   }
   operands=[];
  }
  return{page:pageNumber,source,runs,unsupported:[...new Set(unsupported)],hasForms:tokens.some(t=>t.kind==='operator'&&t.value==='Do')};
 }
 async function open({bytes,PDFLib:P}){
  const doc=await P.PDFDocument.load(bytes.slice(),{updateMetadata:false});let cached=null;
  return{async inspectPage(page){if(cached?.page!==page)cached=await inspect(P,doc,page);return cached;},dispose(){cached=null;}};
 }
 async function apply({document:doc,edits,PDFLib:P,loadFallback}){
  const selected=new Map();for(const e of edits||[])if(e.type==='replace')selected.set(e.sourceId,e);
  if(!selected.size)return{replacements:0,fallbacks:0};const pages=new Map();for(const e of selected.values()){if(!pages.has(e.page))pages.set(e.page,[]);pages.get(e.page).push(e);}
  let fallback=null,fallbacks=0;const prepared=[];
  for(const [pageNumber,changes]of pages){const info=await inspect(P,doc,pageNumber),patches=[],target=doc.getPage(pageNumber-1);let fallbackName;
   for(const e of changes){const run=info.runs.find(r=>r.sourceId===e.sourceId);if(!run||run.before!==e.before)fail('Исходный фрагмент PDF изменился. Откройте документ заново: замена не сохранена');if(typeof e.text!=='string'||e.text.length>4000||/[\r\n\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(e.text))fail('Замена PDF должна быть одной строкой до 4000 символов');
    let encoded=run.font.encode(e.text),advance=0,body;
    if(encoded){for(const glyph of encoded.glyphs)advance+=glyph.width*run.state.size/1000+run.state.char+(glyph.space?run.state.word:0);body='[<'+encoded.hex+'> '+numeric((advance-run.advance)*1000/run.state.size)+'] TJ';}
    else{
     if(!fallback){if(!loadFallback)fail('Для новых символов нужен встроенный шрифт');fallback=await loadFallback(doc);}
     const supported=new Set(fallback.getCharacterSet());if([...e.text].some(c=>!supported.has(c.codePointAt(0))))fail('Встроенный шрифт не содержит все символы замены');
     if(!fallbackName){const N=P.PDFName.of,resources=(target.node.Resources()||doc.context.obj({})).clone(doc.context),fonts=(resources.lookup(N('Font'))||doc.context.obj({})).clone(doc.context);resources.set(N('Font'),fonts);target.node.set(N('Resources'),resources);fallbackName=fonts.uniqueKey('MouseText');fonts.set(fallbackName,fallback.ref);}
     encoded=fallback.encodeText(e.text);const glyphCount=encoded.asBytes().length/2;
     advance=fallback.widthOfTextAtSize(e.text,run.state.size)+glyphCount*run.state.char;
     body=String(fallbackName)+' '+numeric(run.state.size)+' Tf ['+String(encoded)+' '+numeric((advance-run.advance)*1000/run.state.size)+'] TJ '+name(run.state.font)+' '+numeric(run.state.size)+' Tf';fallbacks++;
    }
    patches.push({start:run.start,end:run.end,text:run.prefix+body});
   }
   let source=info.source;for(const patch of patches.sort((a,b)=>b.start-a.start))source=source.slice(0,patch.start)+patch.text+source.slice(patch.end);prepared.push({target,source});
  }
  // Commit only after every source identity and replacement has been validated.
  for(const {target,source}of prepared)target.node.set(P.PDFName.of('Contents'),doc.context.obj([doc.context.register(doc.context.flateStream(rawBytes(source)))]));
  return{replacements:selected.size,fallbacks};
 }
 const api={open,apply,inspect,tokenize,parseCMap,MAX_CONTENT,MAX_RUNS};root.MousePDFText=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
