'use strict';
// Enumerate explicitly: PowerShell does not expand shell wildcards like bash.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const desktop=path.resolve(__dirname,'../desktop');
const files=fs.readdirSync(desktop).filter(file=>/^mouse-.*\.test\.cjs$/.test(file))
 .concat(fs.readdirSync(path.join(desktop,'mouse-agent')).filter(file=>file.endsWith('.test.cjs')).map(file=>'mouse-agent/'+file)).sort();
if(!files.length)throw Error('Mouse test files missing');
console.log('Mouse unit test files: '+files.length);
const result=cp.spawnSync(process.execPath,['--test','--test-concurrency=4',...files],{cwd:desktop,stdio:'inherit',env:process.env});
if(result.error)throw result.error;
process.exit(result.status===null?1:result.status);
