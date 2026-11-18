'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),F=require('./mouse/document-formulas.js');
const value=(formula,options)=>{const result=F.evaluate(formula,options);assert.equal(result.status,'calculated',result.message);return result.value;};
test('bounded interpreter implements spreadsheet arithmetic precedence, percentages and comparison without JS coercion',()=>{
 assert.equal(value('=2+3*4'),14);assert.equal(value('=(2+3)*4'),20);assert.equal(value('=-2^2'),4);assert.equal(value('=2^3^2'),64);assert.equal(value('=200*10%'),20);assert.equal(value('="2"=2'),false);assert.equal(value('="a"="A"'),true);assert.equal(value('="x"&2'), 'x2');assert.equal(value('=1<=2'),true);
 assert.equal(F.evaluate('=1/0').error,'#DIV/0!');assert.equal(F.evaluate('=1e309').error,'#NUM!');assert.equal(F.evaluate('=(-1)^0.5').error,'#NUM!');
});
test('references, absolute addresses, quoted sheet names and ranges calculate real dependencies instead of cached results',()=>{
 const book={Main:{A1:{value:3},A2:{value:5},B1:{formula:'A1+A2',value:999}},"Расчёт '2'":{A1:{value:4}}},options={sheet:'Main',hasSheet:name=>Object.hasOwn(book,name),getCell:(name,ref)=>book[name]?.[ref]};
 assert.equal(value('=$A$1+B1',options),11);assert.equal(value("=B1+'Расчёт ''2'''!A1",options),12);assert.equal(value('=SUM(A1:A2)',options),8);assert.equal(F.evaluate('=Missing!A1',options).error,'#REF!');
 assert.deepEqual(F.address('$XFD$1048576'),{col:16384,row:1048576,ref:'XFD1048576'});assert.equal(F.address('XFE1'),null);assert.equal(F.address('A1048577'),null);
});
test('aggregates, lazy IF and ROUND handle spreadsheet values and negative half rounding',()=>{
 const cells={A1:{value:2},A2:{value:'3'},A3:{value:true},A4:{value:null},A5:{value:6},A6:{type:'error',value:'#N/A'}},options={getCell:(_sheet,ref)=>cells[ref]};
 assert.equal(value('=SUM(A1:A5)',options),8);assert.equal(value('=AVERAGE(A1:A5)',options),4);assert.equal(value('=MIN(A1:A5)',options),2);assert.equal(value('=MAX(A1:A5)',options),6);assert.equal(value('=COUNT(A1:A6)',options),2);assert.equal(value('=COUNT(A1:A5,"9",TRUE)',options),4);assert.equal(value('=SUM("3",TRUE,2)',options),6);
 assert.equal(value('=IF(2>1,10,1/0)'),10);assert.equal(value('=IF(FALSE,1/0,20)'),20);assert.equal(value('=IF(FALSE,10)'),false);assert.equal(value('=ROUND(-1.5,0)'),-2);assert.equal(value('=ROUND(1.005,2)'),1.01);assert.equal(value('=ROUND(125,-1)'),130);assert.equal(value('=MAX(1e308,1e308)'),1e308);
 assert.equal(F.evaluate('=AVERAGE(A2:A4)',options).error,'#DIV/0!');assert.equal(F.evaluate('=SUM(A1:A6)',options).error,'#N/A');
});
test('cycles, unsupported functions and unsupported dependencies never use cached formula output',()=>{
 const cells={A1:{formula:'B1+1',value:10},B1:{formula:'A1+1',value:20},C1:{formula:'VLOOKUP(A1,A1:B2,2)',value:42},D1:{blocked:'Shared formula',value:9}};
 assert.equal(F.evaluate('=A1',{getCell:(_s,ref)=>cells[ref]}).error,'#CYCLE!');assert.equal(F.evaluate('=C1+1',{getCell:(_s,ref)=>cells[ref]}).status,'unsupported');assert.equal(F.evaluate('=D1+1',{getCell:(_s,ref)=>cells[ref]}).status,'unsupported');assert.equal(value('=IF(TRUE,3,A1)',{getCell:(_s,ref)=>cells[ref]}),3);
});
test('malicious syntax, external workbooks and oversized expression/range graphs fail within bounds',()=>{
 for(const formula of ['=globalThis.process.exit()','=constructor.constructor("return process")()','=WEBSERVICE("https://example.test")','=SUM([Book.xlsx]Sheet1!A1)','=A:A','=1;fetch("https://example.test")'])assert.notEqual(F.evaluate(formula).status,'calculated',formula);
 assert.equal(F.evaluate('=SUM(A1:A10001)').status,'unsupported');assert.equal(F.evaluate('='.padEnd(F.LIMITS.length+2,'1')).status,'unsupported');assert.equal(F.evaluate('='.concat('('.repeat(100),'1',')'.repeat(100))).status,'unsupported');
 let reads=0;const result=F.evaluate('=SUM(A1:A50)',{limits:{cells:10},getCell(){reads++;return{value:1};}});assert.equal(result.status,'unsupported');assert.ok(reads<=10);
 const engine=F.createEvaluator({getCell:()=>({value:5})});assert.equal(engine.formula('=A1').value,5);engine.reset();assert.equal(engine.formula('=A1').value,5);
});
