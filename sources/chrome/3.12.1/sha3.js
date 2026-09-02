"use strict";
(()=>{
  const MASK=(1n<<64n)-1n;
  const RC=[
    0x0000000000000001n,0x0000000000008082n,0x800000000000808an,0x8000000080008000n,
    0x000000000000808bn,0x0000000080000001n,0x8000000080008081n,0x8000000000008009n,
    0x000000000000008an,0x0000000000000088n,0x0000000080008009n,0x000000008000000an,
    0x000000008000808bn,0x800000000000008bn,0x8000000000008089n,0x8000000000008003n,
    0x8000000000008002n,0x8000000000000080n,0x000000000000800an,0x800000008000000an,
    0x8000000080008081n,0x8000000000008080n,0x0000000080000001n,0x8000000080008008n
  ];
  const ROT=[0,1,62,28,27,36,44,6,55,20,3,10,43,25,39,41,45,15,21,8,18,2,61,56,14];
  const rotl=(x,n)=>{n=BigInt(n);return n===0n?(x&MASK):(((x<<n)|(x>>(64n-n)))&MASK)};
  function permute(s){
    const C=new Array(5),D=new Array(5),B=new Array(25);
    for(let round=0;round<24;round++){
      for(let x=0;x<5;x++)C[x]=s[x]^s[x+5]^s[x+10]^s[x+15]^s[x+20];
      for(let x=0;x<5;x++)D[x]=C[(x+4)%5]^rotl(C[(x+1)%5],1);
      for(let y=0;y<5;y++)for(let x=0;x<5;x++)s[x+5*y]=(s[x+5*y]^D[x])&MASK;
      for(let y=0;y<5;y++)for(let x=0;x<5;x++)B[y+5*((2*x+3*y)%5)]=rotl(s[x+5*y],ROT[x+5*y]);
      for(let y=0;y<5;y++)for(let x=0;x<5;x++)s[x+5*y]=(B[x+5*y]^(((~B[(x+1)%5+5*y])&MASK)&B[(x+2)%5+5*y]))&MASK;
      s[0]=(s[0]^RC[round])&MASK;
    }
  }
  function sha3_512Hex(input){
    const bytes=new TextEncoder().encode(String(input));
    const rate=72,state=new Array(25).fill(0n);
    let offset=0;
    while(offset+rate<=bytes.length){
      for(let i=0;i<rate;i++)state[i>>3]^=BigInt(bytes[offset+i])<<BigInt((i&7)*8);
      permute(state);offset+=rate;
    }
    const block=new Uint8Array(rate);block.set(bytes.subarray(offset));block[bytes.length-offset]^=0x06;block[rate-1]^=0x80;
    for(let i=0;i<rate;i++)state[i>>3]^=BigInt(block[i])<<BigInt((i&7)*8);
    permute(state);
    const out=new Uint8Array(64);
    for(let i=0;i<64;i++)out[i]=Number((state[i>>3]>>BigInt((i&7)*8))&0xffn);
    return Array.from(out,b=>b.toString(16).padStart(2,"0")).join("");
  }
  globalThis.BriefCraftSHA3={sha3_512Hex};
})();
