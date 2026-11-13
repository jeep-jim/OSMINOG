'use strict';
const {Updates}=require('./updates.cjs');
const MESSAGE='Первый macOS preview обновляется вручную. Откройте меню Trader OS → «Загрузить версию для Mac…» и установите новый DMG. Локальный профиль сохраняется. Автообновление без Developer ID не включено.';
class ManualMacUpdates extends Updates {
 constructor(options){super(options);this.state.releaseNotes='macOS Apple Silicon preview. Подпись ad-hoc; Apple notarization отсутствует. '+MESSAGE;this.state.source='Trader OS macOS';}
 manual(){return this.single(async()=>{throw Error(MESSAGE)})}
 check(){return this.manual()}
 download(){return this.manual()}
 install(){return this.manual()}
}
module.exports={ManualMacUpdates,MESSAGE};
