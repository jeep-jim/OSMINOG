#import <Cocoa/Cocoa.h>
#import <CoreGraphics/CoreGraphics.h>
#include <node_api.h>
#include <cstring>
#include <cstdlib>
#include <cmath>
#include <initializer_list>
static __weak NSWindow* mouseWindow=nil;
static NSMutableArray* observers;
static BOOL hasSaved=NO,menuHeld=NO;
static NSApplicationPresentationOptions savedOptions,hoverOptions;
static NSHashTable<NSView*>* hiddenTitleViews;
static NSHashTable<NSWindow*>* hiddenTitleWindows;
// Hide ONLY chrome obtained from this window's standard traffic-light buttons.
// Electron adds Titled during native fullscreen for AppKit stability; removing
// that style mask can crash. Keep the style, but remove its redundant title view
// and make its auxiliary fullscreen title window non-interactive. The actual
// Apple menu/status window is not owned by these buttons and is never touched.
static BOOL suppressing=NO,titlePending=NO,windowClosing=NO;
static void suppressTitleChromeUnsafe(){
 NSWindow* w=mouseWindow;if(!w)return;
 if(w.titleVisibility!=NSWindowTitleHidden)w.titleVisibility=NSWindowTitleHidden;if(!w.titlebarAppearsTransparent)w.titlebarAppearsTransparent=YES;
 for(NSNumber* kind in @[@(NSWindowCloseButton),@(NSWindowMiniaturizeButton),@(NSWindowZoomButton)]){
  NSButton* button=[w standardWindowButton:(NSWindowButton)kind.integerValue];if(!button.hidden)button.hidden=YES;
  NSView* view=button.superview;
  while(view&&view!=w.contentView&&view!=w.contentView.superview){
   if(view.bounds.size.height>140)break;
   if(!view.hidden)view.hidden=YES;if(view.alphaValue!=0)view.alphaValue=0;
   [hiddenTitleViews addObject:view];
   NSWindow* chrome=view.window;
   if(chrome&&chrome!=w){
    // Never change a different application window, dialog, capture editor or
    // the system menu. The window must host the original standard buttons.
    if(button.window==chrome){chrome.ignoresMouseEvents=YES;chrome.alphaValue=0;[hiddenTitleWindows addObject:chrome];}
   }
   view=view.superview;
  }
 }
}

static void suppressTitleChrome(){
 if(!NSThread.isMainThread||suppressing||windowClosing||!mouseWindow)return;
 suppressing=YES;
 @try{suppressTitleChromeUnsafe();}@catch(NSException* ex){NSLog(@"Mouse title update rejected: %@",ex.name);}@finally{suppressing=NO;}
}
static void queueTitleChrome(){
 if(titlePending||windowClosing)return;titlePending=YES;
 dispatch_async(dispatch_get_main_queue(),^{titlePending=NO;suppressTitleChrome();});
}
static NSWindow* windowFrom(napi_env env,napi_value v){
 void* data=nullptr;size_t size=0;bool isBuffer=false;
 napi_is_buffer(env,v,&isBuffer);if(!isBuffer||napi_get_buffer_info(env,v,&data,&size)!=napi_ok||size!=sizeof(void*))return nil;
 void* p=nullptr;memcpy(&p,data,sizeof(void*));NSView* view=(__bridge NSView*)p;return view.window;
}
static bool fullscreen(){return mouseWindow&&(mouseWindow.styleMask&NSWindowStyleMaskFullScreen);}
static void windowCorners(){NSView* root=mouseWindow.contentView.superview?:mouseWindow.contentView;root.wantsLayer=YES;root.layer.cornerRadius=fullscreen()?0:12;root.layer.masksToBounds=YES;}
static void restoreHover(){
 if(!menuHeld)return;menuHeld=NO;
 @try{NSApp.presentationOptions=hoverOptions;}@catch(NSException* e){NSLog(@"Mouse menu restore rejected: %@",e.name);}
}
static void ensureSystemMenu(){
 if(!fullscreen())return;
 NSApplicationPresentationOptions p=NSApp.presentationOptions;
 const bool wasHidden=(p&NSApplicationPresentationHideMenuBar)!=0;
 p&=~(NSApplicationPresentationHideMenuBar|NSApplicationPresentationDisableAppleMenu);
 if(wasHidden){p|=NSApplicationPresentationAutoHideMenuBar;if(!(p&NSApplicationPresentationHideDock))p|=NSApplicationPresentationAutoHideDock;}
 mouseWindow.level=NSNormalWindowLevel;windowCorners();suppressTitleChrome();
 if(p!=NSApp.presentationOptions)@try{NSApp.presentationOptions=p;}@catch(NSException* e){NSLog(@"Mouse menu presentation rejected: %@",e.name);}
}
static void boolean(napi_env e,napi_value o,const char* k,bool x){napi_value v;napi_get_boolean(e,x,&v);napi_set_named_property(e,o,k,v);}
static void number(napi_env e,napi_value o,const char* k,double x){napi_value v;napi_create_double(e,x,&v);napi_set_named_property(e,o,k,v);}
static napi_value state(napi_env e,napi_callback_info info){
 suppressTitleChrome();napi_value o;napi_create_object(e,&o);NSWindow* w=mouseWindow;auto p=NSApp.currentSystemPresentationOptions;
 boolean(e,o,"attached",w!=nil);boolean(e,o,"fullscreen",fullscreen());boolean(e,o,"appActive",NSApp.active);boolean(e,o,"keyWindow",w.keyWindow);boolean(e,o,"held",menuHeld);boolean(e,o,"titled",(w.styleMask&NSWindowStyleMaskTitled)!=0);number(e,o,"styleMask",w.styleMask);
 boolean(e,o,"menuVisible",NSMenu.menuBarVisible);boolean(e,o,"menuHidden",(p&NSApplicationPresentationHideMenuBar)!=0);boolean(e,o,"appleMenuDisabled",(p&NSApplicationPresentationDisableAppleMenu)!=0);
 boolean(e,o,"systemDark",[[NSUserDefaults.standardUserDefaults stringForKey:@"AppleInterfaceStyle"] isEqualToString:@"Dark"]);
 number(e,o,"presentation",NSApp.presentationOptions);number(e,o,"systemPresentation",p);number(e,o,"activationPolicy",NSApp.activationPolicy);
 number(e,o,"suppressedTitleViews",hiddenTitleViews.count);number(e,o,"suppressedTitleWindows",hiddenTitleWindows.count);number(e,o,"mainMenuItems",NSApp.mainMenu.numberOfItems);number(e,o,"windowLevel",w?w.level:0);
 NSScreen* s=w.screen?:NSScreen.mainScreen;double height=MAX(NSStatusBar.systemStatusBar.thickness,s.safeAreaInsets.top);
 double topGap=0;if(w&&s){NSRect r=[w convertRectToScreen:[w.contentView convertRect:w.contentView.bounds toView:nil]];topGap=MAX(0,NSMaxY(s.frame)-NSMaxY(r));}
 number(e,o,"menuHeight",height);number(e,o,"contentTopGap",topGap);number(e,o,"inset",fullscreen()&&NSMenu.menuBarVisible?MAX(0,height-topGap):0);return o;
}
static napi_value install(napi_env e,napi_callback_info info){
 size_t n=1;napi_value args[1];napi_get_cb_info(e,info,&n,args,nullptr,nullptr);
 if(!NSThread.isMainThread||n!=1){napi_throw_error(e,nullptr,"Main UI thread and native handle required");return nullptr;}
 NSWindow* w=windowFrom(e,args[0]);if(!w){napi_throw_error(e,nullptr,"Invalid native window");return nullptr;}
 windowClosing=NO;mouseWindow=w;observers=[NSMutableArray new];hiddenTitleViews=[NSHashTable weakObjectsHashTable];hiddenTitleWindows=[NSHashTable weakObjectsHashTable];windowCorners();suppressTitleChrome();
 NSNotificationCenter* c=NSNotificationCenter.defaultCenter;
 [observers addObject:[c addObserverForName:NSApplicationDidUpdateNotification object:NSApp queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification* note){queueTitleChrome();}]];

 [observers addObject:[c addObserverForName:NSWindowWillEnterFullScreenNotification object:w queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification* note){savedOptions=NSApp.presentationOptions;hasSaved=YES;}]];
 [observers addObject:[c addObserverForName:NSWindowDidEnterFullScreenNotification object:w queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification* note){dispatch_async(dispatch_get_main_queue(),^{ensureSystemMenu();});}]];
 [observers addObject:[c addObserverForName:NSWindowDidBecomeKeyNotification object:w queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification* note){ensureSystemMenu();}]];
 [observers addObject:[c addObserverForName:NSWindowWillExitFullScreenNotification object:w queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification* note){restoreHover();}]];
 [observers addObject:[c addObserverForName:NSWindowDidExitFullScreenNotification object:w queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification* note){menuHeld=NO;windowCorners();if(hasSaved){@try{NSApp.presentationOptions=savedOptions;}@catch(NSException* e){}hasSaved=NO;}}]];
 [observers addObject:[c addObserverForName:NSWindowWillCloseNotification object:w queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification* note){windowClosing=YES;restoreHover();for(id token in observers)[NSNotificationCenter.defaultCenter removeObserver:token];observers=nil;mouseWindow=nil;}]];
 return state(e,info);
}
static napi_value reveal(napi_env e,napi_callback_info info){
 if(fullscreen()&&NSApp.active){
  ensureSystemMenu();
  if(!menuHeld){
   hoverOptions=NSApp.presentationOptions;
   auto p=NSApp.currentSystemPresentationOptions;
   p&=~(NSApplicationPresentationHideMenuBar|NSApplicationPresentationAutoHideMenuBar|NSApplicationPresentationAutoHideToolbar|NSApplicationPresentationDisableAppleMenu);
   @try{NSApp.presentationOptions=p;menuHeld=YES;}@catch(NSException* ex){NSLog(@"Mouse menu reveal rejected: %@",ex.name);}
  }
  [NSMenu setMenuBarVisible:YES];suppressTitleChrome();
 }
 return state(e,info);
}
static napi_value release(napi_env e,napi_callback_info info){restoreHover();return state(e,info);}
// CI-only native pointer movement. Never exposed through IPC/preload or normal UI.
static napi_value testPointer(napi_env e,napi_callback_info info){
 const char* ci=std::getenv("CI");
 if(!ci||std::strcmp(ci,"true")!=0||!std::getenv("MOUSE_TEST_PROFILE")||![NSProcessInfo.processInfo.arguments containsObject:@"--mouse-smoke-write"]){napi_throw_error(e,nullptr,"Pointer probe is CI smoke-only");return nullptr;}
 size_t n=2;napi_value args[2];napi_get_cb_info(e,info,&n,args,nullptr,nullptr);double x=0,y=0;
 if(n!=2||napi_get_value_double(e,args[0],&x)!=napi_ok||napi_get_value_double(e,args[1],&y)!=napi_ok||!std::isfinite(x)||!std::isfinite(y)){napi_throw_error(e,nullptr,"Invalid pointer probe");return nullptr;}
 CGPoint point=CGPointMake(x,y);CGError result=CGWarpMouseCursorPosition(point);
 CGEventRef event=CGEventCreateMouseEvent(nullptr,kCGEventMouseMoved,point,kCGMouseButtonLeft);if(event){CGEventPost(kCGHIDEventTap,event);CFRelease(event);}
 napi_value o;napi_create_object(e,&o);number(e,o,"warpResult",result);boolean(e,o,"postAccess",CGPreflightPostEventAccess());return o;
}
static napi_value testClick(napi_env e,napi_callback_info info){
 const char* ci=std::getenv("CI");
 if(!ci||std::strcmp(ci,"true")!=0||!std::getenv("MOUSE_TEST_PROFILE")||![NSProcessInfo.processInfo.arguments containsObject:@"--mouse-smoke-write"]){napi_throw_error(e,nullptr,"Click probe is CI smoke-only");return nullptr;}
 size_t n=2;napi_value args[2];napi_get_cb_info(e,info,&n,args,nullptr,nullptr);double x=0,y=0;
 if(n!=2||napi_get_value_double(e,args[0],&x)!=napi_ok||napi_get_value_double(e,args[1],&y)!=napi_ok||!std::isfinite(x)||!std::isfinite(y)){napi_throw_error(e,nullptr,"Invalid click probe");return nullptr;}
 CGPoint p=CGPointMake(x,y);CGWarpMouseCursorPosition(p);
 for(CGEventType type : {kCGEventMouseMoved,kCGEventLeftMouseDown,kCGEventLeftMouseUp}){CGEventRef event=CGEventCreateMouseEvent(nullptr,type,p,kCGMouseButtonLeft);if(event){CGEventSetIntegerValueField(event,kCGMouseEventClickState,1);CGEventPost(kCGHIDEventTap,event);CFRelease(event);}}
 napi_value value;napi_get_boolean(e,CGPreflightPostEventAccess(),&value);return value;
}
// Mouse's internal horizontal seams require a real native-page mask. A generic
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

static napi_value init(napi_env e,napi_value exports){
 napi_property_descriptor d[]={{"install",0,install,0,0,0,napi_default,0},{"state",0,state,0,0,0,napi_default,0},{"reveal",0,reveal,0,0,0,napi_default,0},{"release",0,release,0,0,0,napi_default,0},{"testPointer",0,testPointer,0,0,0,napi_default,0},{"testClick",0,testClick,0,0,0,napi_default,0},{"paneCorners",0,paneCorners,0,0,0,napi_default,0},{"testPaneViews",0,testPaneViews,0,0,0,napi_default,0}};
 napi_define_properties(e,exports,8,d);return exports;
}
NAPI_MODULE(mouse_native_menu,init)
