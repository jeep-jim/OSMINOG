'use strict';
(function(root){
 const MAX_EDITS=1000,MAX_POINTS=20000,MAX_TEXT=120000,MAX_UNDO=40;
 const pageNumber=n=>Number.isInteger(n)&&n>=1&&n<=100000;
 const coordinate=n=>Number.isFinite(n)&&Math.abs(n)<=1000000;
 const color=s=>typeof s==='string'&&/^#[\da-f]{6}$/i.test(s);
 class PDFEdits{
  constructor(initial={}){this.edits=[];this.rotations={};this.history=[];this.points=0;this.characters=0;for(const edit of initial?.edits||[])this.append(edit);for(const [page,value]of Object.entries(initial?.rotations||{})){if(!pageNumber(Number(page))||![0,90,180,270].includes(value))throw Error('Неверный поворот страницы');this.rotations[page]=value;}this.history=[];}
  validate(e){if(!e||!pageNumber(e.page)||!color(e.color))throw Error('Неверная отметка PDF');if(this.edits.length>=MAX_EDITS)throw Error('Сохраните документ: предел 1000 отметок');if(e.type==='pen'){if(!Array.isArray(e.points)||!e.points.length||e.points.length>2000||e.points.some(p=>!Array.isArray(p)||p.length!==2||!p.every(coordinate))||!Number.isFinite(e.width)||e.width<=0||e.width>20)throw Error('Неверный штрих PDF');if(this.points+e.points.length>MAX_POINTS)throw Error('Сохраните документ: предел точек рисунка');}else if(e.type==='text'){if(!coordinate(e.x)||!coordinate(e.y)||!Number.isFinite(e.size)||e.size<6||e.size>72||typeof e.text!=='string'||e.text.length>4000)throw Error('Неверный текст PDF');if(this.characters+e.text.length>MAX_TEXT)throw Error('Сохраните документ: предел добавленного текста');}else if(e.type==='highlight'){if(![e.x,e.y,e.x2,e.y2].every(coordinate))throw Error('Неверная отметка PDF');}else throw Error('Неподдерживаемая отметка PDF');}
  checkpoint(page){this.history.push({length:this.edits.length,page,rotation:this.rotations[page]});if(this.history.length>MAX_UNDO)this.history.shift();}
  append(e){this.validate(e);this.checkpoint(e.page);this.edits.push(structuredClone(e));this.points+=e.type==='pen'?e.points.length:0;this.characters+=e.type==='text'?e.text.length:0;}
  rotate(page){if(!pageNumber(page))throw Error('Неверная страница');this.checkpoint(page);this.rotations[page]=((this.rotations[page]||0)+90)%360;}
  undo(){const h=this.history.pop();if(!h)return null;this.edits.length=h.length;if(h.rotation===undefined)delete this.rotations[h.page];else this.rotations[h.page]=h.rotation;this.points=this.edits.reduce((n,e)=>n+(e.type==='pen'?e.points.length:0),0);this.characters=this.edits.reduce((n,e)=>n+(e.type==='text'?e.text.length:0),0);return h.page;}
  snapshot(){return{edits:structuredClone(this.edits),rotations:{...this.rotations}};}
 }
 Object.assign(PDFEdits,{MAX_EDITS,MAX_POINTS,MAX_TEXT,MAX_UNDO});root.MousePDFEdits=PDFEdits;if(typeof module==='object'&&module.exports)module.exports=PDFEdits;
})(globalThis);
