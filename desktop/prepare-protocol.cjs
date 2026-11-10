'use strict';
require('./build-icons.cjs');
const fs=require('node:fs'),path=require('node:path');
const background=fs.readFileSync(path.join(__dirname,'..','background.js'),'utf8');
const start=background.indexOf('function bcMachineInstructions('),end=background.indexOf('function bcThreadKey(');
if(start<0||end<start)throw Error('Shared chat protocol boundaries changed');
fs.writeFileSync(path.join(__dirname,'protocol.cjs'),"'use strict';\n"+background.slice(start,end)+'\nmodule.exports={bcDecoratePrompt,bcToolPrompt,bcParseAssistant};\n');
