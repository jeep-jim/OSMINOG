#import <Cocoa/Cocoa.h>
#import <CoreGraphics/CoreGraphics.h>
#include <node_api.h>
#include <cstring>
#include <cstdlib>
#include <cmath>
#include <cctype>
static void clearPaneTrim();
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
 clearPaneTrim();windowClosing=NO;mouseWindow=w;observers=[NSMutableArray new];hiddenTitleViews=[NSHashTable weakObjectsHashTable];hiddenTitleWindows=[NSHashTable weakObjectsHashTable];windowCorners();suppressTitleChrome();
 NSNotificationCenter* c=NSNotificationCenter.defaultCenter;
 [observers addObject:[c addObserverForName:NSApplicationDidUpdateNotification object:NSApp queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification* note){queueTitleChrome();}]];

 [observers addObject:[c addObserverForName:NSWindowWillEnterFullScreenNotification object:w queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification* note){savedOptions=NSApp.presentationOptions;hasSaved=YES;}]];
 [observers addObject:[c addObserverForName:NSWindowDidEnterFullScreenNotification object:w queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification* note){dispatch_async(dispatch_get_main_queue(),^{ensureSystemMenu();});}]];
 [observers addObject:[c addObserverForName:NSWindowDidBecomeKeyNotification object:w queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification* note){ensureSystemMenu();}]];
 [observers addObject:[c addObserverForName:NSWindowWillExitFullScreenNotification object:w queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification* note){restoreHover();}]];
 [observers addObject:[c addObserverForName:NSWindowDidExitFullScreenNotification object:w queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification* note){menuHeld=NO;windowCorners();if(hasSaved){@try{NSApp.presentationOptions=savedOptions;}@catch(NSException* e){}hasSaved=NO;}}]];
 [observers addObject:[c addObserverForName:NSWindowWillCloseNotification object:w queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification* note){windowClosing=YES;clearPaneTrim();restoreHover();for(id token in observers)[NSNotificationCenter.defaultCenter removeObserver:token];observers=nil;mouseWindow=nil;}]];
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
static bool nativeInputProbeAllowed(){
 const char* ci=std::getenv("CI"),*profile=std::getenv("MOUSE_TEST_PROFILE");
 // The isolated media regression runs after task/stress in its own process;
 // viewer and footer controls continue to run in the retained write process.
 // Owner feedback has its own isolated installed verification process.
 return ci&&std::strcmp(ci,"true")==0&&profile&&profile[0]=='/'&&
  ([NSProcessInfo.processInfo.arguments containsObject:@"--mouse-smoke-write"]||
   [NSProcessInfo.processInfo.arguments containsObject:@"--mouse-631-smoke"]||
   [NSProcessInfo.processInfo.arguments containsObject:@"--mouse-633-smoke"]||
   [NSProcessInfo.processInfo.arguments containsObject:@"--mouse-634-smoke"]||
   [NSProcessInfo.processInfo.arguments containsObject:@"--mouse-635-smoke"]);
}
static napi_value testPointer(napi_env e,napi_callback_info info){
 if(!nativeInputProbeAllowed()){napi_throw_error(e,nullptr,"Pointer probe is CI smoke-only");return nullptr;}
 size_t n=2;napi_value args[2];napi_get_cb_info(e,info,&n,args,nullptr,nullptr);double x=0,y=0;
 if(n!=2||napi_get_value_double(e,args[0],&x)!=napi_ok||napi_get_value_double(e,args[1],&y)!=napi_ok||!std::isfinite(x)||!std::isfinite(y)){napi_throw_error(e,nullptr,"Invalid pointer probe");return nullptr;}
 CGPoint point=CGPointMake(x,y);CGError result=CGWarpMouseCursorPosition(point);
 CGEventRef event=CGEventCreateMouseEvent(nullptr,kCGEventMouseMoved,point,kCGMouseButtonLeft);if(event){CGEventPost(kCGHIDEventTap,event);CFRelease(event);}
 napi_value o;napi_create_object(e,&o);number(e,o,"warpResult",result);boolean(e,o,"postAccess",CGPreflightPostEventAccess());return o;
}
static napi_value testClick(napi_env e,napi_callback_info info){
 if(!nativeInputProbeAllowed()){napi_throw_error(e,nullptr,"Click probe is CI smoke-only");return nullptr;}
 size_t n=2;napi_value args[2];napi_get_cb_info(e,info,&n,args,nullptr,nullptr);double x=0,y=0;
 if(n!=2||napi_get_value_double(e,args[0],&x)!=napi_ok||napi_get_value_double(e,args[1],&y)!=napi_ok||!std::isfinite(x)||!std::isfinite(y)){napi_throw_error(e,nullptr,"Invalid click probe");return nullptr;}
 CGPoint p=CGPointMake(x,y);CGWarpMouseCursorPosition(p);
 for(CGEventType type : {kCGEventMouseMoved,kCGEventLeftMouseDown,kCGEventLeftMouseUp}){CGEventRef event=CGEventCreateMouseEvent(nullptr,type,p,kCGMouseButtonLeft);if(event){CGEventSetIntegerValueField(event,kCGMouseEventClickState,1);CGEventPost(kCGHIDEventTap,event);CFRelease(event);}}
 napi_value value;napi_get_boolean(e,CGPreflightPostEventAccess(),&value);return value;
}
static napi_value testRightClick(napi_env e,napi_callback_info info){
 if(!nativeInputProbeAllowed()){napi_throw_error(e,nullptr,"Right-click probe is CI smoke-only");return nullptr;}
 size_t n=2;napi_value args[2];napi_get_cb_info(e,info,&n,args,nullptr,nullptr);double x=0,y=0;
 if(n!=2||napi_get_value_double(e,args[0],&x)!=napi_ok||napi_get_value_double(e,args[1],&y)!=napi_ok||!std::isfinite(x)||!std::isfinite(y)){napi_throw_error(e,nullptr,"Invalid right-click probe");return nullptr;}
 CGPoint p=CGPointMake(x,y);CGWarpMouseCursorPosition(p);
 for(CGEventType type : {kCGEventMouseMoved,kCGEventRightMouseDown,kCGEventRightMouseUp}){CGEventRef event=CGEventCreateMouseEvent(nullptr,type,p,kCGMouseButtonRight);if(event){CGEventSetIntegerValueField(event,kCGMouseEventClickState,1);CGEventPost(kCGHIDEventTap,event);CFRelease(event);}}
 napi_value value;napi_get_boolean(e,CGPreflightPostEventAccess(),&value);return value;
}
static napi_value testKey(napi_env e,napi_callback_info info){
 if(!nativeInputProbeAllowed()){napi_throw_error(e,nullptr,"Key probe is CI smoke-only");return nullptr;}
 size_t n=1,size=0;napi_value args[1];napi_get_cb_info(e,info,&n,args,nullptr,nullptr);char key[16];
 if(n!=1||napi_get_value_string_utf8(e,args[0],key,sizeof(key),&size)!=napi_ok||size==0||size>=sizeof(key)-1){napi_throw_error(e,nullptr,"Invalid native menu key");return nullptr;}
 CGKeyCode code=0;bool valid=true;
 if(!std::strcmp(key,"HOME"))code=115;else if(!std::strcmp(key,"END"))code=119;
 else if(!std::strcmp(key,"LEFT"))code=123;else if(!std::strcmp(key,"RIGHT"))code=124;
 else if(!std::strcmp(key,"DOWN"))code=125;else if(!std::strcmp(key,"UP"))code=126;
 else if(!std::strcmp(key,"ENTER"))code=36;else if(!std::strcmp(key,"ESC"))code=53;else valid=false;
 if(!valid){napi_throw_error(e,nullptr,"Unsupported native menu key");return nullptr;}
 for(bool down : {true,false}){CGEventRef event=CGEventCreateKeyboardEvent(nullptr,code,down);if(event){CGEventSetFlags(event,0);CGEventPost(kCGHIDEventTap,event);CFRelease(event);}}
 napi_value value;napi_get_boolean(e,CGPreflightPostEventAccess(),&value);return value;
}
// A noninteractive native chrome overlay paints only the tiny corner cut-outs.
// It sits above Chromium's compositor, not in the website DOM, and never changes
// the page viewport, scroll position, event routing or a hosted view's layers.
@interface MousePaneCornerTrim : NSView
@property(nonatomic,strong) NSArray<NSDictionary*>* panes;
@end
@implementation MousePaneCornerTrim
-(BOOL)isFlipped{return YES;}
-(BOOL)isOpaque{return NO;}
-(BOOL)acceptsFirstResponder{return NO;}
-(BOOL)isAccessibilityElement{return NO;}
-(NSView*)hitTest:(NSPoint)point{return nil;}
-(void)drawRect:(NSRect)dirty{
 // The layer is transparent: erase the previous geometry before repainting.
 // Otherwise resize/theme changes can leave stale rectangular corner fragments.
 CGContextRef context=NSGraphicsContext.currentContext.CGContext;
 CGContextClearRect(context,NSRectToCGRect(dirty));
 for(NSDictionary* item in self.panes){
  NSRect p=[item[@"rect"] rectValue];CGFloat radius=12,y=NSMaxY(p)-radius;
  NSColor* color=item[@"color"];
  for(int side=0;side<2;side++){
   CGFloat x=side?NSMaxX(p)-radius:NSMinX(p);
   // The DOM may end on a fractional DIP while the guest uses snapped endpoints.
   // One DIP of divider-colored overpaint OUTSIDE the arc covers that square rim;
   // the circle itself stays exactly 12 DIP and the page viewport never changes.
   NSRect corner=NSMakeRect(x-(side?0:1),y,radius+1,radius+1);
   if(!NSIntersectsRect(corner,dirty))continue;
   [NSGraphicsContext saveGraphicsState];NSRectClip(corner);
   NSBezierPath* path=[NSBezierPath bezierPathWithRect:corner];
   [path appendBezierPathWithOvalInRect:NSMakeRect(side?x-radius:x,y-radius,radius*2,radius*2)];
   path.windingRule=NSWindingRuleEvenOdd;[color setFill];[path fill];
   [NSGraphicsContext restoreGraphicsState];
  }
 }
}
@end
static MousePaneCornerTrim* paneTrim;
static void clearPaneTrim(){[paneTrim removeFromSuperview];paneTrim=nil;}
static napi_value paneCorners(napi_env e,napi_callback_info info){
 size_t n=1;napi_value args[1],answer;napi_get_cb_info(e,info,&n,args,nullptr,nullptr);uint32_t count=0;bool array=false;
 // Stale resize/layout frames must not be able to crash the application.
 if(n!=1||!NSThread.isMainThread||napi_is_array(e,args[0],&array)!=napi_ok||!array||napi_get_array_length(e,args[0],&count)!=napi_ok||count>100){napi_get_boolean(e,false,&answer);return answer;}
 NSView* root=mouseWindow.contentView;NSMutableArray* panes=[NSMutableArray new];
 @try{
  if(root&&!windowClosing){
   for(uint32_t i=0;i<count;i++){
    napi_value v;napi_get_element(e,args[0],i,&v);double a[4]={};const char* keys[]={"x","y","width","height"};BOOL valid=YES;
    for(int k=0;k<4;k++){napi_value value;if(napi_get_named_property(e,v,keys[k],&value)!=napi_ok||napi_get_value_double(e,value,&a[k])!=napi_ok||!std::isfinite(a[k])){valid=NO;break;}}
    if(!valid||a[0]<0||a[1]<20||a[2]<24||a[3]<24||a[0]+a[2]>NSWidth(root.bounds)+1||a[1]+a[3]>NSHeight(root.bounds)+1)continue;
    napi_value colorValue;char hex[9]={};size_t len=0;
    if(napi_get_named_property(e,v,"color",&colorValue)!=napi_ok||napi_get_value_string_utf8(e,colorValue,hex,sizeof(hex),&len)!=napi_ok||len!=7||hex[0]!='#')continue;
    BOOL hexOK=YES;for(int k=1;k<7;k++)if(!std::isxdigit((unsigned char)hex[k]))hexOK=NO;if(!hexOK)continue;
    unsigned long rgb=std::strtoul(hex+1,nullptr,16);
    NSColor* color=[NSColor colorWithSRGBRed:((rgb>>16)&255)/255.0 green:((rgb>>8)&255)/255.0 blue:(rgb&255)/255.0 alpha:1];
    [panes addObject:@{@"rect":[NSValue valueWithRect:NSMakeRect(a[0],a[1],a[2],a[3])],@"color":color}];
   }
  }
  if(!panes.count){clearPaneTrim();}
  else{
   if(!paneTrim){paneTrim=[[MousePaneCornerTrim alloc] initWithFrame:root.bounds];paneTrim.autoresizingMask=NSViewWidthSizable|NSViewHeightSizable;paneTrim.wantsLayer=YES;}
   BOOL changed=![paneTrim.panes isEqual:panes]||!NSEqualRects(paneTrim.frame,root.bounds);
   paneTrim.frame=root.bounds;paneTrim.panes=panes;
   if(paneTrim.superview!=root||root.subviews.lastObject!=paneTrim)[root addSubview:paneTrim positioned:NSWindowAbove relativeTo:nil];
   if(changed)[paneTrim setNeedsDisplay:YES];
  }
 }@catch(NSException* ex){clearPaneTrim();NSLog(@"Mouse corner trim skipped: %@",ex.name);}
 napi_create_uint32(e,(uint32_t)panes.count,&answer);return answer;
}

// Queried only while servicing an explicit image drag; no input capture or log.
static napi_value primaryDown(napi_env e,napi_callback_info info){napi_value value;napi_get_boolean(e,CGEventSourceButtonState(kCGEventSourceStateCombinedSessionState,kCGMouseButtonLeft),&value);return value;}
static napi_value testMouse(napi_env e,napi_callback_info info){
 if(!nativeInputProbeAllowed()){napi_throw_error(e,nullptr,"Mouse probe is CI smoke-only");return nullptr;}
 size_t n=3;napi_value a[3];napi_get_cb_info(e,info,&n,a,nullptr,nullptr);double x=0,y=0;int32_t kind=0;
 if(n!=3||napi_get_value_double(e,a[0],&x)!=napi_ok||napi_get_value_double(e,a[1],&y)!=napi_ok||napi_get_value_int32(e,a[2],&kind)!=napi_ok||!std::isfinite(x)||!std::isfinite(y)||kind<0||kind>2){napi_throw_error(e,nullptr,"Invalid mouse probe");return nullptr;}
 CGPoint p=CGPointMake(x,y);CGEventType type=kind==0?kCGEventLeftMouseDown:kind==1?kCGEventLeftMouseDragged:kCGEventLeftMouseUp;CGEventRef event=CGEventCreateMouseEvent(nullptr,type,p,kCGMouseButtonLeft);if(event){CGEventSetIntegerValueField(event,kCGMouseEventClickState,1);CGEventPost(kCGHIDEventTap,event);CFRelease(event);}napi_value value;napi_get_boolean(e,true,&value);return value;
}
static napi_value init(napi_env e,napi_value exports){
 napi_property_descriptor d[]={{"primaryDown",0,primaryDown,0,0,0,napi_default,0},{"testMouse",0,testMouse,0,0,0,napi_default,0},{"install",0,install,0,0,0,napi_default,0},{"state",0,state,0,0,0,napi_default,0},{"reveal",0,reveal,0,0,0,napi_default,0},{"release",0,release,0,0,0,napi_default,0},{"testPointer",0,testPointer,0,0,0,napi_default,0},{"testClick",0,testClick,0,0,0,napi_default,0},{"testRightClick",0,testRightClick,0,0,0,napi_default,0},{"testKey",0,testKey,0,0,0,napi_default,0},{"paneCorners",0,paneCorners,0,0,0,napi_default,0}};
 napi_define_properties(e,exports,11,d);return exports;
}
NAPI_MODULE(mouse_native_menu,init)
