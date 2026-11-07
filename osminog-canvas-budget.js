(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.OSMINOGCanvasBudget=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';

  // This budget only decides which model objects need canvas DOM. It never
  // changes the model, the selection, exports, or the set of available tools.
  function viewportBounds(view,width,height,overscan=320){
    const scale=Number(view?.scale),x=Number(view?.x),y=Number(view?.y);
    if(!Number.isFinite(scale)||scale<=0||!Number.isFinite(x)||!Number.isFinite(y)||!(width>0)||!(height>0))return null;
    const pad=Math.max(0,Number(overscan)||0);
    return {left:(-x-pad)/scale,top:(-y-pad)/scale,right:(width-x+pad)/scale,bottom:(height-y+pad)/scale};
  }

  function intersects(object,bounds){
    if(!bounds)return true;
    const x=Number(object?.x),y=Number(object?.y),w=Number(object?.w),h=Number(object?.h);
    // Retain incomplete legacy geometry rather than making an item unreachable.
    if(![x,y,w,h].every(Number.isFinite)||w<0||h<0)return true;
    const angle=(Number(object.rotation)||0)*Math.PI/180;
    const dx=(Math.abs(Math.cos(angle))*w+Math.abs(Math.sin(angle))*h)/2;
    const dy=(Math.abs(Math.sin(angle))*w+Math.abs(Math.cos(angle))*h)/2;
    const cx=x+w/2,cy=y+h/2;
    return cx+dx>=bounds.left&&cx-dx<=bounds.right&&cy+dy>=bounds.top&&cy-dy<=bounds.bottom;
  }

  // Compare immutable strings by reference/value. Never stringify or hash
  // screenshot bytes or note bodies to find out whether their DOM changed.
  // Complex tools keep the existing forced-rebuild contract.
  function contentKey(object,context){
    if(!object||!['image','shape','text','note','brief'].includes(object.type))return null;
    const comments=Array.isArray(object.comments)?object.comments:[];
    return [object,context?.renderer,context?.language,context?.workdesk,object.type,
      object.name,object.title,object.titleHtml,object.text,object.html,object.src,
      object.noteFormat,comments.length,...comments.map(comment=>comment?.text)];
  }

  function sameContent(previous,next){
    return !!previous&&!!next&&previous.length===next.length&&previous.every((value,index)=>value===next[index]);
  }

  return Object.freeze({viewportBounds,intersects,contentKey,sameContent});
});
