'use strict';
(function(root){
 function available(current,state){
  const candidate=state?.availableVersion;
  if(!/^\d+\.\d+\.\d+$/.test(current)||!/^\d+\.\d+\.\d+$/.test(candidate||''))return false;
  const a=candidate.split('.').map(Number),b=current.split('.').map(Number);
  for(let i=0;i<3;i++){if(!Number.isSafeInteger(a[i])||!Number.isSafeInteger(b[i]))return false;if(a[i]!==b[i])return a[i]>b[i];}
  return false;
 }
 // availableVersion is retained by the updater after a verified release was
 // found, including retryable download errors. A failed manual check alone
 // must not bring a permanent version button back into the workspace.
 function visible(current,state){return available(current,state)||['downloading','ready','opened','installing'].includes(state?.phase);}
 const api={available,visible};if(typeof module==='object'&&module.exports)module.exports=api;else root.MouseUpdateBadge=api;
})(globalThis);
