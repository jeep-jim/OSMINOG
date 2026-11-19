'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{assignTasks}=require('./mouse/progress-pill.js');
const task=(id,extra={})=>({id,taskId:id,desk:'desk-1',source:'page',tabId:'a',kind:'reported',phase:'running',createdAt:1,...extra});
const panes=[{key:'left',kind:'page',tabId:'a'},{key:'right',kind:'page',tabId:'b'},{key:'ai',kind:'page',tabId:'chat'},{key:'agent',kind:'agent',tabId:''}];
const mapping=(tasks,panels=panes,extra={})=>assignTasks(tasks,{desk:'desk-1',privateMode:false,panels,...extra});
test('progress follows its tab through swaps, split panes and an AI sidebar',()=>{
 const tasks=[task('a'),task('b',{tabId:'b'}),task('chat',{tabId:'chat'}),task('hidden',{tabId:'hidden'}),task('foreign',{tabId:'a',desk:'desk-2'})];
 let result=mapping(tasks);assert.deepEqual([...result].map(([key,values])=>[key,values.map(t=>t.id)]),[['left',['a']],['right',['b']],['ai',['chat']],['agent',[]]]);
 result=mapping(tasks,[{key:'top',kind:'page',tabId:'b'},{key:'bottom',kind:'page',tabId:'a'}]);assert.deepEqual(result.get('top').map(t=>t.id),['b']);assert.deepEqual(result.get('bottom').map(t=>t.id),['a']);assert.equal([...result.values()].flat().length,2);
 result=mapping(tasks,[{key:'fullscreen',kind:'page',tabId:'chat'}]);assert.deepEqual(result.get('fullscreen').map(t=>t.id),['chat']);
});
test('agent and terminal attach only to their panel; private mode exposes no tasks',()=>{
 const tasks=[task('agent',{source:'agent',tabId:undefined}),task('terminal',{source:'terminal',tabId:undefined}),task('shell',{source:'shell',tabId:'b'}),task('unbound',{source:'shell',tabId:undefined})];
 const result=mapping(tasks);assert.deepEqual(result.get('agent').map(t=>t.id),['agent','terminal']);assert.deepEqual(result.get('right').map(t=>t.id),['shell']);assert.equal([...result.values()].flat().length,3);
 assert.equal([...mapping(tasks,panes.slice(0,2)).values()].flat().length,1);assert.equal([...mapping(tasks,panes,{privateMode:true}).values()].flat().length,0);
});
test('explicit tasks take priority over observed/loading indicators without inventing percentages',()=>{
 const tasks=[task('navigation',{kind:'navigation',percent:null,createdAt:0}),task('observed',{kind:'observed',percent:60,createdAt:1}),task('explicit',{percent:32,createdAt:2}),task('second',{percent:47,createdAt:3}),task('complete',{percent:100,phase:'completed',createdAt:0})],before=JSON.stringify(tasks);
 assert.deepEqual(mapping(tasks).get('left').map(t=>t.id),['explicit','second','complete','navigation','observed']);assert.equal(JSON.stringify(tasks),before);
});
