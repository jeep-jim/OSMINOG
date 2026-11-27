#import <Cocoa/Cocoa.h>
#import <Carbon/Carbon.h>
#import <CoreGraphics/CoreGraphics.h>
#include "input-language-napi.h"
#include <cstdlib>
#include <cstring>

namespace {
using namespace mouse_input_language;
std::string stringValue(CFTypeRef value){
 if(!value||CFGetTypeID(value)!=CFStringGetTypeID())return {};
 NSString* string=(__bridge NSString*)value;return string.UTF8String?:"";
}
bool enabled(TISInputSourceRef source){
 const auto property=[&](CFStringRef key){return static_cast<CFTypeRef>(TISGetInputSourceProperty(source,key));};
 return property(kTISPropertyInputSourceIsEnabled)==kCFBooleanTrue&&property(kTISPropertyInputSourceIsSelectCapable)==kCFBooleanTrue&&
  property(kTISPropertyInputSourceCategory)&&CFEqual(property(kTISPropertyInputSourceCategory),kTISCategoryKeyboardInputSource);
}
std::string sourceIdentifier(TISInputSourceRef source){return source?stringValue(TISGetInputSourceProperty(source,kTISPropertyInputSourceID)):std::string();}
State read(){
 State state;if(!NSThread.isMainThread){state.reason="native-thread-unavailable";return state;}
 TISInputSourceRef current=TISCopyCurrentKeyboardInputSource();state.current=sourceIdentifier(current);if(current)CFRelease(current);
 // false asks for the user's enabled sources; disabled system layouts are not
 // advertised as installed choices and are never silently enabled here.
 CFArrayRef sources=TISCreateInputSourceList(nullptr,false);
 if(!sources){state.reason="input-sources-unavailable";return state;}
 for(CFIndex index=0;index<CFArrayGetCount(sources)&&state.sources.size()<128;index++){
  auto source=static_cast<TISInputSourceRef>(const_cast<void*>(CFArrayGetValueAtIndex(sources,index)));if(!enabled(source))continue;
  Source item;item.id=sourceIdentifier(source);if(item.id.empty())continue;
  item.label=stringValue(TISGetInputSourceProperty(source,kTISPropertyLocalizedName));if(item.label.empty())item.label=item.id;
  CFTypeRef languages=TISGetInputSourceProperty(source,kTISPropertyInputSourceLanguages);
  if(languages&&CFGetTypeID(languages)==CFArrayGetTypeID()&&CFArrayGetCount(static_cast<CFArrayRef>(languages))>0)item.language=stringValue(CFArrayGetValueAtIndex(static_cast<CFArrayRef>(languages),0));
  state.sources.push_back(item);
 }
 CFRelease(sources);state.available=!state.current.empty()&&!state.sources.empty();if(!state.available)state.reason="input-sources-unavailable";return state;
}
napi_value state(napi_env env,napi_callback_info){return result(env,read());}
napi_value select(napi_env env,napi_callback_info info){
 size_t count=2;napi_value args[2];napi_get_cb_info(env,info,&count,args,nullptr,nullptr);std::string id;
 if(!NSThread.isMainThread||count!=2||!sourceID(env,args[1],id))return boolean(env,false);
 bool selected=false;CFArrayRef sources=TISCreateInputSourceList(nullptr,false);if(!sources)return boolean(env,false);
 for(CFIndex index=0;index<CFArrayGetCount(sources);index++){
  auto source=static_cast<TISInputSourceRef>(const_cast<void*>(CFArrayGetValueAtIndex(sources,index)));
  if(enabled(source)&&sourceIdentifier(source)==id){selected=TISSelectInputSource(source)==noErr;break;}
 }
 CFRelease(sources);return boolean(env,selected);
}
std::string fixtureOriginal;std::vector<std::string> fixtureAdded;
bool fixtureAllowed(){
 const char* ci=std::getenv("CI"),*profile=std::getenv("MOUSE_TEST_PROFILE");
 return NSThread.isMainThread&&ci&&std::strcmp(ci,"true")==0&&profile&&profile[0]=='/'&&
  ([NSProcessInfo.processInfo.arguments containsObject:@"--mouse-637-features-smoke"]||[NSProcessInfo.processInfo.arguments containsObject:@"--mouse-642-controls-smoke"]);
}
napi_value fixture(napi_env env,napi_callback_info info){
 size_t count=2;napi_value args[2];napi_get_cb_info(env,info,&count,args,nullptr,nullptr);std::string action;
 if(!fixtureAllowed()||count!=2||!sourceID(env,args[1],action)||(action!="prepare"&&action!="restore")){napi_throw_error(env,nullptr,"Input-source fixture is CI smoke-only");return nullptr;}
 const State before=read();bool okay=true;CFArrayRef all=TISCreateInputSourceList(nullptr,true);
 if(!all){State value=before;value.reason="fixture-sources-unavailable";return result(env,value);}
 if(action=="prepare"&&fixtureOriginal.empty()){
  fixtureOriginal=before.current;
  for(const auto& desired:std::vector<std::pair<std::string,std::string>>{{"en","com.apple.keylayout.US"},{"ru","com.apple.keylayout.Russian"}}){
   bool present=false;for(const auto& source:before.sources)if(source.language==desired.first||source.language.rfind(desired.first+"-",0)==0)present=true;
   if(present)continue;bool found=false;
   for(CFIndex index=0;index<CFArrayGetCount(all);index++){
    auto source=static_cast<TISInputSourceRef>(const_cast<void*>(CFArrayGetValueAtIndex(all,index)));if(sourceIdentifier(source)!=desired.second)continue;
    found=true;if(TISGetInputSourceProperty(source,kTISPropertyInputSourceIsEnabled)!=kCFBooleanTrue){if(TISEnableInputSource(source)==noErr)fixtureAdded.push_back(desired.second);else okay=false;}break;
   }
   if(!found)okay=false;
  }
 }else if(action=="restore"){
  for(CFIndex index=0;index<CFArrayGetCount(all);index++){
   auto source=static_cast<TISInputSourceRef>(const_cast<void*>(CFArrayGetValueAtIndex(all,index)));if(sourceIdentifier(source)==fixtureOriginal&&TISSelectInputSource(source)!=noErr)okay=false;
  }
  for(const auto& id:fixtureAdded)for(CFIndex index=0;index<CFArrayGetCount(all);index++){
   auto source=static_cast<TISInputSourceRef>(const_cast<void*>(CFArrayGetValueAtIndex(all,index)));if(sourceIdentifier(source)==id&&TISDisableInputSource(source)!=noErr)okay=false;
  }
  if(okay){fixtureOriginal.clear();fixtureAdded.clear();}
 }
 CFRelease(all);State value=read();if(!okay)value.reason="input-source-fixture-failed";return result(env,value);
}
napi_value testKey(napi_env env,napi_callback_info){
 if(!fixtureAllowed()||!NSApp.isActive){napi_throw_error(env,nullptr,"Input-source key probe is CI smoke-only in the focused app");return nullptr;}
 const bool allowed=CGPreflightPostEventAccess();if(!allowed)return boolean(env,false);
 for(const bool down:{true,false}){CGEventRef event=CGEventCreateKeyboardEvent(nullptr,5,down);if(!event)return boolean(env,false);CGEventSetFlags(event,0);CGEventPost(kCGHIDEventTap,event);CFRelease(event);}
 return boolean(env,true);
}
}
void installMouseInputLanguage(napi_env env,napi_value exports){
 mouse_input_language::install(env,exports,state,select);
 const napi_property_descriptor properties[]={{"testInputLanguageSources",nullptr,fixture,nullptr,nullptr,nullptr,napi_default,nullptr},{"testInputLanguageKey",nullptr,testKey,nullptr,nullptr,nullptr,napi_default,nullptr}};napi_define_properties(env,exports,2,properties);
}
