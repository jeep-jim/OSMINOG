'use strict';
// Independent acceptance colors. The owner requested a 14% black sidebar
// layer in637; the fixture's original RGB remains unchanged in its document.
// Do not read the expected color from the screenshot or production dim code.
const assert=require('node:assert/strict');
function zoomPresentation(version,kind){
 assert.ok(kind==='popover'||kind==='settings','Known live zoom control');
 const dimmed=version==='6.0.43'&&kind==='settings';
 return{kind,dimmed,expectedRGB:dimmed?[202,34,133]:[235,40,155]};
}
function presentationSettled(states,enabled){
 return states.length>0&&states.every(state=>state&&state.requested===enabled&&state.applied===enabled&&state.pending===false&&state.error==='');
}
module.exports={zoomPresentation,presentationSettled};
