#import <Cocoa/Cocoa.h>
#import <ScreenCaptureKit/ScreenCaptureKit.h>
#import <CoreGraphics/CoreGraphics.h>
#import <CoreMedia/CoreMedia.h>
#import <CoreImage/CoreImage.h>
#include <node_api.h>
#include <cmath>
#include <cstdlib>
#include <cstring>

// One image, no audio, no files, no background recording. The explicit picker
// authorizes an SCStream filter; retain that authorization through its first
// complete frame, then STOP before resolving to JS. Do not pass picker filters
// to a separate SCScreenshotManager operation that may require a broad grant.
API_AVAILABLE(macos(14.0))
@interface MouseScreenRequest : NSObject <SCContentSharingPickerObserver,SCStreamOutput,SCStreamDelegate>
@property(nonatomic) napi_env env;
@property(nonatomic) napi_deferred deferred;
@property(nonatomic) BOOL finished;
@property(nonatomic) BOOL settled;
@property(nonatomic) BOOL capturing;
@property(nonatomic) BOOL usingPicker;
@property(nonatomic) BOOL streamFrame;
@property(nonatomic) BOOL gotFrame;
@property(nonatomic) double width;
@property(nonatomic) double height;
@property(nonatomic,strong) SCStream* stream;
- (void)finish:(NSData*)png error:(NSError*)error cancelled:(BOOL)cancelled;
- (void)captureFilter:(SCContentFilter*)filter;
@end
static id activeRequest;
static NSError* captureError(NSInteger code,NSString* text){return [NSError errorWithDomain:@"MouseCapture" code:code userInfo:@{NSLocalizedDescriptionKey:text}];}
@implementation MouseScreenRequest
- (void)settle:(NSData*)png error:(NSError*)error cancelled:(BOOL)cancelled {
 if(!NSThread.isMainThread){dispatch_async(dispatch_get_main_queue(),^{[self settle:png error:error cancelled:cancelled];});return;}
 if(self.settled)return;self.settled=YES;
 if(self.usingPicker){SCContentSharingPicker* p=SCContentSharingPicker.sharedPicker;[p removeObserver:self];p.active=NO;}
 self.stream=nil;
 napi_env e=self.env;if(e){napi_handle_scope scope;napi_open_handle_scope(e,&scope);napi_value value,v;
  if(error){
   napi_create_string_utf8(e,error.localizedDescription.UTF8String?:"Screen capture failed",NAPI_AUTO_LENGTH,&v);napi_create_error(e,nullptr,v,&value);
   napi_create_int32(e,(int32_t)error.code,&v);napi_set_named_property(e,value,"nativeCode",v);
   napi_create_string_utf8(e,error.domain.UTF8String,NAPI_AUTO_LENGTH,&v);napi_set_named_property(e,value,"nativeDomain",v);
   napi_create_string_utf8(e,(error.code==-3801?"SCREEN_PERMISSION_DENIED":"SCREEN_CAPTURE_FAILED"),NAPI_AUTO_LENGTH,&v);napi_set_named_property(e,value,"code",v);
   napi_reject_deferred(e,self.deferred,value);
  }else if(cancelled){napi_get_null(e,&value);napi_resolve_deferred(e,self.deferred,value);}
  else{
   napi_create_object(e,&value);NSString* data=[@"data:image/png;base64," stringByAppendingString:[png base64EncodedStringWithOptions:0]];
   napi_create_string_utf8(e,data.UTF8String,NAPI_AUTO_LENGTH,&v);napi_set_named_property(e,value,"base",v);
   napi_create_double(e,self.width,&v);napi_set_named_property(e,value,"width",v);napi_create_double(e,self.height,&v);napi_set_named_property(e,value,"height",v);
   napi_create_string_utf8(e,"screen",NAPI_AUTO_LENGTH,&v);napi_set_named_property(e,value,"kind",v);
   napi_create_string_utf8(e,self.usingPicker?"ScreenCaptureKit-picker-frame":self.streamFrame?"ScreenCaptureKit-test-frame":"ScreenCaptureKit",NAPI_AUTO_LENGTH,&v);napi_set_named_property(e,value,"backend",v);
   napi_create_array(e,&v);napi_set_named_property(e,value,"layers",v);napi_resolve_deferred(e,self.deferred,value);
  }napi_close_handle_scope(e,scope);
 }if(activeRequest==self)activeRequest=nil;
}
- (void)finish:(NSData*)png error:(NSError*)error cancelled:(BOOL)cancelled {
 if(!NSThread.isMainThread){dispatch_async(dispatch_get_main_queue(),^{[self finish:png error:error cancelled:cancelled];});return;}
 if(self.finished)return;self.finished=YES;
 SCStream* stream=self.stream;
 if(stream){
  [stream stopCaptureWithCompletionHandler:^(NSError* stopError){[self settle:png error:error?:stopError cancelled:cancelled];}];
 }else [self settle:png error:error cancelled:cancelled];
}
- (void)finishImage:(CGImageRef)image error:(NSError*)error {
 if(error||!image){[self finish:nil error:error?:captureError(2,@"macOS не предоставила изображение") cancelled:NO];return;}
 NSBitmapImageRep* rep=[[NSBitmapImageRep alloc] initWithCGImage:image];NSData* png=[rep representationUsingType:NSBitmapImageFileTypePNG properties:@{}];
 [self finish:png error:png?nil:captureError(3,@"Не удалось подготовить PNG") cancelled:NO];
}
- (void)stream:(SCStream*)stream didOutputSampleBuffer:(CMSampleBufferRef)buffer ofType:(SCStreamOutputType)type {
 // The output queue is MAIN. First complete frame only; remaining samples are discarded.
 if(self.finished||self.gotFrame||type!=SCStreamOutputTypeScreen||!CMSampleBufferIsValid(buffer))return;
 NSArray* attachments=(__bridge NSArray*)CMSampleBufferGetSampleAttachmentsArray(buffer,NO);
 NSDictionary* info=attachments.firstObject;
 if(!info||[info[SCStreamFrameInfoStatus] integerValue]!=SCFrameStatusComplete)return;
 CVPixelBufferRef pixels=CMSampleBufferGetImageBuffer(buffer);if(!pixels)return;
 self.gotFrame=YES;
 CIImage* ci=[CIImage imageWithCVPixelBuffer:pixels];CIContext* context=[CIContext contextWithOptions:@{kCIContextCacheIntermediates:@NO}];
 CGImageRef image=[context createCGImage:ci fromRect:ci.extent];
 [self finishImage:image error:nil];if(image)CGImageRelease(image);
}
- (void)stream:(SCStream*)stream didStopWithError:(NSError*)error {
 if(self.finished)return;
 self.stream=nil;
 [self finish:nil error:error.code==SCStreamErrorUserStopped?nil:error cancelled:error.code==SCStreamErrorUserStopped];
}
- (void)captureFilter:(SCContentFilter*)filter {
 if(self.finished||self.capturing)return;self.capturing=YES;
 // A screen command must not silently become a window/app-only image.
 if(filter.style!=SCShareableContentStyleDisplay){[self finish:nil error:captureError(8,@"Выберите весь экран, а не отдельное окно приложения.") cancelled:NO];return;}
 // Picker-created display filters can omit the system menu by default.
 if(@available(macOS 14.2,*)){filter.includeMenuBar=YES;}
 CGRect rect=filter.contentRect;double w=rect.size.width,h=rect.size.height;self.width=w;self.height=h;
 if(!(w>0&&h>0)){[self finish:nil error:captureError(1,@"macOS вернула пустую область снимка") cancelled:NO];return;}
 double scale=MIN(MAX(1.,filter.pointPixelScale),MIN(8192./MAX(w,h),sqrt(40000000./(w*h))));
 SCStreamConfiguration* c=[SCStreamConfiguration new];c.width=MAX(1,(size_t)round(w*scale));c.height=MAX(1,(size_t)round(h*scale));c.showsCursor=NO;c.capturesAudio=NO;
 // Zero sourceRect is ScreenCaptureKit's full-display default, never workArea.
 c.sourceRect=CGRectZero;
 if(self.usingPicker||self.streamFrame){
  c.queueDepth=3;c.minimumFrameInterval=CMTimeMake(1,30);
  SCStream* stream=[[SCStream alloc] initWithFilter:filter configuration:c delegate:self];self.stream=stream;
  NSError* outputError=nil;
  if(![stream addStreamOutput:self type:SCStreamOutputTypeScreen sampleHandlerQueue:dispatch_get_main_queue() error:&outputError]){self.stream=nil;[self finish:nil error:outputError?:captureError(5,@"Не удалось подключить выбранный экран") cancelled:NO];return;}
  [stream startCaptureWithCompletionHandler:^(NSError* error){if(error)dispatch_async(dispatch_get_main_queue(),^{self.stream=nil;[self finish:nil error:error cancelled:NO];});}];
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW,15*NSEC_PER_SEC),dispatch_get_main_queue(),^{if(!self.finished)[self finish:nil error:captureError(6,@"macOS не передала кадр выбранного экрана. Повторите выбор экрана.") cancelled:NO];});
 }else [SCScreenshotManager captureImageWithFilter:filter configuration:c completionHandler:^(CGImageRef image,NSError* error){[self finishImage:image error:error];}];
}
- (void)contentSharingPicker:(SCContentSharingPicker*)picker didUpdateWithFilter:(SCContentFilter*)filter forStream:(SCStream*)stream {
 // Let the system's selection overlay dismiss before acquiring the single frame.
 // This keeps the approved picker filter/authorization; cancellation still wins.
 dispatch_after(dispatch_time(DISPATCH_TIME_NOW,800*NSEC_PER_MSEC),dispatch_get_main_queue(),^{if(!self.finished)[self captureFilter:filter];});
}
- (void)contentSharingPicker:(SCContentSharingPicker*)picker didCancelForStream:(SCStream*)stream {[self finish:nil error:nil cancelled:YES];}
- (void)contentSharingPickerStartDidFailWithError:(NSError*)error {[self finish:nil error:error cancelled:NO];}
@end
static napi_value status(napi_env e,napi_callback_info info){
 napi_value o,v;napi_create_object(e,&o);bool available=false;if(@available(macOS 14.0,*))available=true;
 napi_get_boolean(e,available,&v);napi_set_named_property(e,o,"pickerAvailable",v);
 napi_get_boolean(e,activeRequest!=nil,&v);napi_set_named_property(e,o,"busy",v);
 napi_get_boolean(e,CGPreflightScreenCaptureAccess(),&v);napi_set_named_property(e,o,"granted",v);return o;
}
static napi_value capture(napi_env e,napi_callback_info info){
 if(!NSThread.isMainThread){napi_throw_error(e,nullptr,"Main UI thread required");return nullptr;}
 if(@available(macOS 14.0,*)){
  if(activeRequest){napi_throw_error(e,nullptr,"Снимок уже запрошен");return nullptr;}
  size_t n=3;napi_value args[3];napi_get_cb_info(e,info,&n,args,nullptr,nullptr);uint32_t display=0;bool choose=false;
  if(n<1||napi_get_value_uint32(e,args[0],&display)!=napi_ok){napi_throw_error(e,nullptr,"Invalid display identifier");return nullptr;}if(n>1)napi_get_value_bool(e,args[1],&choose);
  MouseScreenRequest* r=[MouseScreenRequest new];r.env=e;napi_value promise;napi_deferred deferred;napi_create_promise(e,&deferred,&promise);r.deferred=deferred;activeRequest=r;
  bool testStream=false;if(n>2)napi_get_value_bool(e,args[2],&testStream);
  if(testStream){const char* ci=std::getenv("CI");if(!ci||std::strcmp(ci,"true")||!std::getenv("QUADRO_TEST_PROFILE")||![NSProcessInfo.processInfo.arguments containsObject:@"--quadro-smoke-write"]||!CGPreflightScreenCaptureAccess()){[r finish:nil error:captureError(7,@"Test stream requires CI and pre-existing screen permission") cancelled:NO];return promise;}r.streamFrame=YES;}

  if(!choose&&!CGPreflightScreenCaptureAccess()){[r finish:nil error:[NSError errorWithDomain:@"com.apple.ScreenCaptureKit.SCStreamErrorDomain" code:-3801 userInfo:@{NSLocalizedDescriptionKey:@"macOS не предоставила разрешение текущей сборке"}] cancelled:NO];return promise;}
  if(choose){
   r.usingPicker=YES;SCContentSharingPicker* picker=SCContentSharingPicker.sharedPicker;SCContentSharingPickerConfiguration* c=[SCContentSharingPickerConfiguration new];c.allowedPickerModes=SCContentSharingPickerModeSingleDisplay;picker.defaultConfiguration=c;[picker addObserver:r];picker.active=YES;[picker presentPickerUsingContentStyle:SCShareableContentStyleDisplay];
  }else{
   [SCShareableContent getShareableContentExcludingDesktopWindows:NO onScreenWindowsOnly:YES completionHandler:^(SCShareableContent* content,NSError* error){dispatch_async(dispatch_get_main_queue(),^{
    if(r.finished)return;if(error){[r finish:nil error:error cancelled:NO];return;}SCDisplay* chosen=nil;for(SCDisplay* item in content.displays)if(item.displayID==display){chosen=item;break;}
    if(!chosen){[r finish:nil error:captureError(4,@"Выбранный экран отключён. Повторите снимок.") cancelled:NO];return;}
    [r captureFilter:[[SCContentFilter alloc] initWithDisplay:chosen excludingWindows:@[]]];
   });}];
  }
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW,120*NSEC_PER_SEC),dispatch_get_main_queue(),^{if(!r.finished)[r finish:nil error:nil cancelled:YES];});return promise;
 }
 napi_throw_error(e,nullptr,"System picker requires macOS 14 or later");return nullptr;
}
static napi_value cancel(napi_env e,napi_callback_info info){if(@available(macOS 14.0,*)){[(MouseScreenRequest*)activeRequest finish:nil error:nil cancelled:YES];}napi_value v;napi_get_undefined(e,&v);return v;}
static void cleanup(void* data){if(@available(macOS 14.0,*)){MouseScreenRequest* r=activeRequest;r.env=nullptr;[r finish:nil error:nil cancelled:YES];}}
static napi_value init(napi_env e,napi_value exports){napi_property_descriptor d[]={{"status",0,status,0,0,0,napi_default,0},{"capture",0,capture,0,0,0,napi_default,0},{"cancel",0,cancel,0,0,0,napi_default,0}};napi_define_properties(e,exports,3,d);napi_add_env_cleanup_hook(e,cleanup,nullptr);return exports;}
NAPI_MODULE(mouse_screen_capture,init)
