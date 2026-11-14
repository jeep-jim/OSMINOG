#import <Cocoa/Cocoa.h>
#import <ScreenCaptureKit/ScreenCaptureKit.h>
#import <CoreGraphics/CoreGraphics.h>
#include <node_api.h>
#include <cmath>

// One still frame only, in this application's process. No helper identity, audio,
// permission database writes, recording stream, disk image, or background capture.
API_AVAILABLE(macos(14.0))
@interface MouseScreenRequest : NSObject <SCContentSharingPickerObserver>
@property(nonatomic) napi_env env;
@property(nonatomic) napi_deferred deferred;
@property(nonatomic) BOOL finished;
@property(nonatomic) BOOL capturing;
@property(nonatomic) BOOL usingPicker;
- (void)finish:(NSData*)png width:(double)width height:(double)height error:(NSError*)error cancelled:(BOOL)cancelled;
- (void)captureFilter:(SCContentFilter*)filter;
@end
static MouseScreenRequest* activeRequest;
@implementation MouseScreenRequest
- (void)finish:(NSData*)png width:(double)width height:(double)height error:(NSError*)error cancelled:(BOOL)cancelled {
 if(!NSThread.isMainThread){dispatch_async(dispatch_get_main_queue(),^{[self finish:png width:width height:height error:error cancelled:cancelled];});return;}
 if(self.finished)return;self.finished=YES;
 if(self.usingPicker){SCContentSharingPicker* p=SCContentSharingPicker.sharedPicker;[p removeObserver:self];p.active=NO;}
 napi_env e=self.env;if(e){napi_handle_scope scope;napi_open_handle_scope(e,&scope);napi_value value;
  if(error){napi_value text;const char* detail=error.localizedDescription.UTF8String?:"Screen capture failed";napi_create_string_utf8(e,detail,NAPI_AUTO_LENGTH,&text);napi_create_error(e,nullptr,text,&value);napi_reject_deferred(e,self.deferred,value);}
  else if(cancelled){napi_get_null(e,&value);napi_resolve_deferred(e,self.deferred,value);}
  else {napi_create_object(e,&value);napi_value v;NSString* data=[@"data:image/png;base64," stringByAppendingString:[png base64EncodedStringWithOptions:0]];napi_create_string_utf8(e,data.UTF8String,NAPI_AUTO_LENGTH,&v);napi_set_named_property(e,value,"base",v);
   napi_create_double(e,width,&v);napi_set_named_property(e,value,"width",v);napi_create_double(e,height,&v);napi_set_named_property(e,value,"height",v);
   napi_create_string_utf8(e,"screen",NAPI_AUTO_LENGTH,&v);napi_set_named_property(e,value,"kind",v);napi_create_string_utf8(e,"ScreenCaptureKit",NAPI_AUTO_LENGTH,&v);napi_set_named_property(e,value,"backend",v);
   napi_create_array(e,&v);napi_set_named_property(e,value,"layers",v);napi_resolve_deferred(e,self.deferred,value);
  }napi_close_handle_scope(e,scope);
 }if(activeRequest==self)activeRequest=nil;
}
- (void)captureFilter:(SCContentFilter*)filter {
 if(self.finished||self.capturing)return;self.capturing=YES;
 CGRect rect=filter.contentRect;double w=rect.size.width,h=rect.size.height;
 if(!(w>0&&h>0)){[self finish:nil width:0 height:0 error:[NSError errorWithDomain:@"MouseCapture" code:1 userInfo:@{NSLocalizedDescriptionKey:@"macOS вернула пустую область снимка"}] cancelled:NO];return;}
 double scale=MIN(MAX(1.,filter.pointPixelScale),MIN(8192./MAX(w,h),sqrt(40000000./(w*h))));
 SCStreamConfiguration* c=[SCStreamConfiguration new];c.width=MAX(1,(size_t)round(w*scale));c.height=MAX(1,(size_t)round(h*scale));c.showsCursor=NO;c.capturesAudio=NO;
 [SCScreenshotManager captureImageWithFilter:filter configuration:c completionHandler:^(CGImageRef image,NSError* error){
  if(error||!image){[self finish:nil width:w height:h error:error?:[NSError errorWithDomain:@"MouseCapture" code:2 userInfo:@{NSLocalizedDescriptionKey:@"macOS не предоставила изображение"}] cancelled:NO];return;}
  NSBitmapImageRep* rep=[[NSBitmapImageRep alloc] initWithCGImage:image];NSData* png=[rep representationUsingType:NSBitmapImageFileTypePNG properties:@{}];
  [self finish:png width:w height:h error:png?nil:[NSError errorWithDomain:@"MouseCapture" code:3 userInfo:@{NSLocalizedDescriptionKey:@"Не удалось подготовить PNG"}] cancelled:NO];
 }];
}
- (void)contentSharingPicker:(SCContentSharingPicker*)picker didUpdateWithFilter:(SCContentFilter*)filter forStream:(SCStream*)stream {
 dispatch_async(dispatch_get_main_queue(),^{[self captureFilter:filter];});
}
- (void)contentSharingPicker:(SCContentSharingPicker*)picker didCancelForStream:(SCStream*)stream {[self finish:nil width:0 height:0 error:nil cancelled:YES];}
- (void)contentSharingPickerStartDidFailWithError:(NSError*)error {[self finish:nil width:0 height:0 error:error cancelled:NO];}
@end
static napi_value status(napi_env e,napi_callback_info info){
 napi_value o,v;napi_create_object(e,&o);bool available=false;if(@available(macOS 14.0,*))available=true;
 napi_get_boolean(e,available,&v);napi_set_named_property(e,o,"pickerAvailable",v);
 napi_get_boolean(e,CGPreflightScreenCaptureAccess(),&v);napi_set_named_property(e,o,"granted",v);return o;
}
static napi_value capture(napi_env e,napi_callback_info info){
 if(!NSThread.isMainThread){napi_throw_error(e,nullptr,"Main UI thread required");return nullptr;}
 if(@available(macOS 14.0,*)){
  if(activeRequest){napi_throw_error(e,nullptr,"Снимок уже запрошен");return nullptr;}
  size_t n=2;napi_value args[2];napi_get_cb_info(e,info,&n,args,nullptr,nullptr);uint32_t display=0;bool choose=false;
  if(n<1||napi_get_value_uint32(e,args[0],&display)!=napi_ok){napi_throw_error(e,nullptr,"Invalid display identifier");return nullptr;}if(n>1)napi_get_value_bool(e,args[1],&choose);
  MouseScreenRequest* r=[MouseScreenRequest new];r.env=e;napi_value promise;napi_deferred deferred;napi_create_promise(e,&deferred,&promise);r.deferred=deferred;activeRequest=r;
  if(choose||!CGPreflightScreenCaptureAccess()){
   r.usingPicker=YES;SCContentSharingPicker* picker=SCContentSharingPicker.sharedPicker;SCContentSharingPickerConfiguration* c=[SCContentSharingPickerConfiguration new];c.allowedPickerModes=SCContentSharingPickerModeSingleDisplay;picker.defaultConfiguration=c;[picker addObserver:r];picker.active=YES;[picker presentPickerUsingContentStyle:SCShareableContentStyleDisplay];
  }else{
   [SCShareableContent getShareableContentExcludingDesktopWindows:YES onScreenWindowsOnly:YES completionHandler:^(SCShareableContent* content,NSError* error){dispatch_async(dispatch_get_main_queue(),^{
    if(r.finished)return;if(error){[r finish:nil width:0 height:0 error:error cancelled:NO];return;}SCDisplay* chosen=nil;for(SCDisplay* item in content.displays)if(item.displayID==display){chosen=item;break;}
    if(!chosen){[r finish:nil width:0 height:0 error:[NSError errorWithDomain:@"MouseCapture" code:4 userInfo:@{NSLocalizedDescriptionKey:@"Выбранный экран отключён. Повторите снимок."}] cancelled:NO];return;}
    [r captureFilter:[[SCContentFilter alloc] initWithDisplay:chosen excludingWindows:@[]]];
   });}];
  }
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW,120*NSEC_PER_SEC),dispatch_get_main_queue(),^{if(!r.finished)[r finish:nil width:0 height:0 error:nil cancelled:YES];});return promise;
 }
 napi_throw_error(e,nullptr,"System picker requires macOS 14 or later");return nullptr;
}
static napi_value cancel(napi_env e,napi_callback_info info){if(@available(macOS 14.0,*)){[activeRequest finish:nil width:0 height:0 error:nil cancelled:YES];}napi_value v;napi_get_undefined(e,&v);return v;}
static void cleanup(void* data){if(@available(macOS 14.0,*)){activeRequest.env=nullptr;[activeRequest finish:nil width:0 height:0 error:nil cancelled:YES];}}
static napi_value init(napi_env e,napi_value exports){napi_property_descriptor d[]={{"status",0,status,0,0,0,napi_default,0},{"capture",0,capture,0,0,0,napi_default,0},{"cancel",0,cancel,0,0,0,napi_default,0}};napi_define_properties(e,exports,3,d);napi_add_env_cleanup_hook(e,cleanup,nullptr);return exports;}
NAPI_MODULE(mouse_screen_capture,init)
