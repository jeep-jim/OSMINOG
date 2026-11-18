'use strict';
// Agent Mouse keeps the owner's pixel face. Antennas and a desk colour identify
// the local agent entry; colours do not imply simultaneous agent processes.
(function(root){
 const service='mouse://agent';
 const palette=Object.freeze({green:'#32c76a',orange:'#f09a48',cyan:'#38b8c8',violet:'#ab88ed',coral:'#e77f91'});
 const desks=Object.freeze(['orange','cyan','green','violet','coral']);
 function variant(desk=''){
  const id=String(desk||'');if(!id)return'green';
  const match=/^desk-([1-5])$/.exec(id);if(match)return desks[Number(match[1])-1];
  let hash=0;for(const character of id)hash=(Math.imul(hash,31)+character.codePointAt(0))>>>0;return desks[hash%desks.length];
 }
 const icon=desk=>'agent-mouse-'+variant(desk)+'.svg',color=desk=>palette[variant(desk)];
 function apply(image,desk){const src=icon(desk);if(image.getAttribute('src')!==src)image.setAttribute('src',src);image.classList.add('agent-mouse-icon');image.dataset.agentColor=variant(desk);image.dataset.ink='color';return image;}
 const api=Object.freeze({service,palette,variant,icon,color,apply});if(typeof module==='object'&&module.exports)module.exports=api;else root.MouseAgentBrand=api;
})(globalThis);
