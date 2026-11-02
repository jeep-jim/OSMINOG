'use strict';
const fs=require('node:fs'),path=require('node:path');
const {png,svg}=require('../desktop/build-icons.cjs');
const root=path.resolve(__dirname,'..');
for(const size of [16,32,48,128])fs.writeFileSync(path.join(root,'icons',`icon${size}.png`),png(size));
for(const file of ['icons/icon.svg','brand/osminog-mark.svg','brand/briefcraft-logo.svg'])fs.writeFileSync(path.join(root,file),svg+'\n');
