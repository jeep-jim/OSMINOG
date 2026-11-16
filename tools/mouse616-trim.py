from pathlib import Path
import sys
R=Path(sys.argv[1])
def sub(p,a,b):
 s=(R/p).read_text();assert s.count(a)==1,(p,a[:70],s.count(a));(R/p).write_text(s.replace(a,b))
p=R/'desktop/mouse-native-menu.mm';s=p.read_text();a=s.index('// Mouse\'s internal horizontal seams');b=s.index('static napi_value init(',a)
fragment=Path(sys.argv[2]).read_text()
s=s[:a]+fragment+'\n'+s[b:]
s=s.replace('#include <cmath>','#include <cmath>\n#include <cctype>\nstatic void clearPaneTrim();')
s=s.replace('windowClosing=NO;mouseWindow=w;','clearPaneTrim();windowClosing=NO;mouseWindow=w;')
s=s.replace('windowClosing=YES;restoreHover();','windowClosing=YES;clearPaneTrim();restoreHover();')
s=s.replace(',{"testPaneViews",0,testPaneViews,0,0,0,napi_default,0}','').replace('napi_define_properties(e,exports,8,d);','napi_define_properties(e,exports,7,d);');p.write_text(s)
sub('desktop/browser.cjs','wrap:!!clip,radius});','wrap:!!clip,radius,cornerColor:/^#[0-9a-f]{6}$/i.test(p.roundColor||\'\')?p.roundColor:\'#43536b\'});')
sub('desktop/browser.cjs','// Native page masks are Mouse-only; no renderer injection or viewport modification.','// Native corner chrome is Mouse-only, noninteractive, and never modifies website geometry.')
sub('desktop/browser.cjs','.filter(p=>p.radius===8).map(p=>p.clipped)',".filter(p=>p.radius===8).map(p=>({...p.clipped,color:p.cornerColor}))")
sub('desktop/browser.cjs','dispose(){if(this.disposed)return;this.disposed=true;',"dispose(){if(this.disposed)return;this.disposed=true;this.mouseCornerMask?.([]);")
sub('desktop/mouse/browser.js',"roundBottom:parseInt(pane.style.getPropertyValue('--pane-round-bottom'),10)||0}","roundBottom:parseInt(pane.style.getPropertyValue('--pane-round-bottom'),10)||0,roundColor:getComputedStyle(document.documentElement).getPropertyValue('--line').trim()}")
p=R/'desktop/mouse-606.test.cjs';s=p.read_text();s=s.replace("code.replace('[paneMasks setObject:prior forKey:page];','')","code");p.write_text(s)
p=R/'desktop/mouse-616-smoke.cjs';s=p.read_text()
s=s.replace("win.setSize(1440,960);await sleep(200);","const work=screen.getPrimaryDisplay().workArea;win.setBounds({x:work.x+8,y:work.y+8,width:Math.min(1100,work.width-16),height:Math.min(800,work.height-16)});await sleep(250);")
a=s.index('   let shot;for(let n=0;n<20;n++){');b=s.index("   const keys=[...ids,ai]",a)
s=s[:a]+'''   let shot;for(let n=0;n<20;n++){
    await sleep(100);const frame=await globalCapture.acquire(display);shot=nativeImage.createFromDataURL(frame.base);const size=shot.getSize(),bytes=shot.toBitmap(),c=win.getContentBounds(),sx=size.width/display.size.width,sy=size.height/display.size.height;
    const rgb=(id,x,y)=>{const p=browser.get(id).bounds,ix=Math.round((c.x+p.x+x-display.bounds.x)*sx),iy=Math.round((c.y+p.y+y-display.bounds.y)*sy);assert.ok(ix>=0&&ix<size.width&&iy>=0&&iy<size.height,'sample must be inside actual display');const off=(iy*size.width+ix)*4;return[bytes[off+2],bytes[off+1],bytes[off]]};
    const p=t.bounds,lower=browser.get(ids[1]).bounds,side=browser.get(ai).bounds;
    const samples={inside:rgb(ids[0],20,p.height-2),cutLeft:rgb(ids[0],1,p.height-1),cutRight:rgb(ids[0],p.width-2,p.height-1),pageTop:rgb(ids[0],1,40),externalBottom:rgb(ids[1],1,lower.height-2),aiBottom:rgb(ai,1,side.height-2)};
    const pink=a=>a.every((v,i)=>Math.abs(v-[221,60,146][i])<20);
    if(pink(samples.inside)&&!pink(samples.cutLeft)&&!pink(samples.cutRight)&&pink(samples.pageTop)&&pink(samples.externalBottom)&&pink(samples.aiBottom)){console.log('MOUSE_616_REAL_CORNER_PIXELS',theme,JSON.stringify(samples));break;}
    if(n===19){await fs.writeFile('mouse-616-corner-failure.png',shot.toPNG());throw Error('Native corner chrome mismatch: '+JSON.stringify({samples,window:win.getBounds(),content:c,display:display.bounds,bounds:p}));}
   }
   await fs.writeFile('mouse-616-native-corners-'+theme+'.png',shot.toPNG());
''' +s[b:];p.write_text(s)
print('Apply noninteractive corner chrome; bounded real display sampling and full geometry checks retained')
