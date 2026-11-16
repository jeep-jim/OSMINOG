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
static napi_value init(napi_env e,napi_value exports){
 napi_property_descriptor d[]={{"install",0,install,0,0,0,napi_default,0},{"state",0,state,0,0,0,napi_default,0},{"reveal",0,reveal,0,0,0,napi_default,0},{"release",0,release,0,0,0,napi_default,0},{"testPointer",0,testPointer,0,0,0,napi_default,0},{"testClick",0,testClick,0,0,0,napi_default,0}};
 napi_define_properties(e,exports,6,d);return exports;
}
NAPI_MODULE(mouse_native_menu,init)
