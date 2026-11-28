'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const crypto=require('node:crypto');
const {FlashAccounts,inviteTranscript,TTL}=require('./mouse-flash-accounts.cjs');
const {loadIdentity,verify}=require('./mouse-flash-identity.cjs');
const {certificateSigningBytes,verifyAccountCertificate}=require('./mouse-account-proof.cjs');
const {avatarHash}=require('./mouse-profile.cjs');
const C=require('./mouse-flash-crypto.js');
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
const avatar='data:image/png;base64,'+PNG.toString('base64');
function protector(){const key=crypto.randomBytes(32);return{
  protect(text){const nonce=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,nonce);return Buffer.concat([nonce,cipher.update(text),cipher.final(),cipher.getAuthTag()]);},
  unprotect(bytes){const decipher=crypto.createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));decipher.setAuthTag(bytes.subarray(-16));return Buffer.concat([decipher.update(bytes.subarray(12,-16)),decipher.final()]).toString('utf8');}
};}
async function fixture(t){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'mouse-flash-accounts-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const issuer=crypto.generateKeyPairSync('ed25519'),serverPublicKey=issuer.publicKey.export({type:'spki',format:'der'}).toString('base64'),registryId=crypto.randomBytes(32).toString('base64url');
  const identities=await Promise.all(['sender','receiver'].map(name=>loadIdentity({directory:path.join(root,name),name,...protector()})));
  const states=identities.map((identity,i)=>{
    const claims={v:2,issuerKeyId:crypto.createHash('sha256').update(Buffer.from(serverPublicKey,'base64')).digest('hex'),registryId,accountId:i+1,
      deviceId:identity.identity.deviceId,publicKey:identity.identity.publicKey,encryptionKey:identity.encryptionKey,name:'Synthetic '+(i+1),avatarHash:avatarHash(avatar),issuedAt:Date.now(),expiresAt:Date.now()+86400000};
    return{accountId:i+1,name:claims.name,avatar,certificate:{claims,signature:crypto.sign(null,certificateSigningBytes(claims),issuer.privateKey).toString('base64')}};
  });
  const boxes=[[],[]],sent=[],calls=[[],[]];let listening=true,live=true;
  const providers=states.map((state,i)=>({
    snapshot:()=>state,
    verifyCertificate:(certificate,expected)=>verifyAccountCertificate({certificate,serverPublicKey,deviceId:expected.deviceId||certificate.claims.deviceId}),
    devices:async accountId=>{calls[i].push('devices');const at=states.findIndex(item=>item.accountId===accountId);return at<0?{account:null,devices:[]}:{account:{id:accountId,name:states[at].name,avatar:states[at].avatar},devices:[{deviceId:identities[at].identity.deviceId,name:identities[at].identity.name,certificate:states[at].certificate,expiresAt:Date.now()+90000}]};},
    presence:async()=>{calls[i].push('presence');return{ok:true};},
    sendInvitation:async input=>{calls[i].push('send');sent.push(input);const receiver=states.findIndex(item=>item.accountId===input.recipientAccountId);const item={invitationId:crypto.randomBytes(16).toString('hex'),fromAccountId:state.accountId,fromDeviceId:identities[i].identity.deviceId,envelope:input.envelope,expiresAt:Date.now()+TTL};boxes[receiver].push(item);return{invitationId:item.invitationId,expiresAt:item.expiresAt};},
    invitations:async()=>{calls[i].push('invitations');return{invitations:boxes[i].splice(0,10)};}
  }));
  const broker='https://mouse.black',invite=C.createInvite({broker,roomId:C.randomId(),joinToken:C.randomId(32),expiresAt:Date.now()+1800000});
  const bridges=identities.map((identity,i)=>new FlashAccounts({provider:providers[i],identity,broker,assertLive:()=>assert.equal(live,true,'stale account context'),isListening:()=>listening,ownsInvite:parsed=>parsed.roomId===invite.roomId}));
  return{bridges,identities,states,providers,boxes,sent,calls,invite,setListening:value=>{listening=value;},revoke:()=>{live=false;}};
}
test('real signed account certificates and encrypted native mailbox route to one selected device without exposing invite secret',async t=>{
  const f=await fixture(t),[sender,receiver]=f.bridges,peer=(await sender.lookup(2)).devices[0];
  assert.equal(peer.name,'Synthetic 2');assert.equal(peer.avatar,avatar);assert.equal(peer.deviceId,f.identities[1].identity.deviceId);
  const result=await sender.send({accountId:2,deviceId:peer.deviceId,invite:f.invite.text});assert.equal(result.peer.accountId,2);
  assert.equal(f.sent.length,1);assert.deepEqual(Object.keys(f.sent[0]).sort(),['envelope','recipientAccountId','recipientDeviceId']);
  const serialized=JSON.stringify(f.sent[0]);assert.equal(serialized.includes(f.invite.text),false);assert.equal(serialized.includes(f.invite.secret),false);assert.equal(serialized.includes('Synthetic 1'),false);
  const opened=f.identities[1].openInvitation(f.sent[0].envelope);assert.equal(opened.toDeviceId,peer.deviceId);
  assert.deepEqual(verify({identity:f.identities[0].identity,transcriptHash:inviteTranscript(opened),signature:opened.signature}),{ok:true,deviceId:f.identities[0].identity.deviceId});
  const incoming=await receiver.incoming();assert.equal(incoming.invitations.length,1);assert.equal(incoming.invitations[0].invite,f.invite.text);assert.equal(incoming.invitations[0].peer.accountId,1);assert.equal(incoming.invitations[0].peer.avatar,avatar);
  const verified=await receiver.verifyPeer({certificate:f.states[0].certificate,identity:f.identities[0].identity});assert.equal(verified.accountId,1);assert.equal(verified.avatar,avatar);
  await assert.rejects(receiver.verifyPeer({certificate:f.states[0].certificate,identity:f.identities[1].identity}));
});
test('mailbox metadata substitution, envelope tampering and sender proof tampering cannot create a verified invitation',async t=>{
  const f=await fixture(t),[sender,receiver]=f.bridges,peer=(await sender.lookup(2)).devices[0];await sender.send({accountId:2,deviceId:peer.deviceId,invite:f.invite.text});const original=f.boxes[1][0];
  f.boxes[1][0]={...original,fromAccountId:999};assert.deepEqual(await receiver.incoming(),{invitations:[]});receiver.rates.clear();
  const bytes=Buffer.from(original.envelope.ciphertext,'base64');bytes[0]^=1;f.boxes[1].push({...original,envelope:{...original.envelope,ciphertext:bytes.toString('base64')}});assert.deepEqual(await receiver.incoming(),{invitations:[]});receiver.rates.clear();
  const forged=f.identities[1].openInvitation(original.envelope);forged.signature=crypto.randomBytes(64).toString('base64');const envelope=f.identities[0].sealInvitation({recipientDeviceId:peer.deviceId,recipientEncryptionKey:f.identities[1].encryptionKey,payload:forged});
  f.boxes[1].push({...original,envelope});assert.deepEqual(await receiver.incoming(),{invitations:[]});
});
test('a live invitation survives avatar service outage but duplicate delivery is consumed only once',async t=>{
  const f=await fixture(t),[sender,receiver]=f.bridges,peer=(await sender.lookup(2)).devices[0];await sender.send({accountId:2,deviceId:peer.deviceId,invite:f.invite.text});const original=f.boxes[1][0];
  f.providers[1].devices=async()=>{throw Error('server offline');};const response=await receiver.incoming();assert.equal(response.invitations.length,1);assert.equal(response.invitations[0].peer.name,'Synthetic 1');assert.equal(response.invitations[0].peer.avatar,null);
  receiver.rates.clear();f.boxes[1].push({...original,invitationId:'duplicate'});assert.deepEqual(await receiver.incoming(),{invitations:[]});
});
test('hidden panels do not poll server or publish presence and periodic native calls have bounded rates',async t=>{
  const f=await fixture(t),sender=f.bridges[0];f.setListening(false);await sender.presence();await sender.incoming();assert.deepEqual(f.calls[0],[]);
  f.setListening(true);await sender.presence();await sender.presence();await sender.incoming();await sender.incoming();assert.deepEqual(f.calls[0],['presence','invitations']);
  f.revoke();await assert.rejects(sender.snapshot(),/stale account context/);
});
test('routing requires a selected current certificate, owned room and matching local encryption key',async t=>{
  const f=await fixture(t),sender=f.bridges[0],peerId=f.identities[1].identity.deviceId;
  await assert.rejects(sender.send({accountId:2,deviceId:peerId,invite:f.invite.text}),/Найдите/);sender.rates.clear();
  await sender.lookup(2);const another=C.createInvite({broker:'https://mouse.black',roomId:C.randomId(),joinToken:C.randomId(32),expiresAt:Date.now()+1800000});
  await assert.rejects(sender.send({accountId:2,deviceId:peerId,invite:another.text}),/active Flash/);assert.equal(f.sent.length,0);
  const bad=new FlashAccounts({provider:f.providers[0],identity:{...f.identities[0],encryptionKey:f.identities[1].encryptionKey},broker:'https://mouse.black',assertLive:()=>{}});
  await assert.rejects(bad.snapshot(),/encryption key/);
});
