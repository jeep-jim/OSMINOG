'use strict';
const fs=require('node:fs'),path=require('node:path'),{png}=require('./build-icons.cjs');
fs.mkdirSync(path.join(__dirname,'icons'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'icons/quadro-browser.png'),png(1024));
fs.writeFileSync(path.join(__dirname,'quadro/brand.png'),png(64));
