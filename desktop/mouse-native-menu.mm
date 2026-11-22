#import <Cocoa/Cocoa.h>
#import <CoreGraphics/CoreGraphics.h>
#include <node_api.h>
#include <cstring>
#include <cstdlib>
#include <cmath>
#include <cctype>
static void clearPaneTrim();
static void clearInputTrace();
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
 clearInputTrace();clearPaneTrim();windowClosing=NO;mouseWindow=w;observers=[NSMutableArray new];hiddenTitleViews=[NSHashTable weakObjectsHashTable];hiddenTitleWindows=[NSHashTable weakObjectsHashTable];windowCorners();suppressTitleChrome();
 NSNotificationCenter* c=NSNotificationCenter.defaultCenter;
 [observers addObject:[c addObserverForName:NSApplicationDidUpdateNotification object:NSApp queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification* note){queueTitleChrome();}]];

 [observers addObject:[c addObserverForName:NSWindowWillEnterFullScreenNotification object:w queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification* note){savedOptions=NSApp.presentationOptions;hasSaved=YES;}]];
 [observers addObject:[c addObserverForName:NSWindowDidEnterFullScreenNotification object:w queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification* note){dispatch_async(dispatch_get_main_queue(),^{ensureSystemMenu();});}]];
 [observers addObject:[c addObserverForName:NSWindowDidBecomeKeyNotification object:w queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification* note){ensureSystemMenu();}]];
 [observers addObject:[c addObserverForName:NSWindowWillExitFullScreenNotification object:w queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification* note){restoreHover();}]];
 [observers addObject:[c addObserverForName:NSWindowDidExitFullScreenNotification object:w queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification* note){menuHeld=NO;windowCorners();if(hasSaved){@try{NSApp.presentationOptions=savedOptions;}@catch(NSException* e){}hasSaved=NO;}}]];
 [observers addObject:[c addObserverForName:NSWindowWillCloseNotification object:w queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification* note){windowClosing=YES;clearInputTrace();clearPaneTrim();restoreHover();for(id token in observers)[NSNotificationCenter.defaultCenter removeObserver:token];observers=nil;mouseWindow=nil;}]];
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
   [NSProcessInfo.processInfo.arguments containsObject:@"--mouse-635-smoke"]||
   [NSProcessInfo.processInfo.arguments containsObject:@"--mouse-636-retained-smoke"]||
   [NSProcessInfo.processInfo.arguments containsObject:@"--mouse-636-smoke"]||
   [NSProcessInfo.processInfo.arguments containsObject:@"--mouse-637-smoke"]||
   [NSProcessInfo.processInfo.arguments containsObject:@"--mouse-637-features-smoke"]||
   [NSProcessInfo.processInfo.arguments containsObject:@"--mouse-637-features-restore-read"]);
}
// Opt-in, owned-window diagnostics only. The monitor returns the exact original
// NSEvent and never posts input, changes focus or pumps the event loop. Local
// monitors see NSApplication sendEvent dispatch, not nested tracking loops.
static id inputTraceMonitor;
static __weak NSWindow* inputTraceWindow;
static NSMutableArray<NSDictionary*>* inputTraceEvents;
static NSMutableArray<NSDictionary*>* inputTraceErrors;
static NSPointerArray* inputTraceIdentities;
static NSMutableDictionary<NSString*,NSNumber*>* inputTraceSkippedNil;
static NSMutableDictionary<NSString*,NSNumber*>* inputTraceSkippedOther;
static NSUInteger inputTraceTotal=0,inputTraceDropped=0,inputTraceErrorCount=0,inputTraceTruncatedStrings=0,inputTraceTruncatedChains=0,inputTraceTruncatedIdentities=0;
static bool inputTraceAllowed(){
 const char* flag=std::getenv("MOUSE_GUEST_INPUT_DIAGNOSTICS");
 return nativeInputProbeAllowed()&&flag&&std::strcmp(flag,"1")==0&&[NSProcessInfo.processInfo.arguments containsObject:@"--mouse-636-retained-smoke"];
}
static NSString* inputTraceText(NSString* value){if(!value)return @"";if(value.length<=96)return value;inputTraceTruncatedStrings++;return [value substringToIndex:96];}
static id inputTraceNumber(double value){return std::isfinite(value)?@(value):NSNull.null;}
static NSDictionary* inputTracePoint(NSPoint p){return @{@"x":inputTraceNumber(p.x),@"y":inputTraceNumber(p.y)};}
static NSDictionary* inputTraceRect(NSRect r){return @{@"x":inputTraceNumber(r.origin.x),@"y":inputTraceNumber(r.origin.y),@"width":inputTraceNumber(r.size.width),@"height":inputTraceNumber(r.size.height)};}
static id inputTraceIdentity(id object){
 if(!object)return NSNull.null;
 for(NSUInteger i=0;i<inputTraceIdentities.count;i++)if([inputTraceIdentities pointerAtIndex:i]==(__bridge void*)object)return @(i+1);
 if(inputTraceIdentities.count>=64){inputTraceTruncatedIdentities++;return NSNull.null;}
 [inputTraceIdentities addPointer:(__bridge void*)object];return @(inputTraceIdentities.count);
}
static id inputTraceDescribe(id object){
 if(!object)return NSNull.null;
 NSMutableDictionary* result=[@{@"class":inputTraceText(NSStringFromClass([object class])),@"identity":inputTraceIdentity(object)} mutableCopy];
 if([object isKindOfClass:NSView.class]){NSView* view=(NSView*)object;[result addEntriesFromDictionary:@{@"frame":inputTraceRect(view.frame),@"bounds":inputTraceRect(view.bounds),@"flipped":@(view.flipped),@"hidden":@(view.hidden),@"hiddenOrAncestorHidden":@([view isHiddenOrHasHiddenAncestor]),@"windowNumber":view.window?@(view.window.windowNumber):NSNull.null}];}
 return result;
}
static NSDictionary* inputTraceWindowState(NSWindow* w){
 return @{@"appActive":@(NSApp.active),@"ownedWindowNumber":w?@(w.windowNumber):NSNull.null,@"ownedKeyWindow":@(w&&w.keyWindow),@"ownedMainWindow":@(w&&w.mainWindow),@"appKeyIsOwned":@(w&&NSApp.keyWindow==w),@"appMainIsOwned":@(w&&NSApp.mainWindow==w),@"visible":@(w&&w.visible),@"miniaturized":@(w&&w.miniaturized),@"firstResponder":inputTraceDescribe(w.firstResponder)};
}
static NSDictionary* inputTraceHit(NSWindow* w,NSPoint windowPoint){
 NSView* receiver=w.contentView;NSView* parent=receiver.superview;
 // NSView hitTest: takes SUPERview coordinates, matching Chromium's hit guard.
 NSPoint point=parent?[parent convertPoint:windowPoint fromView:nil]:windowPoint;
 NSView* hit=receiver?[receiver hitTest:point]:nil;NSMutableArray* chain=[NSMutableArray new];NSView* view=hit;
 while(view&&chain.count<8){[chain addObject:inputTraceDescribe(view)];view=view.superview;}
 BOOL truncated=view!=nil;if(truncated)inputTraceTruncatedChains++;
 return @{@"scope":@"contentView hitTest observation before dispatch; not proof of final recipient",@"locationInWindow":inputTracePoint(windowPoint),@"receiver":inputTraceDescribe(receiver),@"receiverSuperview":inputTraceDescribe(parent),@"hitTestPointInReceiverSuperview":inputTracePoint(point),@"hit":inputTraceDescribe(hit),@"hitSuperviewChain":chain,@"chainTruncated":@(truncated)};
}
static void inputTraceRecordError(NSException* exception){
 inputTraceErrorCount++;if(inputTraceErrors.count<4)[inputTraceErrors addObject:@{@"name":inputTraceText(exception.name),@"message":inputTraceText(exception.reason),@"observedSystemUptimeSeconds":inputTraceNumber(NSProcessInfo.processInfo.systemUptime)}];
}
static void clearInputTrace(){
 if(inputTraceMonitor)[NSEvent removeMonitor:inputTraceMonitor];inputTraceMonitor=nil;inputTraceWindow=nil;
 inputTraceEvents=nil;inputTraceErrors=nil;inputTraceIdentities=nil;inputTraceSkippedNil=nil;inputTraceSkippedOther=nil;
}
static napi_value inputTraceValue(napi_env e,id object){
 napi_value value;
 if(!object||object==NSNull.null){napi_get_null(e,&value);return value;}
 if([object isKindOfClass:NSString.class]){napi_create_string_utf8(e,[(NSString*)object UTF8String],NAPI_AUTO_LENGTH,&value);return value;}
 if([object isKindOfClass:NSNumber.class]){if(CFGetTypeID((__bridge CFTypeRef)object)==CFBooleanGetTypeID())napi_get_boolean(e,[(NSNumber*)object boolValue],&value);else napi_create_double(e,[(NSNumber*)object doubleValue],&value);return value;}
 if([object isKindOfClass:NSArray.class]){napi_create_array_with_length(e,[(NSArray*)object count],&value);uint32_t i=0;for(id item in (NSArray*)object)napi_set_element(e,value,i++,inputTraceValue(e,item));return value;}
 if([object isKindOfClass:NSDictionary.class]){napi_create_object(e,&value);for(NSString* key in (NSDictionary*)object)napi_set_named_property(e,value,key.UTF8String,inputTraceValue(e,[(NSDictionary*)object objectForKey:key]));return value;}
 napi_get_null(e,&value);return value;
}
static napi_value inputTraceInstall(napi_env e,napi_callback_info info){
 if(!NSThread.isMainThread||!inputTraceAllowed()){napi_throw_error(e,nullptr,"Input trace is opt-in retained CI smoke-only on the main UI thread");return nullptr;}
 size_t count=1;napi_value args[1];napi_get_cb_info(e,info,&count,args,nullptr,nullptr);
 if(count!=1||windowClosing||!mouseWindow||windowFrom(e,args[0])!=mouseWindow){napi_throw_error(e,nullptr,"Input trace requires the installed owned window");return nullptr;}
 @try{
  if(inputTraceMonitor)return inputTraceValue(e,@{@"installed":@YES,@"reused":@YES});
  inputTraceWindow=mouseWindow;inputTraceEvents=[NSMutableArray new];inputTraceErrors=[NSMutableArray new];inputTraceIdentities=[NSPointerArray weakObjectsPointerArray];inputTraceSkippedNil=[NSMutableDictionary new];inputTraceSkippedOther=[NSMutableDictionary new];
  inputTraceTotal=inputTraceDropped=inputTraceErrorCount=inputTraceTruncatedStrings=inputTraceTruncatedChains=inputTraceTruncatedIdentities=0;
  inputTraceMonitor=[NSEvent addLocalMonitorForEventsMatchingMask:NSEventMaskMouseMoved|NSEventMaskLeftMouseDown|NSEventMaskLeftMouseUp handler:^NSEvent*(NSEvent* event){
   @try{
    NSWindow* owned=inputTraceWindow;NSString* type=event.type==NSEventTypeMouseMoved?@"mouseMoved":event.type==NSEventTypeLeftMouseDown?@"leftMouseDown":@"leftMouseUp";
    if(owned&&event.window==owned&&event.windowNumber==owned.windowNumber){
     NSUInteger sequence=++inputTraceTotal;
     NSDictionary* row=@{@"sequence":@(sequence),@"type":type,@"typeNumber":@(event.type),@"eventNumber":@(event.eventNumber),@"eventTimestampSeconds":inputTraceNumber(event.timestamp),@"observedSystemUptimeSeconds":inputTraceNumber(NSProcessInfo.processInfo.systemUptime),@"windowNumber":@(event.windowNumber),@"ownedWindowMatched":@YES,@"locationInWindow":inputTracePoint(event.locationInWindow),@"buttonNumber":@(event.buttonNumber),@"clickCount":event.type==NSEventTypeMouseMoved?NSNull.null:@(event.clickCount),@"modifierFlags":@(event.modifierFlags),@"window":inputTraceWindowState(owned),@"hitTest":inputTraceHit(owned,event.locationInWindow)};
     if(inputTraceEvents.count>=64){[inputTraceEvents removeObjectAtIndex:16];inputTraceDropped++;}[inputTraceEvents addObject:row];
    }else{NSMutableDictionary* skipped=event.window?inputTraceSkippedOther:inputTraceSkippedNil;skipped[type]=@([skipped[type] unsignedIntegerValue]+1);}
   }@catch(NSException* exception){@try{inputTraceRecordError(exception);}@catch(NSException* ignored){}}
   return event;
  }];
  return inputTraceValue(e,@{@"installed":@(inputTraceMonitor!=nil),@"reused":@NO,@"ownedWindowNumber":@(mouseWindow.windowNumber)});
 }@catch(NSException* exception){clearInputTrace();return inputTraceValue(e,@{@"installed":@NO,@"diagnosticError":inputTraceText(exception.name)});}
}
static napi_value inputTraceRead(napi_env e,napi_callback_info info){
 if(!NSThread.isMainThread||!inputTraceAllowed()){napi_throw_error(e,nullptr,"Input trace is opt-in retained CI smoke-only on the main UI thread");return nullptr;}
 size_t count=2;napi_value args[2];napi_get_cb_info(e,info,&count,args,nullptr,nullptr);double x=0,y=0;
 if(count!=0&&(count!=2||napi_get_value_double(e,args[0],&x)!=napi_ok||napi_get_value_double(e,args[1],&y)!=napi_ok||!std::isfinite(x)||!std::isfinite(y))){napi_throw_error(e,nullptr,"Input trace point must be two finite content-relative coordinates");return nullptr;}
 @try{
  NSWindow* w=inputTraceWindow;id hit=NSNull.null;NSView* root=w.contentView;
  if(count==2&&root){NSPoint local=NSMakePoint(NSMinX(root.bounds)+x,root.flipped?NSMinY(root.bounds)+y:NSMaxY(root.bounds)-y);hit=@{@"requestedContentTopLeftPoint":inputTracePoint(NSMakePoint(x,y)),@"convertedContentPoint":inputTracePoint(local),@"result":inputTraceHit(w,[root convertPoint:local toView:nil])};}
  NSDictionary* snapshot=@{@"schema":@1,@"installed":@(inputTraceMonitor!=nil),@"scope":@"owned NSWindow local NSApplication sendEvent dispatch; nested tracking loops excluded",@"clock":@{@"kind":@"appkit-system-uptime",@"units":@"seconds",@"now":inputTraceNumber(NSProcessInfo.processInfo.systemUptime)},@"limits":@{@"events":@64,@"firstEvents":@16,@"classStringUnits":@96,@"viewChain":@8,@"identities":@64,@"errors":@4},@"observedEvents":@(inputTraceTotal),@"droppedEvents":@(inputTraceDropped),@"events":inputTraceEvents?:@[],@"skippedNilWindowByType":inputTraceSkippedNil?:@{},@"skippedOtherWindowByType":inputTraceSkippedOther?:@{},@"window":inputTraceWindowState(w),@"requestedHitTest":hit,@"truncated":@{@"strings":@(inputTraceTruncatedStrings),@"chains":@(inputTraceTruncatedChains),@"identities":@(inputTraceTruncatedIdentities)},@"errorCount":@(inputTraceErrorCount),@"errors":inputTraceErrors?:@[]};
  return inputTraceValue(e,snapshot);
 }@catch(NSException* exception){return inputTraceValue(e,@{@"diagnosticError":inputTraceText(exception.name)});}
}
static napi_value inputTraceDispose(napi_env e,napi_callback_info info){
 if(!NSThread.isMainThread||!inputTraceAllowed()){napi_throw_error(e,nullptr,"Input trace is opt-in retained CI smoke-only on the main UI thread");return nullptr;}
 @try{clearInputTrace();return inputTraceValue(e,@{@"removed":@YES});}@catch(NSException* exception){return inputTraceValue(e,@{@"removed":@NO,@"diagnosticError":inputTraceText(exception.name)});}
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
 napi_define_properties(e,exports,11,d);
 napi_property_descriptor diagnostics[]={{"inputTraceInstall",0,inputTraceInstall,0,0,0,napi_default,0},{"inputTraceRead",0,inputTraceRead,0,0,0,napi_default,0},{"inputTraceDispose",0,inputTraceDispose,0,0,0,napi_default,0}};
 napi_define_properties(e,exports,3,diagnostics);return exports;
}
NAPI_MODULE(mouse_native_menu,init)
