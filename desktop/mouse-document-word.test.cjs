'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const XML=require('@xmldom/xmldom');
const {createModel}=require('./mouse/document-word.js');
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const source=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:custom="urn:unknown" custom:keep="yes"><w:body>
<!-- keep this comment --><w:p><w:pPr><w:pStyle w:val="Heading1"/><w:spacing w:after="120"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="AA2244"/><w:sz w:val="28"/><custom:keep code="123"/></w:rPr><w:t>First</w:t><w:tab/><w:t xml:space="preserve"> second</w:t></w:r><w:hyperlink r:id="rId9"><w:r><w:t>Link</w:t></w:r></w:hyperlink></w:p>
<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/></w:tblPr><w:tr><w:tc><w:tcPr><w:gridSpan w:val="2"/></w:tcPr><w:p><w:r><w:t>Cell</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
<w:p><w:r><w:drawing><custom:media r:embed="rId1"/></w:drawing></w:r></w:p><w:sdt><w:sdtPr><w:tag w:val="retain"/></w:sdtPr><w:sdtContent><w:p><w:r><w:t>Locked</w:t></w:r></w:p></w:sdtContent></w:sdt><w:sectPr><w:headerReference w:type="default" r:id="rId2"/><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>`;
function fixture(){return{parts:{'word/document.xml':source,'word/header1.xml':`<w:hdr xmlns:w="${W}"><w:p><w:r><w:t>Header</w:t></w:r></w:p></w:hdr>`,'word/styles.xml':`<w:styles xmlns:w="${W}"/>`,'word/_rels/document.xml.rels':'<Relationships/>'},media:{}};}
const nodes=(doc,name)=>Array.from(doc.getElementsByTagNameNS(W,name));
function reparsed(model,path='word/document.xml'){return new XML.DOMParser().parseFromString(model.exportChanges().parts[path],'application/xml');}
test('opening a complex DOCX produces no patches and preserves unrelated headers/styles',()=>{
  const doc=fixture(),model=createModel(doc,XML);assert.deepEqual(model.exportChanges(),{parts:{}});assert.equal(doc.parts['word/document.xml'],source);
  assert.equal(nodes(model.parts.get('word/document.xml'),'t').length,5);assert.equal(model.parts.size,2);
});
test('text edits preserve run properties, table structure, relationships, unknown nodes and whitespace',()=>{
  const model=createModel(fixture(),XML),doc=model.parts.get('word/document.xml'),text=nodes(doc,'t')[0];
  assert.equal(model.setText('word/document.xml',text,'  Changed <script> & word  '),true);
  const result=reparsed(model),changed=nodes(result,'t')[0];assert.equal(changed.textContent,'  Changed <script> & word  ');assert.equal(changed.getAttributeNS('http://www.w3.org/XML/1998/namespace','space'),'preserve');
  assert.equal(nodes(result,'pStyle')[0].getAttributeNS(W,'val'),'Heading1');assert.equal(nodes(result,'color')[0].getAttributeNS(W,'val'),'AA2244');assert.equal(nodes(result,'gridSpan')[0].getAttributeNS(W,'val'),'2');
  assert.equal(result.getElementsByTagNameNS('urn:unknown','keep')[0].getAttribute('code'),'123');assert.equal(result.getElementsByTagNameNS('urn:unknown','media').length,1);
  assert.equal(nodes(result,'headerReference').length,1);assert.equal(nodes(result,'sdt').length,1);assert.equal(nodes(result,'tab').length,1);
  assert.equal(model.exportChanges().parts['word/header1.xml'],undefined);assert.match(model.exportChanges().parts['word/document.xml'],/keep this comment/);assert.match(model.exportChanges().parts['word/document.xml'],/&lt;script(?:&gt;|>)/);
});
test('run formatting changes only the selected rPr property and can override inherited bold with false',()=>{
  const model=createModel(fixture(),XML),doc=model.parts.get('word/document.xml'),runs=nodes(doc,'r');
  model.formatRun('word/document.xml',runs[0],'b',false);model.formatRun('word/document.xml',runs[1],'i',true);
  const result=reparsed(model);assert.equal(nodes(result,'b')[0].getAttributeNS(W,'val'),'0');assert.equal(nodes(result,'i')[0].getAttributeNS(W,'val'),'1');assert.equal(nodes(result,'color')[0].getAttributeNS(W,'val'),'AA2244');
  assert.equal(result.getElementsByTagNameNS('urn:unknown','keep').length,1);assert.equal(nodes(result,'t').map(n=>n.textContent).join('|'),'First| second|Link|Cell|Locked');
});
test('editing a header patches only that part; no-op text and foreign nodes cannot dirty the document',()=>{
  const model=createModel(fixture(),XML),header=model.parts.get('word/header1.xml'),text=nodes(header,'t')[0];
  assert.equal(model.setText('word/header1.xml',text,'Header'),false);assert.deepEqual(model.exportChanges(),{parts:{}});
  assert.throws(()=>model.setText('word/document.xml',text,'Wrong'),/не принадлежит/);
  model.setText('word/header1.xml',text,'Новый колонтитул');assert.deepEqual(Object.keys(model.exportChanges().parts),['word/header1.xml']);assert.equal(nodes(reparsed(model,'word/header1.xml'),'t')[0].textContent,'Новый колонтитул');
});
test('restored draft is exported even before another edit',()=>{
  const doc=fixture();doc.parts['word/document.xml']=source.replace('First','Draft');doc.draft={parts:{'word/document.xml':doc.parts['word/document.xml']}};
  const model=createModel(doc,XML);assert.match(model.exportChanges().parts['word/document.xml'],/>Draft</);assert.deepEqual(Object.keys(model.exportChanges().parts),['word/document.xml']);
});
test('rejects legacy/foreign format, XML entities, control characters and unsupported formatting',()=>{
  assert.throws(()=>createModel({parts:{'word/document.xml':'<html>not docx</html>'}},XML),/\.doc/);
  assert.throws(()=>createModel({parts:{'word/document.xml':`<!DOCTYPE x [<!ENTITY leak SYSTEM "file:///etc/passwd">]><w:document xmlns:w="${W}"/>`}},XML),/XML/);
  const model=createModel(fixture(),XML),doc=model.parts.get('word/document.xml');assert.throws(()=>model.setText('word/document.xml',nodes(doc,'t')[0],'bad\0text'),/символ/);
  assert.throws(()=>model.formatRun('word/document.xml',nodes(doc,'r')[0],'script',true),/форматирование/);assert.deepEqual(model.exportChanges(),{parts:{}});
});
