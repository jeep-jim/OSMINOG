import gzip, hashlib, json, pathlib, subprocess, shutil
ROOT=pathlib.Path.cwd()
def sha(b): return hashlib.sha256(b).hexdigest()
stage=ROOT/'tools/staging-409'
parts=sorted(stage.glob('chunk-*.bin'))
assert len(parts)==16, 'Incomplete transfer'
data=b''.join(p.read_bytes() for p in parts)
assert sha(data)=='5531ba6778cd817bfb486bb65a7797c2a29eedae556c517a78c029708f0aae93', 'Transfer checksum'
raw=gzip.decompress(data)
assert len(raw)==62546
plan=json.loads(raw)
assert plan['schema']=='osminog-reviewed-source-edits/v1'
assert plan['baseCommit']=='c14996cdf2d391f5bfa2ace3d950de16678c6821'
subprocess.run(['git','merge-base','--is-ancestor',plan['baseCommit'],'HEAD'],check=True)
changes={}
for item in plan['files']:
    path=pathlib.PurePosixPath(item['path'])
    assert not path.is_absolute() and not any(x in ('..','.git') for x in path.parts)
    target=ROOT/path
    if item['before'] is None:
        assert not target.exists(), str(path)+' already exists'
        text=''
    else:
        before=target.read_bytes()
        assert sha(before)==item['before'], 'Unexpected base: '+str(path)
        text=before.decode('utf-8')
    prev=0
    for start,end,insert in item['edits']:
        assert prev<=start<=end<=len(text)
        prev=end
    for start,end,insert in reversed(item['edits']): text=text[:start]+insert+text[end:]
    after=text.encode('utf-8')
    assert sha(after)==item['after'], 'Result checksum: '+str(path)
    changes[target]=after
for path,content in changes.items():
    path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(content)
for name in ['provider-dock-3217.cjs','provider-session-isolation-3218.cjs']:
    p=ROOT/'tests'/name;text=p.read_text();assert "assert.equal(manifest.version,'4.0.8')" in text
    p.write_text(text.replace("assert.equal(manifest.version,'4.0.8')","assert.equal(manifest.version,'4.0.9')"))
p=ROOT/'tests/agent-media-3207.cjs';text=p.read_text();assert '"4.0.8"].includes(m.version)' in text
p.write_text(text.replace('"4.0.8"].includes(m.version)','"4.0.8","4.0.9"].includes(m.version)'))
p=ROOT/'.github/workflows/agent-media-3207.yml';text=p.read_text();assert '4.0.8' in text
text=text.replace('4.0.8','4.0.9').replace('CANVAS-FOCUS','AGENT-RUNTIME').replace('Canvas Focus','Agent Runtime')
text=text.replace('      - run: node tests/chat-sync-3216.cjs','      - run: node tests/agent-session-409.cjs\n      - run: node tests/chat-sync-3216.cjs')
text=text.replace('      - run: node tests/canvas-ux-408.cjs','      - run: node tests/agent-runtime-browser-409.cjs\n      - run: node tests/canvas-ux-408.cjs')
text=text.replace('            artifacts/canvas-ux-408-results.json','            artifacts/canvas-ux-408-results.json\n            artifacts/agent-runtime-409-results.json\n            artifacts/agent-session-409-results.json')
p.write_text(text)
for p in changes:
    if p.suffix in ('.js','.cjs'): subprocess.run(['node','--check',str(p)],check=True)
subprocess.run(['node','tests/agent-session-409.cjs'],check=True)
subprocess.run(['node','tests/chat-sync-plaintext-3217.cjs'],check=True)
shutil.rmtree(stage)
print('Applied 17 checksum-verified files; runtime tests passed. Full browser CI still required.')
