'use strict';
async function captureWindow(win,region){
 const {desktopCapturer}=require('electron'),bounds=win.getBounds(),content=win.getContentBounds();
 const sources=await desktopCapturer.getSources({types:['window'],thumbnailSize:{width:bounds.width*2,height:bounds.height*2}}),source=sources.find(s=>s.id===win.getMediaSourceId());
 if(!source||source.thumbnail.isEmpty())throw Error('Не удалось снять окно Осьминога');
 const size=source.thumbnail.getSize(),sx=size.width/bounds.width,sy=size.height/bounds.height;
 const r=region||{x:0,y:0,width:content.width,height:content.height};
 return source.thumbnail.crop({x:Math.max(0,Math.round((content.x-bounds.x+r.x)*sx)),y:Math.max(0,Math.round((content.y-bounds.y+r.y)*sy)),width:Math.max(1,Math.round(r.width*sx)),height:Math.max(1,Math.round(r.height*sy))});
}
module.exports={captureWindow};
