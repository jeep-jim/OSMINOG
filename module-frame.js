"use strict";
addEventListener("message",event=>{const data=event.data||{};if(data.protocol!=="osminog.module-init/v1"||typeof data.html!=="string")return;document.open();document.write(data.html);document.close()},{once:true});
