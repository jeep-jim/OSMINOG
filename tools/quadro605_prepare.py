from pathlib import Path
import hashlib
root=Path(__file__).resolve().parents[1]
p=root/'desktop/quadro-smoke.cjs'
s=p.read_text();assert hashlib.sha256(p.read_bytes()).hexdigest()=='f4edbd0572beb82c016e1cd3aeb52c27bc82bf5af69b119a4f36be3ae7d5ec5f'
a="const ratios=await js(`(()=>{const lum=s=>"
b="const ratios=await js(`(()=>{const probe=document.createElement('span');probe.style.color='var(--panel)';document.body.append(probe);const panel=getComputedStyle(probe).color;probe.remove();const lum=s=>"
assert s.count(a)==1;s=s.replace(a,b)
a="b=lum(getComputedStyle(document.documentElement).getPropertyValue('--panel'))"
assert s.count(a)==1;s=s.replace(a,"b=lum(panel)");p.write_text(s)
p=root/'desktop/quadro-web3-smoke.cjs';s=p.read_text();assert hashlib.sha256(p.read_bytes()).hexdigest()=='e44c2bf8483f745110e95585c7cd7b961f52d5934961b70a6bdff1c7250a4825'
a="res.end('<!doctype html><title>Web3 local test</title><h1>Wallet integration fixture</h1><iframe src=\"/child\"></iframe>');"
b="res.end(req.url==='/child'?'<html><body>Unprivileged child frame</body></html>':'<!doctype html><title>Web3 local test</title><h1>Wallet integration fixture</h1><iframe src=\"/child\"></iframe>');"
assert s.count(a)==1;s=s.replace(a,b);p.write_text(s)
Path(__file__).unlink()
