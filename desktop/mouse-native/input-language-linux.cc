#include <X11/Xlib.h>
#include <X11/Xatom.h>
#include <X11/XKBlib.h>
#include <X11/keysym.h>
#include <algorithm>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <iterator>
#include <dlfcn.h>
#include "input-language-napi.h"

namespace {
using namespace mouse_input_language;
std::vector<std::string> split(const std::string& value,char separator){
 std::vector<std::string> values;size_t start=0;
 for(size_t index=0;index<=value.size();index++)if(index==value.size()||value[index]==separator){values.push_back(value.substr(start,index-start));start=index+1;}return values;
}
std::vector<std::string> ruleNames(Display* display){
 const Atom atom=XInternAtom(display,"_XKB_RULES_NAMES",True);if(atom==None)return {};
 Atom type=None;int format=0;unsigned long count=0,remaining=0;unsigned char* bytes=nullptr;std::vector<std::string> result;
 if(XGetWindowProperty(display,DefaultRootWindow(display),atom,0,4096,False,XA_STRING,&type,&format,&count,&remaining,&bytes)==Success&&type==XA_STRING&&format==8&&remaining==0&&bytes)result=split(std::string(reinterpret_cast<char*>(bytes),count),'\0');
 if(bytes)XFree(bytes);return result;
}
State read(Display* display){
 State state;if(!display){state.reason="x11-unavailable";return state;}
 XkbStateRec current{};if(XkbGetState(display,XkbUseCoreKbd,&current)!=Success){state.reason="xkb-unavailable";return state;}
 // XkbGetKeyboard delegates to GetKeyboardByName and leaves ctrls null.
 // Fetch the live group count and names explicitly; neither operation changes it.
 XkbDescPtr keyboard=XkbAllocKeyboard();
 if(keyboard){keyboard->dpy=display;keyboard->device_spec=XkbUseCoreKbd;}
 if(!keyboard||XkbGetControls(display,XkbGroupsWrapMask,keyboard)!=Success||XkbGetNames(display,XkbGroupNamesMask,keyboard)!=Success||!keyboard->names||!keyboard->ctrls){if(keyboard)XkbFreeKeyboard(keyboard,XkbAllComponentsMask,True);state.reason="xkb-unavailable";return state;}
 const auto rules=ruleNames(display),layouts=rules.size()>2?split(rules[2],','):std::vector<std::string>(),variants=rules.size()>3?split(rules[3],','):std::vector<std::string>();
 const unsigned int groups=std::min<unsigned int>(keyboard->ctrls->num_groups,XkbNumKbdGroups);
 for(unsigned int index=0;index<groups;index++){
  Source source;const auto layout=index<layouts.size()?layouts[index]:std::string(),variant=index<variants.size()?variants[index]:std::string();
  source.id="xkb:"+std::to_string(index)+":"+layout+":"+variant;
  char* name=keyboard->names->groups[index]!=None?XGetAtomName(display,keyboard->names->groups[index]):nullptr;if(name){source.label=name;XFree(name);}
  if(source.label.empty())source.label=layout.empty()?source.id:layout+(variant.empty()?"":" ("+variant+")");
  source.language=layout=="us"||layout=="gb"?"en":layout=="ru"?"ru":layout.size()==2?layout:std::string();
  state.sources.push_back(source);if(index==current.group)state.current=source.id;
 }
 XkbFreeKeyboard(keyboard,XkbAllComponentsMask,True);state.available=!state.current.empty()&&!state.sources.empty();if(!state.available)state.reason="input-sources-unavailable";return state;
}
bool wayland(){const char* display=std::getenv("WAYLAND_DISPLAY");return display&&*display;}
napi_value state(napi_env env,napi_callback_info){
 if(wayland()){State value;value.reason="wayland-unavailable";return result(env,value);}
 Display* display=XOpenDisplay(nullptr);const State value=read(display);if(display)XCloseDisplay(display);return result(env,value);
}
napi_value select(napi_env env,napi_callback_info info){
 size_t count=2;napi_value args[2];napi_get_cb_info(env,info,&count,args,nullptr,nullptr);std::string id;
 if(wayland()||count!=2||!sourceID(env,args[1],id))return boolean(env,false);
 Display* display=XOpenDisplay(nullptr);if(!display)return boolean(env,false);const State value=read(display);bool selected=false;
 if(value.available)for(size_t index=0;index<value.sources.size();index++)if(value.sources[index].id==id){selected=XkbLockGroup(display,XkbUseCoreKbd,static_cast<unsigned int>(index));XSync(display,False);break;}
 XCloseDisplay(display);return boolean(env,selected);
}
bool fixtureAllowed(){
 const char* ci=std::getenv("CI"),*profile=std::getenv("MOUSE_TEST_PROFILE");if(!ci||std::strcmp(ci,"true")!=0||!profile||profile[0]!='/'||wayland())return false;
 std::ifstream input("/proc/self/cmdline",std::ios::binary);const std::string command((std::istreambuf_iterator<char>(input)),std::istreambuf_iterator<char>());
 for(const auto& argument:split(command,'\0'))if(argument=="--mouse-637-features-smoke"||argument=="--mouse-642-controls-smoke")return true;return false;
}
bool ownsFocus(Display* display,Window window){
 Window focused=None;int revert=0;XGetInputFocus(display,&focused,&revert);
 for(unsigned int depth=0;focused!=None&&focused!=PointerRoot&&depth<64;depth++){
  if(focused==window)return true;Window root=None,parent=None,*children=nullptr;unsigned int count=0;
  if(!XQueryTree(display,focused,&root,&parent,&children,&count))return false;if(children)XFree(children);if(parent==focused)return false;focused=parent;
 }
 return false;
}
napi_value testKey(napi_env env,napi_callback_info info){
 size_t count=1;napi_value args[1];napi_get_cb_info(env,info,&count,args,nullptr,nullptr);bool buffer=false;void* bytes=nullptr;size_t size=0;Window window=0;
 if(count==1&&napi_is_buffer(env,args[0],&buffer)==napi_ok&&buffer&&napi_get_buffer_info(env,args[0],&bytes,&size)==napi_ok&&(size==4||size==8))std::memcpy(&window,bytes,std::min(size,sizeof(window)));
 if(!fixtureAllowed()||!window){napi_throw_error(env,nullptr,"Input-source key probe is CI smoke-only");return nullptr;}
 Display* display=XOpenDisplay(nullptr);if(!display)return boolean(env,false);
 bool okay=false;void* library=dlopen("libXtst.so.6",RTLD_NOW|RTLD_LOCAL);
 if(library&&ownsFocus(display,window)){
  using FakeKey=Bool(*)(Display*,unsigned int,Bool,unsigned long);auto fake=reinterpret_cast<FakeKey>(dlsym(library,"XTestFakeKeyEvent"));
  const KeyCode key=XKeysymToKeycode(display,XK_g);if(fake&&key)okay=fake(display,key,True,CurrentTime)&&fake(display,key,False,CurrentTime);XSync(display,False);
 }
 if(library)dlclose(library);XCloseDisplay(display);return boolean(env,okay);
}
}
void installMouseInputLanguage(napi_env env,napi_value exports){
 mouse_input_language::install(env,exports,state,select);
 const napi_property_descriptor property={"testInputLanguageKey",nullptr,testKey,nullptr,nullptr,nullptr,napi_default,nullptr};napi_define_properties(env,exports,1,&property);
}
