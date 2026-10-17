'use strict';
// Launched by a local MCP client with ELECTRON_RUN_AS_NODE=1. Stdout is protocol-only.
const fs=require('node:fs'),net=require('node:net');
try{
 const c=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
 if(typeof c.token!=='string'||!/^[a-f0-9]{64}$/.test(c.token)||typeof c.endpoint!=='string')throw Error('Invalid connection');
 const socket=net.createConnection(c.endpoint);socket.on('connect',()=>{socket.write(JSON.stringify({token:c.token})+'\n');process.stdin.pipe(socket);socket.pipe(process.stdout)});
 socket.on('error',()=>{process.stderr.write('OSMINOG is not connected. Open the browser and enable agent access.\n');process.exitCode=1;process.stdin.destroy()});
 socket.on('close',()=>{process.stdin.destroy()});process.stdin.on('end',()=>socket.end());
 process.on('SIGTERM',()=>{socket.destroy();process.exit(0)});
}catch{process.stderr.write('Enable agent access in OSMINOG before connecting.\n');process.exitCode=1}
