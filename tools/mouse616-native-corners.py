from pathlib import Path
import sys
R=Path(sys.argv[1])
p=R/'desktop/browser.cjs';s=p.read_text();assert 'if(radius&&!t.roundView)' in s;s=s.replace('wrap:!!clip||!!radius,radius','wrap:!!clip,radius');a=s.index('    if(radius&&!t.roundView)');b=s.index('    const parentBounds=',a);s=s[:a]+'    const viewBounds=t.clipView?{x:bounds.x-clipped.x,y:bounds.y-clipped.y,width:bounds.width,height:bounds.height}:bounds;\n'+s[b:];s=s.replace('JSON.stringify([viewBounds,parentBounds,roundBounds])','JSON.stringify([viewBounds,parentBounds])').replace('if(t.roundView)t.roundView.setBounds(roundBounds);','');s=s.replace('\n\n }\n dispose()',"\n  // Native page masks are Mouse-only; no renderer injection or viewport modification.\n  if(this.mouseCornerMask)this.mouseCornerMask([...desired.values()].filter(p=>p.radius===8).map(p=>p.clipped));\n }\n dispose()");p.write_text(s)
p=R/'desktop/mouse-stability.cjs';s=p.read_text().replace('if(t.roundView?.children.includes(t.view))t.roundView.removeChildView(t.view);if(t.clipView?.children.includes(t.roundView))t.clipView.removeChildView(t.roundView);','');p.write_text(s)
for name in ['mouse-main.cjs','mouse-private.cjs']:
 p=R/'desktop'/name;s=p.read_text();assert s.count('browser.mouseRoundedPanes=true;')==1;s=s.replace('browser.mouseRoundedPanes=true;',"browser.mouseRoundedPanes=true;browser.mouseCornerMask=rects=>require('./mouse-native-menu.node').paneCorners(rects);");p.write_text(s)
p=R/'desktop/mouse-616.test.cjs';s=p.read_text();a=s.index("test('native corner wrappers");s=s[:a]+'''test('native pane mask does not change WebContents viewport and is opt-in for Mouse',()=>{
 class View{constructor(){this.children=[];this.visible=false;this.bounds={};}addChildView(v){this.children.push(v)}removeChildView(v){this.children=this.children.filter(x=>x!==v)}setBorderRadius(r){this.radius=r}setBounds(r){this.bounds=r}setVisible(b){this.visible=b}}
 const mod={exports:{}},ctx={module:mod,exports:mod.exports,require:n=>n==='electron'?{View,WebContentsView:View}:n==='node:crypto'?require(n):n==='node:path'?require(n):{}};
 vm.runInNewContext(read('browser.cjs'),ctx);const fn=mod.exports.BrowserWorkspace.prototype.layout;
 const win={isDestroyed:()=>false,getContentSize:()=>[1000,800],contentView:new View()},v=new View(),t={id:'t',project:'p',lane:'main',view:v,visible:false};win.contentView.addChildView(v);let masks=[];
 const b={mouseRoundedPanes:true,mouseCornerMask:items=>masks=items,win,disposed:false,project:'p',tabs:new Map([['t',t]]),providers:new Map()};
 fn.call(b,[{id:'t',x:0,y:80,width:450,height:300,roundBottom:8}]);
 assert.equal(t.clipView,undefined);assert.equal(t.view.bounds.y,80);assert.equal(t.view.bounds.height,300);assert.equal(t.bounds.y,80);assert.equal(masks.length,1);assert.equal(masks[0].height,300);
 fn.call(b,[{id:'t',x:0,y:80,width:450,height:300,roundBottom:0}]);assert.equal(masks.length,0);assert.equal(t.view.bounds.y,80);
 t.lane='side';fn.call(b,[{id:'t',x:0,y:80,width:450,height:300,roundBottom:8}]);assert.equal(masks.length,0);
 const other={...b,mouseRoundedPanes:false,tabs:new Map([['x',{id:'x',project:'p',view:new View(),lane:'main'}]])};fn.call(other,[{id:'x',x:0,y:0,width:900,height:700,roundBottom:8}]);assert.equal(other.tabs.get('x').clipView,undefined);assert.equal(masks.length,0);
});
''';p.write_text(s)
p=R/'desktop/mouse-616-smoke.cjs';s=p.read_text().replace("browser.panels.length===5&&browser.get(ids[0]).roundView","browser.panels.length===5&&browser.get(ids[0]).bounds").replace("'native rounded top-row page'","'native top-row page'");a="if(pink(inside)&&!pink(outside))break;if(n===19)throw Error('Native corners not clipped: '+JSON.stringify({inside,outside,bounds:p,view:t.view.getBounds(),clip:t.clipView.getBounds(),round:t.roundView.getBounds()}));";assert s.count(a)==1;s=s.replace(a,"if(pink(inside)&&!pink(outside))break;if(n===19){await fs.writeFile('mouse-616-corner-failure.png',shot.toPNG());console.log('MOUSE_NATIVE_PAGE_VIEWS',require('./mouse-native-menu.node').testPaneViews());throw Error('Native corners not clipped: '+JSON.stringify({inside,outside,bounds:p,view:t.view.getBounds()}));}");p.write_text(s)
fragment=r'''// Mouse's internal horizontal seams require a real native-page mask. A generic
// Electron View clip does not clip the hosted Cocoa web surface. Only exact
// owned WebContents rectangles supplied by the trusted browser layout qualify.
// Never retain native view pointers across callbacks; keys are weak references.
static NSMapTable<NSView*,NSDictionary*>* paneMasks;
static NSRect paneRect(NSView* view,NSView* root){
 NSRect r=[view convertRect:view.bounds toView:root];
 if(!root.isFlipped)r.origin.y=NSHeight(root.bounds)-NSMaxY(r);
 return r;
}
static void pageViews(NSView* view,NSView* root,NSMutableArray<NSView*>* found,NSUInteger* visited){
 if(!view||++*visited>4096||view.hidden)return;
 NSString* name=NSStringFromClass(view.class);
 if(view!=root&&([name containsString:@"WebContentsView"]||[name containsString:@"RenderWidgetHostView"]))[found addObject:view];
 for(NSView* child in view.subviews)pageViews(child,root,found,visited);
}
static bool rectValue(napi_env e,napi_value v,NSRect* r){
 double a[4]={};const char* keys[]={"x","y","width","height"};
 for(int i=0;i<4;i++){napi_value n;if(napi_get_named_property(e,v,keys[i],&n)!=napi_ok||napi_get_value_double(e,n,&a[i])!=napi_ok||!std::isfinite(a[i]))return false;}
 if(a[0]<0||a[1]<20||a[2]<16||a[3]<16||a[2]>32768||a[3]>32768)return false;
 *r=NSMakeRect(a[0],a[1],a[2],a[3]);return true;
}
static bool samePane(NSRect a,NSRect b){return std::abs(a.origin.x-b.origin.x)<=1&&std::abs(a.origin.y-b.origin.y)<=1&&std::abs(a.size.width-b.size.width)<=1&&std::abs(a.size.height-b.size.height)<=1;}
static napi_value paneCorners(napi_env e,napi_callback_info info){
 size_t n=1;napi_value args[1],answer;napi_get_cb_info(e,info,&n,args,nullptr,nullptr);uint32_t count=0;bool array=false;
 if(n!=1||napi_is_array(e,args[0],&array)!=napi_ok||!array||napi_get_array_length(e,args[0],&count)!=napi_ok||count>100||!NSThread.isMainThread){napi_throw_error(e,nullptr,"Invalid owned pane layout");return nullptr;}
 NSView* root=mouseWindow.contentView;int applied=0;
 if(root&&!windowClosing){@try{
  NSMutableArray<NSValue*>* targets=[NSMutableArray new];
  for(uint32_t i=0;i<count;i++){napi_value v;napi_get_element(e,args[0],i,&v);NSRect r;if(!rectValue(e,v,&r)||NSMaxX(r)>NSWidth(root.bounds)+1||NSMaxY(r)>NSHeight(root.bounds)+1){napi_throw_error(e,nullptr,"Out-of-bounds pane rectangle");return nullptr;}[targets addObject:[NSValue valueWithRect:r]];}
  if(!paneMasks)paneMasks=[NSMapTable weakToStrongObjectsMapTable];
  NSMutableArray<NSView*>* pages=[NSMutableArray new];NSUInteger visited=0;pageViews(root,root,pages,&visited);
  NSHashTable<NSView*>* selected=[NSHashTable weakObjectsHashTable];
  [CATransaction begin];[CATransaction setDisableActions:YES];
  for(NSView* page in pages){
   NSRect r=paneRect(page,root);BOOL match=NO;for(NSValue* target in targets)if(samePane(r,target.rectValue)){match=YES;break;}
   if(!match||page.window!=mouseWindow)continue;
   [selected addObject:page];page.wantsLayer=YES;CALayer* layer=page.layer;if(!layer)continue;
   NSDictionary* prior=[paneMasks objectForKey:page];
   if(!prior){CAShapeLayer* mask=[CAShapeLayer layer];prior=@{@"original":layer.mask?:NSNull.null,@"ours":mask};[paneMasks setObject:prior forKey:page];}
   CAShapeLayer* mask=prior[@"ours"];CGFloat w=NSWidth(page.bounds),h=NSHeight(page.bounds),radius=MIN(8,MIN(w,h)/2);
   // Reflect the bottom-rounded path for a native top-left coordinate origin.
   CGMutablePathRef path=CGPathCreateMutable();CGPathMoveToPoint(path,nullptr,0,h);CGPathAddLineToPoint(path,nullptr,w,h);CGPathAddLineToPoint(path,nullptr,w,radius);CGPathAddArcToPoint(path,nullptr,w,0,w-radius,0,radius);CGPathAddLineToPoint(path,nullptr,radius,0);CGPathAddArcToPoint(path,nullptr,0,0,0,radius,radius);CGPathCloseSubpath(path);
   CGPathRef finalPath=path;if(page.isFlipped){CGAffineTransform flip=CGAffineTransformMake(1,0,0,-1,0,h);finalPath=CGPathCreateCopyByTransformingPath(path,&flip);}
   mask.frame=CGRectMake(0,0,w,h);mask.fillColor=NSColor.blackColor.CGColor;mask.path=finalPath;mask.contentsScale=mouseWindow.backingScaleFactor;layer.mask=mask;
   if(finalPath!=path)CGPathRelease(finalPath);CGPathRelease(path);applied++;
  }
  for(NSView* page in paneMasks.keyEnumerator.allObjects){if([selected containsObject:page])continue;NSDictionary* prior=[paneMasks objectForKey:page];if(page.layer.mask==prior[@"ours"])page.layer.mask=prior[@"original"]==NSNull.null?nil:prior[@"original"];[paneMasks removeObjectForKey:page];}
  [CATransaction commit];
 }@catch(NSException* ex){NSLog(@"Mouse page mask rejected: %@",ex.name);}}
 napi_create_int32(e,applied,&answer);return answer;
}
// Geometry-only diagnostics, inaccessible to webpages and normal application IPC.
static napi_value testPaneViews(napi_env e,napi_callback_info info){
 if(!std::getenv("CI")||!std::getenv("MOUSE_TEST_PROFILE")){napi_throw_error(e,nullptr,"Pane probe is CI-only");return nullptr;}
 NSView* root=mouseWindow.contentView;NSMutableArray* output=[NSMutableArray new],*queue=[NSMutableArray new];if(root)[queue addObject:root];
 while(queue.count&&output.count<256){NSView* v=queue.firstObject;[queue removeObjectAtIndex:0];NSRect r=paneRect(v,root);[output addObject:@{@"name":NSStringFromClass(v.class),@"x":@(r.origin.x),@"y":@(r.origin.y),@"w":@(r.size.width),@"h":@(r.size.height),@"flipped":@(v.isFlipped),@"layerFlipped":@(v.layer.geometryFlipped),@"masked":@(v.layer.mask!=nil),@"hidden":@(v.hidden)}];[queue addObjectsFromArray:v.subviews];}
 NSData* data=[NSJSONSerialization dataWithJSONObject:output options:0 error:nil];napi_value result;napi_create_string_utf8(e,(const char*)data.bytes,data.length,&result);return result;
}
'''
p=R/'desktop/mouse-native-menu.mm';s=p.read_text();assert 'paneCorners' not in s;s=s.replace('static napi_value init(',fragment+'\nstatic napi_value init(');s=s.replace('{"testClick",0,testClick,0,0,0,napi_default,0}};','{"testClick",0,testClick,0,0,0,napi_default,0},{"paneCorners",0,paneCorners,0,0,0,napi_default,0},{"testPaneViews",0,testPaneViews,0,0,0,napi_default,0}};').replace('napi_define_properties(e,exports,6,d);','napi_define_properties(e,exports,8,d);');p.write_text(s)
print('Native page-corner mask patch applied; actual pixel assertion retained')
