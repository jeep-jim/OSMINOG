'use strict';

// The first Trader OS wallet boundary is deliberately watch-only. It validates and
// stores public addresses, and rejects every secret/signing operation until an
// audited Web3 signing adapter is wired behind this host-owned interface.
const WATCH_KEY='traderWalletWatch';
const EVM_ADDRESS=/^0x[a-fA-F0-9]{40}$/;

class WalletVault{
 constructor(store){this.store=store}
 async list(){
  const saved=(await this.store.get(WATCH_KEY))[WATCH_KEY];
  return Array.isArray(saved)?saved.filter(item=>item&&EVM_ADDRESS.test(item.address)).slice(0,20):[];
 }
 async add(input={}){
  const address=String(input.address||'').trim();
  if(!EVM_ADDRESS.test(address))throw Error('Некорректный EVM-адрес');
  if('privateKey' in input||'seed' in input||'mnemonic' in input)throw Error('Trader OS не принимает секреты через интерфейс наблюдения');
  const entries=await this.list();
  if(entries.some(item=>item.address.toLowerCase()===address.toLowerCase()))return entries;
  entries.push({address,label:String(input.label||'').trim().slice(0,40)});
  await this.store.set({[WATCH_KEY]:entries});return entries;
 }
 async remove(index){
  const entries=await this.list(),position=Number(index);
  if(!Number.isInteger(position)||position<0||position>=entries.length)throw Error('Адрес не найден');
  entries.splice(position,1);await this.store.set({[WATCH_KEY]:entries});return entries;
 }
 status(){return{locked:true,watchOnly:true,signingAvailable:false,engine:'pending-audited-adapter'}}
 async command(action,args={}){
  if(action==='status')return this.status();
  if(action==='list')return this.list();
  if(action==='add-watch')return this.add(args);
  if(action==='remove-watch')return this.remove(args.index);
  if(['create','import','sign','send'].includes(action))throw Error('Криптографический модуль ещё не подключён; приватные ключи не создавались и не сохранялись');
  throw Error('Неизвестная операция кошелька');
 }
}

module.exports={WalletVault,EVM_ADDRESS,WATCH_KEY};
