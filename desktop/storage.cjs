'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
class Store {
  constructor(dir){this.file=path.join(dir,'workspace.json');this.queue=Promise.resolve();}
  async read(){try{return JSON.parse(await fs.readFile(this.file,'utf8'))}catch(e){if(e.code==='ENOENT')return{};throw e}}
  async get(keys){await this.queue;const data=await this.read();if(keys==null)return data;const out={};for(const key of typeof keys==='string'?[keys]:Array.isArray(keys)?keys:Object.keys(keys))out[key]=data[key]??(typeof keys==='object'&&!Array.isArray(keys)?keys[key]:undefined);return out;}
  mutate(operation){const task=this.queue.then(async()=>{const data=await this.read();const result=operation(data);await fs.mkdir(path.dirname(this.file),{recursive:true});try{await fs.copyFile(this.file,this.file+'.bak')}catch(e){if(e.code!=='ENOENT')throw e}await fs.writeFile(this.file+'.next',JSON.stringify(data),'utf8');await fs.rename(this.file+'.next',this.file);return result});this.queue=task.catch(()=>{});return task;}
  set(values){return this.mutate(data=>{const changes={};for(const [k,v] of Object.entries(values)){if(['__proto__','constructor','prototype'].includes(k))throw Error('Invalid storage key');changes[k]={oldValue:data[k],newValue:v};data[k]=v}return changes})}
  remove(keys){return this.mutate(data=>{const changes={};for(const k of typeof keys==='string'?[keys]:keys){changes[k]={oldValue:data[k]};delete data[k]}return changes})}
}
module.exports={Store};

