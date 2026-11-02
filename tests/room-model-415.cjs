const assert=require('node:assert/strict');
const M=require('../room-model.js');
assert.deepEqual(M.clean(null),M.defaults);
const hostile=M.clean({name:'x'.repeat(100),height:Infinity,light:-20,skin:'url(https://bad)',room:'unknown',desk:'false',token:'secret',__proto__:{admin:true}});
assert.equal(hostile.name.length,32);assert.equal(hostile.height,1);assert.equal(hostile.light,15);assert.equal(hostile.skin,M.defaults.skin);assert.equal(hostile.room,'atelier');assert.equal(hostile.desk,true);assert.equal(hostile.token,undefined);assert.equal(hostile.admin,undefined);
const chosen=M.clean({...M.defaults,name:'Мой персонаж',outfit:'maker',room:'night',height:1.15,plant:false,accessory:'glasses'});
assert.deepEqual(M.clean(JSON.parse(JSON.stringify(chosen))),chosen);
assert.notEqual(M.clean({}),M.defaults);
console.log('PASS room import normalization, limits, schema isolation and roundtrip');
