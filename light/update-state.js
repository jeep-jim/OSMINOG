/* Update markers live in IDB: chrome.storage.local writes can scan the old monolithic archive. */
(()=>{'use strict';const KEY='briefCraftReopenAfterUpdateV1';globalThis.LightUpdateState={
 async get(key){if(key!==KEY)throw Error('Unsupported update key');await LightStore.init();const state=await LightStore.pref('updateMarker');if(state!==undefined&&state!==null)return {[KEY]:state.value||undefined};const legacy=(await chrome.storage.local.get(KEY))[KEY];return {[KEY]:legacy}},
 async set(data){await LightStore.init();await LightStore.setPref('updateMarker',{value:data[KEY]})},
 async remove(key){if(key!==KEY)throw Error('Unsupported update key');await LightStore.init();await LightStore.setPref('updateMarker',{value:null})}
};})();
