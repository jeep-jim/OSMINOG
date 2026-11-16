'use strict';
// Metadata checks only while the app runs in normal mode. No automatic download/install.
class UpdateWatch {
 constructor({updates,canCheck,clock=globalThis}){this.updates=updates;this.canCheck=canCheck;this.clock=clock;this.stopped=true;this.timer=null;}
 start(){if(!this.stopped)return;this.stopped=false;this.schedule(1800);}
 schedule(delay){if(this.stopped)return;this.timer=this.clock.setTimeout(()=>{this.timer=null;void this.tick();},delay);this.timer?.unref?.();}
 async tick(){if(this.stopped)return;try{if(this.canCheck()&&!this.updates.task&&!['downloading','ready','opened','installing'].includes(this.updates.state.phase))await this.updates.run('check');}catch{}finally{this.schedule(15*60*1000);}}
 stop(){this.stopped=true;if(this.timer!==null)this.clock.clearTimeout(this.timer);this.timer=null;}
}
module.exports={UpdateWatch};
