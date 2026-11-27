#include <windows.h>
#include <cstring>
#include <cstdio>
#include <algorithm>
#include <cstdlib>
#include <cwchar>
#include "input-language-napi.h"

namespace {
using namespace mouse_input_language;
HWND windowFrom(napi_env env,napi_value value){
 bool buffer=false;void* bytes=nullptr;size_t size=0;
 if(napi_is_buffer(env,value,&buffer)!=napi_ok||!buffer||napi_get_buffer_info(env,value,&bytes,&size)!=napi_ok||size!=sizeof(HWND))return nullptr;
 HWND window=nullptr;std::memcpy(&window,bytes,sizeof(window));DWORD process=0;
 if(!IsWindow(window)||!GetWindowThreadProcessId(window,&process)||process!=GetCurrentProcessId())return nullptr;return window;
}
HWND inputWindow(HWND window){
 GUITHREADINFO info{};info.cbSize=sizeof(info);const DWORD thread=GetWindowThreadProcessId(window,nullptr);
 if(thread&&GetGUIThreadInfo(thread,&info)&&info.hwndFocus&&(info.hwndFocus==window||IsChild(window,info.hwndFocus)))return info.hwndFocus;
 return window;
}
std::string utf8(const wchar_t* value){
 const int size=WideCharToMultiByte(CP_UTF8,0,value,-1,nullptr,0,nullptr,nullptr);if(size<=1)return {};
 std::vector<char> bytes(size);WideCharToMultiByte(CP_UTF8,0,value,-1,bytes.data(),size,nullptr,nullptr);return std::string(bytes.data());
}
std::string sourceIdentifier(HKL layout){char value[32];std::snprintf(value,sizeof(value),"win:%016llx",static_cast<unsigned long long>(reinterpret_cast<uintptr_t>(layout)));return value;}
std::vector<HKL> installed(){
 const int count=GetKeyboardLayoutList(0,nullptr);if(count<=0||count>128)return {};
 std::vector<HKL> sources(count);const int found=GetKeyboardLayoutList(count,sources.data());sources.resize(found>0?found:0);return sources;
}
State read(HWND window){
 State state;if(!window){state.reason="native-window-unavailable";return state;}
 HWND target=inputWindow(window);const DWORD thread=GetWindowThreadProcessId(target,nullptr);const HKL current=GetKeyboardLayout(thread);
 if(current)state.current=sourceIdentifier(current);
 for(const HKL layout:installed()){
  Source source;source.id=sourceIdentifier(layout);const LANGID language=LOWORD(reinterpret_cast<uintptr_t>(layout));const LCID locale=MAKELCID(language,SORT_DEFAULT);
  wchar_t tag[LOCALE_NAME_MAX_LENGTH]={},label[256]={};
  if(LCIDToLocaleName(locale,tag,LOCALE_NAME_MAX_LENGTH,0))source.language=utf8(tag);
  if(GetLocaleInfoW(locale,LOCALE_SLOCALIZEDDISPLAYNAME,label,256))source.label=utf8(label);
  // HKLs distinguish installed variants even where Windows exposes the same
  // localized language label. Never claim a guessed physical keyboard name.
  source.label=(source.label.empty()?source.id:source.label)+" ("+source.id.substr(4)+")";state.sources.push_back(source);
 }
 state.available=!state.current.empty()&&!state.sources.empty();if(!state.available)state.reason="input-sources-unavailable";return state;
}
napi_value state(napi_env env,napi_callback_info info){size_t count=1;napi_value args[1];napi_get_cb_info(env,info,&count,args,nullptr,nullptr);return result(env,read(count==1?windowFrom(env,args[0]):nullptr));}
napi_value select(napi_env env,napi_callback_info info){
 size_t count=2;napi_value args[2];napi_get_cb_info(env,info,&count,args,nullptr,nullptr);std::string id;
 if(count!=2||!sourceID(env,args[1],id))return boolean(env,false);HWND window=windowFrom(env,args[0]);
 if(!window||GetAncestor(GetForegroundWindow(),GA_ROOT)!=GetAncestor(window,GA_ROOT))return boolean(env,false);
 for(const HKL layout:installed())if(sourceIdentifier(layout)==id){
  // Windows applies this request in the focused control's UI thread. It must
  // not activate a layout in a background Node thread or another application.
  return boolean(env,PostMessageW(inputWindow(window),WM_INPUTLANGCHANGEREQUEST,0,reinterpret_cast<LPARAM>(layout))!=0);
 }
 return boolean(env,false);
}
std::vector<HKL> fixtureAdded;
bool fixtureAllowed(){
 const char* ci=std::getenv("CI"),*profile=std::getenv("MOUSE_TEST_PROFILE");const wchar_t* command=GetCommandLineW();
 return ci&&std::strcmp(ci,"true")==0&&profile&&((std::strlen(profile)>2&&profile[1]==':')||(profile[0]=='\\'&&profile[1]=='\\'))&&
  (std::wcsstr(command,L"--mouse-637-features-smoke")||std::wcsstr(command,L"--mouse-642-controls-smoke"));
}
napi_value fixture(napi_env env,napi_callback_info info){
 size_t count=2;napi_value args[2];napi_get_cb_info(env,info,&count,args,nullptr,nullptr);std::string action;
 if(!fixtureAllowed()||count!=2||!sourceID(env,args[1],action)||(action!="prepare"&&action!="restore")){napi_throw_error(env,nullptr,"Input-source fixture is CI smoke-only");return nullptr;}
 const HWND window=windowFrom(env,args[0]);if(!window)return result(env,read(nullptr));bool okay=true;
 if(action=="prepare"){
  const auto before=installed();
  for(const auto& desired:std::vector<std::pair<WORD,const wchar_t*>>{{LANG_ENGLISH,L"00000409"},{LANG_RUSSIAN,L"00000419"}}){
   bool present=false;for(const HKL layout:before)if(PRIMARYLANGID(LOWORD(reinterpret_cast<uintptr_t>(layout)))==desired.first)present=true;
   if(present)continue;const HKL loaded=LoadKeyboardLayoutW(desired.second,0);if(!loaded){okay=false;continue;}
   if(std::find(before.begin(),before.end(),loaded)==before.end()&&std::find(fixtureAdded.begin(),fixtureAdded.end(),loaded)==fixtureAdded.end())fixtureAdded.push_back(loaded);
  }
 }else{
  std::vector<HKL> remaining;for(const HKL layout:fixtureAdded)if(!UnloadKeyboardLayout(layout)){okay=false;remaining.push_back(layout);}fixtureAdded=remaining;
 }
 State value=read(window);if(!okay)value.reason="input-source-fixture-failed";return result(env,value);
}
napi_value testKey(napi_env env,napi_callback_info info){
 size_t count=1;napi_value args[1];napi_get_cb_info(env,info,&count,args,nullptr,nullptr);
 const HWND window=count==1?windowFrom(env,args[0]):nullptr;
 if(!fixtureAllowed()||!window||GetAncestor(GetForegroundWindow(),GA_ROOT)!=GetAncestor(window,GA_ROOT)){napi_throw_error(env,nullptr,"Input-source key probe is CI smoke-only in the focused app");return nullptr;}
 INPUT keys[2]{};for(int index=0;index<2;index++){keys[index].type=INPUT_KEYBOARD;keys[index].ki.wScan=0x22;keys[index].ki.dwFlags=KEYEVENTF_SCANCODE|(index?KEYEVENTF_KEYUP:0);}
 return boolean(env,SendInput(2,keys,sizeof(INPUT))==2);
}
}
void installMouseInputLanguage(napi_env env,napi_value exports){
 mouse_input_language::install(env,exports,state,select);
 const napi_property_descriptor properties[]={{"testInputLanguageSources",nullptr,fixture,nullptr,nullptr,nullptr,napi_default,nullptr},{"testInputLanguageKey",nullptr,testKey,nullptr,nullptr,nullptr,napi_default,nullptr}};napi_define_properties(env,exports,2,properties);
}
