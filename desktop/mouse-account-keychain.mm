// Main-process only Node-API bridge. The Security framework enforces biometric
// access to each item; a successful UI prompt alone never releases a secret.
#import <Foundation/Foundation.h>
#import <Security/Security.h>
#import <Security/SecTask.h>
#import <LocalAuthentication/LocalAuthentication.h>
#include <node_api.h>
#include <algorithm>
#include <cstring>
#include <memory>
#include <string>
#include <vector>

namespace {
constexpr size_t kMaxSecret=8192;
constexpr const char* kServicePrefix="black.mouse.browser.account.v1.";
enum class Operation { Probe,Put,Get,Remove };
void wipe(std::vector<unsigned char>& bytes){volatile unsigned char* p=bytes.data();for(size_t i=0;i<bytes.size();i++)p[i]=0;bytes.clear();}
struct Work {
 napi_env env=nullptr;napi_async_work work=nullptr;napi_deferred deferred=nullptr;Operation operation;
 std::string service,account;std::vector<unsigned char> secret,result;OSStatus status=errSecSuccess;const char* code=nullptr;bool missing=false,capable=false;
 ~Work(){wipe(secret);wipe(result);}
};
bool stringValue(napi_env env,napi_value value,std::string& out,size_t maximum){
 napi_valuetype type;size_t length=0;if(napi_typeof(env,value,&type)!=napi_ok||type!=napi_string||napi_get_value_string_utf8(env,value,nullptr,0,&length)!=napi_ok||length==0||length>maximum)return false;
 std::vector<char> bytes(length+1);if(napi_get_value_string_utf8(env,value,bytes.data(),bytes.size(),&length)!=napi_ok)return false;out.assign(bytes.data(),length);return out.find('\0')==std::string::npos;
}
bool validService(const std::string& service){const size_t size=std::strlen(kServicePrefix);return service.size()==size+64&&service.compare(0,size,kServicePrefix)==0&&std::all_of(service.begin()+size,service.end(),[](char c){return c>='0'&&c<='9'||c>='a'&&c<='f';});}
bool validAccount(const std::string& account){if(account.empty()||account.size()>16||account[0]=='0')return false;unsigned long long value=0;for(char c:account){if(c<'0'||c>'9')return false;value=value*10+(c-'0');}return value<=9007199254740991ULL;}
bool hasKeychainEntitlement(){
 SecTaskRef task=SecTaskCreateFromSelf(kCFAllocatorDefault);if(!task)return false;bool result=false;
 for(CFStringRef key:{CFSTR("com.apple.application-identifier"),CFSTR("application-identifier"),CFSTR("keychain-access-groups")}){
  CFTypeRef value=SecTaskCopyValueForEntitlement(task,key,nullptr);if(value){if(CFGetTypeID(value)==CFStringGetTypeID())result=CFStringGetLength((CFStringRef)value)>0;if(CFGetTypeID(value)==CFArrayGetTypeID())result=CFArrayGetCount((CFArrayRef)value)>0;CFRelease(value);if(result)break;}
 }
 CFRelease(task);return result;
}
bool hasTouchID(){LAContext* context=[LAContext new];NSError* error=nil;const BOOL ready=[context canEvaluatePolicy:LAPolicyDeviceOwnerAuthenticationWithBiometrics error:&error];const BOOL touch=context.biometryType==LABiometryTypeTouchID;[context invalidate];return ready&&touch;}
const char* prerequisite(){if(!hasKeychainEntitlement())return "MOUSE_TOUCH_ID_KEYCHAIN_ENTITLEMENT";if(!hasTouchID())return "MOUSE_TOUCH_ID_NOT_READY";return nullptr;}
NSMutableDictionary* baseQuery(NSString* service,NSString* account){return [@{(__bridge id)kSecClass:(__bridge id)kSecClassGenericPassword,(__bridge id)kSecAttrService:service,(__bridge id)kSecAttrAccount:account,(__bridge id)kSecUseDataProtectionKeychain:@YES,(__bridge id)kSecAttrSynchronizable:@NO} mutableCopy];}
LAContext* authenticationContext(BOOL interactive){LAContext* context=[LAContext new];context.localizedReason=@"Разблокировать твой Mouse ID";context.localizedCancelTitle=@"Отмена";context.localizedFallbackTitle=@"";context.touchIDAuthenticationAllowableReuseDuration=0;context.interactionNotAllowed=!interactive;return context;}
SecAccessControlRef accessControl(){CFErrorRef error=nullptr;SecAccessControlRef value=SecAccessControlCreateWithFlags(kCFAllocatorDefault,kSecAttrAccessibleWhenUnlockedThisDeviceOnly,kSecAccessControlBiometryCurrentSet,&error);if(error)CFRelease(error);return value;}
void setStatusCode(Work* data){
 if(data->code||data->status==errSecSuccess)return;
 switch(data->status){case errSecUserCanceled:data->code="MOUSE_TOUCH_ID_CANCELLED";break;case errSecAuthFailed:data->code="MOUSE_TOUCH_ID_AUTH_FAILED";break;case errSecMissingEntitlement:data->code="MOUSE_TOUCH_ID_KEYCHAIN_ENTITLEMENT";break;case errSecInteractionNotAllowed:data->code="MOUSE_TOUCH_ID_NOT_READY";break;case errSecNotAvailable:data->code="MOUSE_TOUCH_ID_UNAVAILABLE";break;default:data->code="MOUSE_TOUCH_ID_KEYCHAIN_ERROR";}
}
// Enabling or rotating a credential requires a fresh biometric authentication.
// This wait runs on a Node async worker, never on AppKit/the Electron UI thread.
bool authenticateForWrite(LAContext* context,Work* data){
 dispatch_semaphore_t done=dispatch_semaphore_create(0);__block BOOL success=NO;__block NSError* error=nil;
 [context evaluatePolicy:LAPolicyDeviceOwnerAuthenticationWithBiometrics localizedReason:@"Сохранить доступ к Mouse ID через Touch ID" reply:^(BOOL accepted,NSError* failure){success=accepted;error=failure;dispatch_semaphore_signal(done);}];
 if(dispatch_semaphore_wait(done,dispatch_time(DISPATCH_TIME_NOW,120LL*NSEC_PER_SEC))!=0){[context invalidate];data->code="MOUSE_TOUCH_ID_CANCELLED";return false;}
 if(success)return true;
 data->code=error.code==LAErrorUserCancel||error.code==LAErrorAppCancel||error.code==LAErrorSystemCancel?"MOUSE_TOUCH_ID_CANCELLED":error.code==LAErrorBiometryNotAvailable||error.code==LAErrorBiometryNotEnrolled||error.code==LAErrorBiometryLockout?"MOUSE_TOUCH_ID_NOT_READY":"MOUSE_TOUCH_ID_AUTH_FAILED";return false;
}
void execute(napi_env,void* pointer){
 Work* data=static_cast<Work*>(pointer);
 @autoreleasepool{@try{
  NSString* service=[[NSString alloc] initWithBytes:data->service.data() length:data->service.size() encoding:NSUTF8StringEncoding];NSString* account=[[NSString alloc] initWithBytes:data->account.data() length:data->account.size() encoding:NSUTF8StringEncoding];
  if(data->operation==Operation::Probe){
   if((data->code=prerequisite()))return;
   NSString* probeService=[service stringByAppendingFormat:@".probe.%@",NSUUID.UUID.UUIDString];LAContext* context=authenticationContext(NO);
   NSMutableDictionary* query=baseQuery(probeService,@"capability");query[(__bridge id)kSecUseAuthenticationContext]=context;SecAccessControlRef access=accessControl();if(!access){data->code="MOUSE_TOUCH_ID_UNAVAILABLE";return;}
   query[(__bridge id)kSecAttrAccessControl]=(__bridge id)access;query[(__bridge id)kSecValueData]=[NSData data];data->status=SecItemAdd((__bridge CFDictionaryRef)query,nullptr);CFRelease(access);
   if(data->status==errSecSuccess){
    NSMutableDictionary* read=baseQuery(probeService,@"capability");read[(__bridge id)kSecUseAuthenticationContext]=context;read[(__bridge id)kSecUseAuthenticationUI]=(__bridge id)kSecUseAuthenticationUIFail;read[(__bridge id)kSecReturnData]=@YES;read[(__bridge id)kSecMatchLimit]=(__bridge id)kSecMatchLimitOne;CFTypeRef result=nullptr;const OSStatus denied=SecItemCopyMatching((__bridge CFDictionaryRef)read,&result);if(result)CFRelease(result);
    NSMutableDictionary* remove=baseQuery(probeService,@"capability");remove[(__bridge id)kSecUseAuthenticationContext]=context;remove[(__bridge id)kSecUseAuthenticationUI]=(__bridge id)kSecUseAuthenticationUIFail;data->status=SecItemDelete((__bridge CFDictionaryRef)remove);data->capable=data->status==errSecSuccess&&(denied==errSecInteractionNotAllowed||denied==errSecAuthFailed);if(data->status==errSecSuccess&&!data->capable)data->code="MOUSE_TOUCH_ID_UNAVAILABLE";
   }
   [context invalidate];setStatusCode(data);return;
  }
  NSMutableDictionary* query=baseQuery(service,account);LAContext* context=authenticationContext(data->operation!=Operation::Remove);query[(__bridge id)kSecUseAuthenticationContext]=context;
  if(data->operation==Operation::Remove){query[(__bridge id)kSecUseAuthenticationUI]=(__bridge id)kSecUseAuthenticationUIFail;data->status=SecItemDelete((__bridge CFDictionaryRef)query);if(data->status==errSecItemNotFound)data->status=errSecSuccess;}
  else if(data->operation==Operation::Get){
   query[(__bridge id)kSecMatchLimit]=(__bridge id)kSecMatchLimitOne;query[(__bridge id)kSecReturnData]=@YES;CFTypeRef result=nullptr;data->status=SecItemCopyMatching((__bridge CFDictionaryRef)query,&result);
   if(data->status==errSecItemNotFound){data->missing=true;data->status=errSecSuccess;}
   else if(data->status==errSecSuccess){if(result&&CFGetTypeID(result)==CFDataGetTypeID()){CFDataRef bytes=(CFDataRef)result;const CFIndex length=CFDataGetLength(bytes);if(length>0&&length<=kMaxSecret)data->result.assign(CFDataGetBytePtr(bytes),CFDataGetBytePtr(bytes)+length);else data->status=errSecDecode;}else data->status=errSecDecode;}
   if(result)CFRelease(result);
  }else if(data->operation==Operation::Put){
   if((data->code=prerequisite())){[context invalidate];return;}
   if(!authenticateForWrite(context,data)){[context invalidate];return;}
   // Update preserves the original access-control constraint. A changed
   // biometric set cannot silently replace an existing protected item.
   NSData* secret=[NSData dataWithBytesNoCopy:data->secret.data() length:data->secret.size() freeWhenDone:NO];NSDictionary* changes=@{(__bridge id)kSecValueData:secret};NSMutableDictionary* read=[query mutableCopy];read[(__bridge id)kSecReturnData]=@YES;read[(__bridge id)kSecMatchLimit]=(__bridge id)kSecMatchLimitOne;CFTypeRef previous=nullptr;data->status=SecItemCopyMatching((__bridge CFDictionaryRef)read,&previous);if(previous)CFRelease(previous);if(data->status==errSecSuccess)data->status=SecItemUpdate((__bridge CFDictionaryRef)query,(__bridge CFDictionaryRef)changes);
   if(data->status==errSecItemNotFound){SecAccessControlRef access=accessControl();if(!access){data->code="MOUSE_TOUCH_ID_UNAVAILABLE";}else{query[(__bridge id)kSecAttrAccessControl]=(__bridge id)access;query[(__bridge id)kSecValueData]=secret;data->status=SecItemAdd((__bridge CFDictionaryRef)query,nullptr);CFRelease(access);}}
  }
  [context invalidate];setStatusCode(data);
 }@catch(NSException* exception){data->code="MOUSE_TOUCH_ID_KEYCHAIN_ERROR";}}
}
napi_value errorValue(napi_env env,const char* code){napi_value message,value,key;napi_create_string_utf8(env,"Mouse protected Keychain operation failed",NAPI_AUTO_LENGTH,&message);napi_create_string_utf8(env,code?code:"MOUSE_TOUCH_ID_KEYCHAIN_ERROR",NAPI_AUTO_LENGTH,&key);napi_create_error(env,key,message,&value);return value;}
void complete(napi_env env,napi_status status,void* pointer){
 std::unique_ptr<Work> data(static_cast<Work*>(pointer));napi_value result;if(status!=napi_ok)data->code="MOUSE_TOUCH_ID_CANCELLED";
 if(data->operation==Operation::Probe){napi_create_object(env,&result);napi_value ready,reason;napi_get_boolean(env,data->capable&&!data->code,&ready);napi_create_string_utf8(env,data->code?data->code:"",NAPI_AUTO_LENGTH,&reason);napi_set_named_property(env,result,"available",ready);napi_set_named_property(env,result,"reason",reason);napi_resolve_deferred(env,data->deferred,result);}
 else if(data->code)napi_reject_deferred(env,data->deferred,errorValue(env,data->code));
 else{if(data->operation==Operation::Get){if(data->missing)napi_get_null(env,&result);else if(napi_create_buffer_copy(env,data->result.size(),data->result.data(),nullptr,&result)!=napi_ok){napi_reject_deferred(env,data->deferred,errorValue(env,"MOUSE_TOUCH_ID_KEYCHAIN_ERROR"));napi_delete_async_work(env,data->work);return;}}else napi_get_undefined(env,&result);napi_resolve_deferred(env,data->deferred,result);}
 napi_delete_async_work(env,data->work);
}
napi_value queue(napi_env env,napi_callback_info info,Operation operation){
 size_t count=3;napi_value args[3];napi_get_cb_info(env,info,&count,args,nullptr,nullptr);const size_t wanted=operation==Operation::Probe?1:operation==Operation::Put?3:2;auto data=std::make_unique<Work>();data->env=env;data->operation=operation;
 if(count!=wanted||!stringValue(env,args[0],data->service,160)||!validService(data->service)||(operation!=Operation::Probe&&(!stringValue(env,args[1],data->account,16)||!validAccount(data->account)))){napi_throw_error(env,"MOUSE_TOUCH_ID_INVALID_INPUT","Invalid Mouse Keychain arguments");return nullptr;}
 if(operation==Operation::Put){bool buffer=false;void* bytes=nullptr;size_t length=0;if(napi_is_buffer(env,args[2],&buffer)!=napi_ok||!buffer||napi_get_buffer_info(env,args[2],&bytes,&length)!=napi_ok||length==0||length>kMaxSecret){napi_throw_error(env,"MOUSE_TOUCH_ID_INVALID_INPUT","Invalid Mouse Keychain secret");return nullptr;}const auto* start=static_cast<unsigned char*>(bytes);data->secret.assign(start,start+length);}
 napi_value promise,name;if(napi_create_promise(env,&data->deferred,&promise)!=napi_ok)return nullptr;napi_create_string_utf8(env,"MouseAccountKeychain",NAPI_AUTO_LENGTH,&name);
 if(napi_create_async_work(env,nullptr,name,execute,complete,data.get(),&data->work)!=napi_ok){napi_reject_deferred(env,data->deferred,errorValue(env,"MOUSE_TOUCH_ID_KEYCHAIN_ERROR"));return promise;}
 if(napi_queue_async_work(env,data->work)!=napi_ok){napi_delete_async_work(env,data->work);napi_reject_deferred(env,data->deferred,errorValue(env,"MOUSE_TOUCH_ID_KEYCHAIN_ERROR"));return promise;}
 data.release();return promise;
}
napi_value probe(napi_env env,napi_callback_info info){return queue(env,info,Operation::Probe);}napi_value put(napi_env env,napi_callback_info info){return queue(env,info,Operation::Put);}napi_value get(napi_env env,napi_callback_info info){return queue(env,info,Operation::Get);}napi_value remove(napi_env env,napi_callback_info info){return queue(env,info,Operation::Remove);}
napi_value available(napi_env env,napi_callback_info){bool supported=false;@autoreleasepool{@try{supported=prerequisite()==nullptr;}@catch(NSException* exception){}}napi_value result;napi_get_boolean(env,supported,&result);return result;}
napi_value init(napi_env env,napi_value exports){napi_property_descriptor properties[]={{"available",nullptr,available,nullptr,nullptr,nullptr,napi_default,nullptr},{"probe",nullptr,probe,nullptr,nullptr,nullptr,napi_default,nullptr},{"put",nullptr,put,nullptr,nullptr,nullptr,napi_default,nullptr},{"get",nullptr,get,nullptr,nullptr,nullptr,napi_default,nullptr},{"remove",nullptr,remove,nullptr,nullptr,nullptr,napi_default,nullptr}};napi_define_properties(env,exports,5,properties);return exports;}
}
NAPI_MODULE(mouse_account_keychain,init)
