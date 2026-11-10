'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {WalletVault}=require('./wallet-vault.cjs');
const storage=()=>{let data={};return{get:async key=>key?{[key]:structuredClone(data[key])}:structuredClone(data),set:async value=>Object.assign(data,structuredClone(value))}};

test('wallet boundary stores only validated public watch addresses',async()=>{
 const vault=new WalletVault(storage()),address='0x1111111111111111111111111111111111111111';
 assert.deepEqual(vault.status(),{locked:true,watchOnly:true,signingAvailable:false,engine:'pending-audited-adapter'});
 assert.deepEqual(await vault.command('add-watch',{address,label:'Main'}),[{address,label:'Main'}]);
 assert.equal((await vault.command('list')).length,1);
 await assert.rejects(vault.command('add-watch',{address:'not-an-address'}),/Некорректный/);
 await assert.rejects(vault.command('add-watch',{address:'0x2222222222222222222222222222222222222222',privateKey:'secret'}),/не принимает секреты/);
 await assert.rejects(vault.command('create'),/не подключён/);
 assert.deepEqual(await vault.command('remove-watch',{index:0}),[]);
});
