'use strict';
// Bounded recovery only. A denied broad grant never authorizes another silent
// capture: the only recovery is the operating system's explicit source picker.
function permissionError(error) {
 return error?.code === 'SCREEN_PERMISSION_DENIED' ||
  (error?.nativeDomain === 'com.apple.ScreenCaptureKit.SCStreamErrorDomain' && Number(error?.nativeCode) === -3801) ||
  Number(error?.nativeCode) === -3801;
}
async function acquireFrame({choose=false,permission,nativeGranted=false,legacy,native,picker}) {
 if(choose) {
  if(!picker)throw Object.assign(Error('Системный выбор экрана недоступен на этой версии macOS.'),{code:'PICKER_UNAVAILABLE'});
  return picker();
 }
 let failure;
 if(permission==='granted'||nativeGranted) {
  try{return await legacy();}catch(error){failure=error;}
  if(native)try{return await native();}catch(error){failure=error;}
 }
 // The picker is consent UI, not a retry that bypasses a denial. Cancellation
 // resolves to null and MUST NOT be followed by another backend or prompt.
 if(picker)return picker();
 if(failure)throw failure;
 throw Object.assign(Error('macOS не разрешила захват экрана текущему экземпляру Mouse Browser.'),{code:'SCREEN_PERMISSION_DENIED'});
}
module.exports={acquireFrame,permissionError};
