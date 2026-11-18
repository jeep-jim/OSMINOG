'use strict';
(function(root){
 // A deliberately bounded expression interpreter. It never evaluates JavaScript,
 // resolves names, loads external workbooks, or substitutes cached formula values.
 // Operator order: https://support.microsoft.com/en-us/excel/calculation-operators-and-precedence-in-excel
 const LIMITS=Object.freeze({length:4096,tokens:2048,depth:64,cells:10000,range:10000,string:32767});
 class Fault extends Error{constructor(code,message,status='error'){super(message);this.code=code;this.status=status;}}
 const fail=(code,message,status)=>{throw new Fault(code,message,status);};
 const unsupported=message=>fail('#UNSUPPORTED!',message,'unsupported');
 const finite=n=>{if(!Number.isFinite(n))fail('#NUM!','Число вне поддерживаемого диапазона');return n;};
 function address(value){const m=/^\$?([A-Z]{1,3})\$?([1-9]\d{0,6})$/i.exec(String(value));if(!m)return null;let col=0;for(const c of m[1].toUpperCase())col=col*26+c.charCodeAt(0)-64;const row=Number(m[2]);return col<=16384&&row<=1048576?{col,row,ref:column(col)+row}:null;}
 function column(n){let s='';while(n>0){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;}
 function tokenize(value,limits){
  if(typeof value!=='string'||value.length>limits.length)unsupported('Формула слишком длинная');const text=value.startsWith('=')?value.slice(1):value,tokens=[];let pos=0;
  while(pos<text.length){if(/\s/.test(text[pos])){pos++;continue;}if(tokens.length>=limits.tokens)unsupported('Слишком много частей формулы');const tail=text.slice(pos),c=text[pos];
   if(c==='"'||c==="'"){let result='',closed=false;pos++;while(pos<text.length){if(text[pos]===c){if(text[pos+1]===c){result+=c;pos+=2;continue;}pos++;closed=true;break;}result+=text[pos++];}if(!closed)unsupported('Незакрытая строка в формуле');tokens.push({type:c==='"'?'string':'sheet',value:result});continue;}
   let m=/^(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?/.exec(tail);if(m){tokens.push({type:'number',value:finite(Number(m[0]))});pos+=m[0].length;continue;}
   m=/^#(?:REF!|DIV\/0!|VALUE!|NAME\?|N\/A|NUM!|NULL!)/i.exec(tail);if(m){tokens.push({type:'error',value:m[0].toUpperCase()});pos+=m[0].length;continue;}
   m=/^(?:\$?[\p{L}_][\p{L}\p{N}_.$]*)/u.exec(tail);if(m){tokens.push({type:'word',value:m[0]});pos+=m[0].length;continue;}
   m=/^(?:<=|>=|<>|[+\-*/^%&=<>():,!])/.exec(tail);if(m){tokens.push({type:'operator',value:m[0]});pos+=m[0].length;continue;}
   unsupported('Неподдерживаемый синтаксис формулы');
  }tokens.push({type:'end',value:''});return tokens;
 }
 function parse(text,limits=LIMITS){
  const tokens=tokenize(text,limits);let pos=0;const peek=()=>tokens[pos],take=()=>tokens[pos++],expect=value=>{if(take().value!==value)unsupported('Неверный синтаксис формулы');};
  const precedence={'=':10,'<>':10,'<':10,'>':10,'<=':10,'>=':10,'&':15,'+':20,'-':20,'*':30,'/':30,'^':40};
  function reference(token,sheet){const ref=address(token.value);if(!ref)unsupported('Именованные диапазоны и внешние ссылки не пересчитываются');return{type:'reference',sheet,ref:ref.ref};}
  function primary(depth){if(depth>limits.depth)unsupported('Формула слишком вложенная');const token=take();let node;
   if(token.type==='number'||token.type==='string')node={type:'literal',value:token.value};
   else if(token.type==='error')node={type:'error',value:token.value};
   else if(token.value==='+'||token.value==='-')node={type:'unary',op:token.value,child:expression(50,depth+1)};
   else if(token.value==='('){node=expression(0,depth+1);expect(')');}
   else if(token.type==='word'||token.type==='sheet'){
    if(peek().value==='!'){take();node=reference(take(),token.value);}
    else if(token.type==='word'&&peek().value==='('){take();const args=[];if(peek().value!==')')while(true){if(args.length>=255)unsupported('Слишком много аргументов');args.push(expression(0,depth+1));if(peek().value!==',')break;take();}expect(')');node={type:'call',name:token.value.toUpperCase(),args};}
    else if(token.type==='word'&&/^(TRUE|FALSE)$/i.test(token.value))node={type:'literal',value:token.value.toUpperCase()==='TRUE'};
    else node=reference(token);
   }else unsupported('Неверный синтаксис формулы');
   if(peek().value===':'){if(node.type!=='reference')unsupported('Неверный диапазон');take();let token=take(),sheet=node.sheet;if(peek().value==='!'){take();sheet=token.value;token=take();}const end=reference(token,sheet);if(end.sheet!==node.sheet)unsupported('Трёхмерные диапазоны не пересчитываются');node={type:'range',start:node,end};}return node;
  }
  function expression(min,depth){let left=primary(depth);while(true){const op=peek().value;if(op==='%'&&60>=min){take();left={type:'percent',child:left};continue;}const level=precedence[op];if(level===undefined||level<min)break;take();left={type:'binary',op,left,right:expression(level+1,depth+1)};}return left;}
  const result=expression(0,0);if(peek().type!=='end')unsupported('Неподдерживаемый синтаксис формулы');return result;
 }
 const scalar=(value,reference=false)=>({type:value===null||value===undefined?'blank':typeof value,value:value??null,reference});
 function numeric(value){if(value.type==='range')fail('#VALUE!','Ожидается одна ячейка');if(value.type==='blank')return 0;if(value.type==='boolean')return value.value?1:0;if(value.type==='number')return finite(value.value);if(value.type==='string'&&value.value.trim()!==''&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.value.trim()))return finite(Number(value.value));fail('#VALUE!','Значение не является числом');}
 function truth(value){if(value.type==='string'&&/^(TRUE|FALSE)$/i.test(value.value))return value.value.toUpperCase()==='TRUE';return numeric(value)!==0;}
 const string=value=>{if(value.type==='range')fail('#VALUE!','Ожидается одна ячейка');return value.type==='blank'?'':value.type==='boolean'?(value.value?'TRUE':'FALSE'):String(value.value);};
 function round(number,digits){digits=Math.trunc(digits);if(Math.abs(digits)>308)return digits>0?number:0;const shift=(n,d)=>{const [base,exp]=n.toString().split('e');return Number(base+'e'+(Number(exp||0)+d));},shifted=shift(Math.abs(number),digits);if(!Number.isFinite(shifted))return number;return finite(Math.sign(number)*shift(Math.floor(shifted+.5),-digits));}
 function createEvaluator({getCell=()=>null,hasSheet=()=>true,limits={}}={}){
  const bound={...LIMITS};for(const key of Object.keys(bound))if(Number.isInteger(limits[key])&&limits[key]>0)bound[key]=Math.min(bound[key],limits[key]);
  const cache=new Map(),compiled=new Map();let visited=0,active=new Set();
  function tick(depth){if(depth>bound.depth||++visited>bound.cells)unsupported('Превышен предел пересчёта');}
  function ast(text){if(!compiled.has(text)){if(compiled.size>=256)compiled.delete(compiled.keys().next().value);compiled.set(text,parse(text,bound));}return compiled.get(text);}
  function cell(sheet,ref,depth){tick(depth);const addr=address(ref);if(!addr||!hasSheet(sheet))fail('#REF!','Лист или ячейка не найдены');const key=sheet.toLocaleLowerCase()+'\0'+addr.ref;if(active.has(key))fail('#CYCLE!','Циклическая ссылка');if(cache.has(key)){const item=cache.get(key);if(item instanceof Fault)throw item;return{...item,reference:true};}
   active.add(key);try{const item=getCell(sheet,addr.ref);let result;if(item?.blocked)unsupported(item.blocked);if(item?.formula!==undefined&&item.formula!==null)result=run(ast(item.formula),sheet,depth+1);else if(item?.type==='error')fail(String(item.value||'#VALUE!'),'Ошибка в исходной ячейке');else result=scalar(item&&typeof item==='object'?item.value:item);if(result.type==='range')unsupported('Массивы не пересчитываются');cache.set(key,result);return{...result,reference:true};}catch(error){if(error instanceof Fault)cache.set(key,error);throw error;}finally{active.delete(key);}
  }
  function rangeValues(node,sheet,depth,ignoreErrors=false){const a=address(node.start.ref),b=address(node.end.ref),r0=Math.min(a.row,b.row),r1=Math.max(a.row,b.row),c0=Math.min(a.col,b.col),c1=Math.max(a.col,b.col);if((r1-r0+1)*(c1-c0+1)>bound.range)unsupported('Диапазон слишком большой');const values=[];for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++){try{values.push(cell(node.start.sheet??sheet,column(c)+r,depth+1));}catch(error){if(!ignoreErrors||!(error instanceof Fault)||error.status!=='error'||error.code==='#CYCLE!')throw error;}}return values;}
  function run(node,sheet,depth){tick(depth);
   if(node.type==='literal')return scalar(node.value);
   if(node.type==='error')fail(node.value,'Ошибка в формуле');
   if(node.type==='reference')return cell(node.sheet??sheet,node.ref,depth+1);
   if(node.type==='range')return{type:'range',values:rangeValues(node,sheet,depth)};
   if(node.type==='unary')return scalar(finite((node.op==='-'?-1:1)*numeric(run(node.child,sheet,depth+1))));
   if(node.type==='percent')return scalar(numeric(run(node.child,sheet,depth+1))/100);
   if(node.type==='binary'){let left=run(node.left,sheet,depth+1),right=run(node.right,sheet,depth+1);const op=node.op;
    if(op==='&'){const value=string(left)+string(right);if(value.length>bound.string)fail('#VALUE!','Слишком длинная строка');return scalar(value);}
    if(['=','<>','<','>','<=','>='].includes(op)){if(left.type==='range'||right.type==='range')unsupported('Сравнение массивов не поддерживается');if(left.type==='blank')left=scalar(right.type==='string'?'':right.type==='boolean'?false:0);if(right.type==='blank')right=scalar(left.type==='string'?'':left.type==='boolean'?false:0);const rank={number:0,string:1,boolean:2},a=left.type==='string'?left.value.toLocaleLowerCase():left.value,b=right.type==='string'?right.value.toLocaleLowerCase():right.value,cmp=left.type===right.type?(a===b?0:a<b?-1:1):rank[left.type]<rank[right.type]?-1:1;return scalar(op==='='?cmp===0:op==='<>'?cmp!==0:op==='<'?cmp<0:op==='>'?cmp>0:op==='<='?cmp<=0:cmp>=0);}
    const a=numeric(left),b=numeric(right);if(op==='/'&&b===0)fail('#DIV/0!','Деление на ноль');return scalar(finite(op==='+'?a+b:op==='-'?a-b:op==='*'?a*b:op==='/'?a/b:Math.pow(a,b)));
   }
   if(node.type==='call'){const {name,args}=node;
    if(name==='IF'){if(args.length<2||args.length>3)fail('#VALUE!','IF ожидает два или три аргумента');return truth(run(args[0],sheet,depth+1))?run(args[1],sheet,depth+1):args[2]?run(args[2],sheet,depth+1):scalar(false);}
    if(name==='ROUND'){if(args.length!==2)fail('#VALUE!','ROUND ожидает два аргумента');return scalar(round(numeric(run(args[0],sheet,depth+1)),numeric(run(args[1],sheet,depth+1))));}
    if(!['SUM','AVERAGE','MIN','MAX','COUNT'].includes(name))unsupported('Функция '+name+' не пересчитывается в Mouse');
    const values=[];for(const arg of args){let result;try{result=name==='COUNT'&&arg.type==='range'?{type:'range',values:rangeValues(arg,sheet,depth,true)}:run(arg,sheet,depth+1);}catch(error){if(name==='COUNT'&&error instanceof Fault&&error.status==='error'&&error.code!=='#CYCLE!')continue;throw error;}for(const value of result.type==='range'?result.values:[result]){if(value.type==='number')values.push(value.value);else if(value.reference||value.type==='blank')continue;else if(name==='COUNT'){try{values.push(numeric(value));}catch{}}else values.push(numeric(value));}}
    if(name==='COUNT')return scalar(values.length);if(name==='AVERAGE'&&!values.length)fail('#DIV/0!','Нет чисел для среднего');let total=0,min=Infinity,max=-Infinity;for(const n of values){if(name==='SUM'||name==='AVERAGE')total=finite(total+n);min=Math.min(min,n);max=Math.max(max,n);}return scalar(name==='SUM'?total:name==='AVERAGE'?finite(total/values.length):name==='MIN'?(values.length?min:0):(values.length?max:0));
   }unsupported('Неподдерживаемая формула');
  }
  function result(fn){visited=0;active=new Set();try{const value=fn();if(value.type==='range')unsupported('Массивы не пересчитываются');return{status:'calculated',value:value.type==='blank'?0:value.value};}catch(error){if(error instanceof Fault)return{status:error.status,error:error.code,message:error.message};return{status:'error',error:'#VALUE!',message:'Не удалось пересчитать формулу'};}}
  return{formula:(text,sheet='')=>result(()=>run(ast(text),sheet,0)),cell:(sheet,ref)=>result(()=>cell(sheet,ref,0)),reset(){cache.clear();compiled.clear();}};
 }
 const api={LIMITS,address,column,parse,createEvaluator,evaluate:(formula,options={})=>createEvaluator(options).formula(formula,options.sheet||'')};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.MouseDocumentFormulas=Object.freeze(api);
})(globalThis);
