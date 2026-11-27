'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const nodeInclude=process.env.MOUSE_TEST_NODE_API_INCLUDE||path.resolve(path.dirname(process.execPath),'../include/node');

test('Linux native source read explicitly acquires XKB controls and names, retaining actual group and failure paths',{skip:process.platform!=='linux'},()=>{
 const source=fs.readFileSync(path.join(__dirname,'mouse-native/input-language-linux.cc'),'utf8');
 // Compile the production read path, with only Xlib calls substituted. Real
 // GetKeyboardByName leaves ctrls null; the fixture must not invent that field.
 const begin=source.indexOf('std::vector<std::string> split('),end=source.indexOf('\nbool wayland()');
 assert.ok(begin>=0&&end>begin);
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'mouse-xkb-read-')),file=path.join(directory,'read.cc'),binary=path.join(directory,'read');
 const fixture=String.raw`
#include <algorithm>
#include <cassert>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>
struct Display{};
using Atom=unsigned long;
constexpr Atom None=0,XA_STRING=31;
constexpr int True=1,False=0,Success=0;
constexpr unsigned int XkbUseCoreKbd=0x100,XkbNumKbdGroups=4,XkbAllComponentsMask=0x7f,XkbGroupNamesMask=1u<<12,XkbGroupsWrapMask=1u<<27;
struct XkbStateRec{unsigned char group=0;};
struct XkbNamesRec{Atom groups[4]{};};
struct XkbControlsRec{unsigned char num_groups=0;};
struct XkbDescRec{Display* dpy=nullptr;unsigned short device_spec=0;XkbNamesRec* names=nullptr;XkbControlsRec* ctrls=nullptr;};
using XkbDescPtr=XkbDescRec*;
struct Source{std::string id,label,language;};
struct State{bool available=false;std::string current,reason;std::vector<Source> sources;};
int stateStatus=Success,controlsStatus=Success,namesStatus=Success,allocations=0,freed=0,controlsCalls=0,namesCalls=0;
bool allocationFails=false,missingControls=false,missingNames=false;
unsigned char actualGroup=1;
void reset(){stateStatus=controlsStatus=namesStatus=Success;allocations=freed=controlsCalls=namesCalls=0;allocationFails=missingControls=missingNames=false;actualGroup=1;}
int XkbGetState(Display*,unsigned int device,XkbStateRec* state){assert(device==XkbUseCoreKbd);state->group=actualGroup;return stateStatus;}
XkbDescPtr XkbAllocKeyboard(){if(allocationFails)return nullptr;++allocations;return new XkbDescRec;}
int XkbGetControls(Display* display,unsigned long mask,XkbDescPtr desc){
 assert(desc&&desc->dpy==display&&desc->device_spec==XkbUseCoreKbd);assert(mask==XkbGroupsWrapMask);++controlsCalls;
 if(controlsStatus==Success&&!missingControls){desc->ctrls=new XkbControlsRec;desc->ctrls->num_groups=2;}return controlsStatus;
}
int XkbGetNames(Display* display,unsigned int mask,XkbDescPtr desc){
 assert(desc&&desc->dpy==display&&desc->device_spec==XkbUseCoreKbd);assert(mask==XkbGroupNamesMask);++namesCalls;
 if(namesStatus==Success&&!missingNames){desc->names=new XkbNamesRec;desc->names->groups[0]=100;desc->names->groups[1]=101;}return namesStatus;
}
// Model the original API accurately, including its unpopulated controls field.
XkbDescPtr XkbGetKeyboard(Display* display,unsigned int,unsigned int device){auto desc=XkbAllocKeyboard();if(desc){desc->dpy=display;desc->device_spec=device;desc->names=new XkbNamesRec;}return desc;}
void XkbFreeKeyboard(XkbDescPtr desc,unsigned int mask,int all){assert(desc&&mask==XkbAllComponentsMask&&all==True);++freed;delete desc->names;delete desc->ctrls;delete desc;}
Atom XInternAtom(Display*,const char* name,int existing){assert(std::string(name)=="_XKB_RULES_NAMES"&&existing==True);return 99;}
unsigned long DefaultRootWindow(Display*){return 1;}
int XGetWindowProperty(Display*,unsigned long,Atom,long,long,int,Atom,Atom* type,int* format,unsigned long* count,unsigned long* remaining,unsigned char** bytes){
 const char rules[]="evdev\0pc105\0us,ru\0,\0\0";*type=XA_STRING;*format=8;*remaining=0;*count=sizeof(rules)-1;
 *bytes=static_cast<unsigned char*>(std::malloc(*count));std::memcpy(*bytes,rules,*count);return Success;
}
char* XGetAtomName(Display*,Atom atom){const char* name=atom==100?"English (US)":"Russian";const size_t size=std::strlen(name)+1;char* value=static_cast<char*>(std::malloc(size));std::memcpy(value,name,size);return value;}
void XFree(void* value){std::free(value);}
`;
 const checks=String.raw`
int main(){
 Display display;
 auto old=XkbGetKeyboard(&display,XkbAllComponentsMask,XkbUseCoreKbd);assert(old&&old->names&&!old->ctrls);XkbFreeKeyboard(old,XkbAllComponentsMask,True);
 reset();auto russian=read(&display);assert(russian.available&&russian.current=="xkb:1:ru:");assert(russian.sources.size()==2);assert(russian.sources[0].id=="xkb:0:us:"&&russian.sources[0].language=="en");assert(russian.sources[1].label=="Russian"&&russian.sources[1].language=="ru");assert(controlsCalls==1&&namesCalls==1&&allocations==freed);
 reset();actualGroup=0;auto english=read(&display);assert(english.available&&english.current=="xkb:0:us:");assert(allocations==freed);
 reset();actualGroup=3;auto absent=read(&display);assert(!absent.available&&absent.current.empty()&&absent.reason=="input-sources-unavailable");assert(allocations==freed);
 reset();auto disconnected=read(nullptr);assert(!disconnected.available&&disconnected.reason=="x11-unavailable"&&allocations==0);
 reset();stateStatus=1;auto unavailable=read(&display);assert(!unavailable.available&&unavailable.reason=="xkb-unavailable"&&allocations==0);
 reset();allocationFails=true;assert(!read(&display).available&&freed==0&&controlsCalls==0&&namesCalls==0);
 reset();controlsStatus=1;assert(!read(&display).available&&controlsCalls==1&&namesCalls==0&&allocations==freed);
 reset();namesStatus=1;assert(!read(&display).available&&controlsCalls==1&&namesCalls==1&&allocations==freed);
 reset();missingControls=true;assert(!read(&display).available&&allocations==freed);
 reset();missingNames=true;assert(!read(&display).available&&allocations==freed);
}
`;
 try{
  fs.writeFileSync(file,fixture+source.slice(begin,end)+checks);
  cp.execFileSync('g++',['-std=c++17','-Wall','-Wextra','-Werror','-Wno-misleading-indentation',file,'-o',binary],{stdio:'pipe',timeout:30000});
  cp.execFileSync(binary,[],{stdio:'pipe',timeout:5000});
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

test('Linux native CI guard uses preserved exact argv after Chromium-style process-title flattening',{skip:process.platform!=='linux'||!fs.existsSync(path.join(nodeInclude,'node_api.h'))},()=>{
 const source=fs.readFileSync(path.join(__dirname,'mouse-native/input-language-linux.cc'),'utf8'),start=source.indexOf('bool fixtureAllowed(napi_env env)'),end=source.indexOf('\nbool ownsFocus('),waylandStart=source.indexOf('bool wayland()'),waylandEnd=source.indexOf('\nnapi_value state(');
 assert.ok(start>=0&&end>start&&waylandStart>=0&&waylandEnd>waylandStart);
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'mouse-xkb-argv-')),file=path.join(directory,'guard.cc'),binary=path.join(directory,'guard.node'),child=path.join(directory,'probe.cjs');
 try{
  fs.writeFileSync(file,'#include <cstdlib>\n#include <cstring>\n#include "input-language-napi.h"\nusing namespace mouse_input_language;\n'+source.slice(waylandStart,waylandEnd)+'\n'+source.slice(start,end)+String.raw`
napi_value allowed(napi_env env,napi_callback_info){return boolean(env,fixtureAllowed(env));}
napi_value init(napi_env env,napi_value exports){const napi_property_descriptor property={"allowed",nullptr,allowed,nullptr,nullptr,nullptr,napi_default,nullptr};napi_define_properties(env,exports,1,&property);return exports;}
NAPI_MODULE(NODE_GYP_MODULE_NAME,init)
`);
  cp.execFileSync('g++',['-std=c++17','-shared','-fPIC','-Wall','-Wextra','-Werror','-I',nodeInclude,'-I',path.join(__dirname,'mouse-native'),file,'-o',binary],{stdio:'pipe',timeout:30000});
  fs.writeFileSync(child,String.raw`
const assert=require('node:assert/strict'),fs=require('node:fs'),native=require(process.argv[2]);
const actual=process.argv.slice(),profile=process.env.MOUSE_TEST_PROFILE,flag='--mouse-642-controls-smoke';
assert.ok(actual.includes(flag));assert.equal(native.allowed(),true);
// Chromium's SetProcessTitleFromCommandLine uses this same space-joined form.
// The kernel no longer exposes a separate NUL-delimited write flag afterward.
process.title=actual.join(' ');
assert.equal(fs.readFileSync('/proc/self/cmdline','utf8').split('\0').includes(flag),false);
assert.deepEqual(process.argv,actual);assert.equal(native.allowed(),true);
for(const value of ['--mouse-642-controls-smoke=1','prefix--mouse-642-controls-smoke','--mouse-642-controls-read','--mouse-637-features-restore-read','mouse '+flag,flag+'\0extra']){process.argv=[actual[0],value];assert.equal(native.allowed(),false,value);}
for(const value of ['--mouse-642-controls-smoke','--mouse-637-features-smoke']){process.argv=[actual[0],value];assert.equal(native.allowed(),true,value);}
process.argv=Array(129).fill(flag);assert.equal(native.allowed(),false);
process.argv={0:flag,length:1};assert.equal(native.allowed(),false);
process.argv=actual;
for(const value of ['false','True','']){process.env.CI=value;assert.equal(native.allowed(),false);}process.env.CI='true';
for(const value of ['relative','']){process.env.MOUSE_TEST_PROFILE=value;assert.equal(native.allowed(),false);}process.env.MOUSE_TEST_PROFILE=profile;
process.env.WAYLAND_DISPLAY='wayland-0';assert.equal(native.allowed(),false);delete process.env.WAYLAND_DISPLAY;assert.equal(native.allowed(),true);
console.log('MOUSE_LINUX_NATIVE_ARGV_GUARD_PASS');
`);
  const env={...process.env,CI:'true',MOUSE_TEST_PROFILE:path.join(directory,'owned-profile')};delete env.WAYLAND_DISPLAY;
  const output=cp.execFileSync(process.execPath,[child,binary,'--mouse-642-controls-smoke'],{encoding:'utf8',env,timeout:5000});assert.match(output,/^MOUSE_LINUX_NATIVE_ARGV_GUARD_PASS\s*$/);
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

test('Linux XTest cleanup keeps library callbacks mapped until display close (compiled lifetime model)',{skip:process.platform!=='linux'},()=>{
 const source=fs.readFileSync(path.join(__dirname,'mouse-native/input-language-linux.cc'),'utf8'),keyStart=source.indexOf('napi_value testKey('),start=source.indexOf(' Display* display=XOpenDisplay(nullptr);',keyStart),end=source.indexOf('\n}',start);assert.ok(keyStart>=0&&start>keyStart&&end>start);
 const body=source.slice(start,end),safe='XCloseDisplay(display);if(library)dlclose(library);',broken='if(library){dlclose(library);}XCloseDisplay(display);';assert.ok(body.includes(safe));
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'mouse-xtest-lifetime-'));
 const model=String.raw`
#include <cassert>
#include <cstring>
#include <string>
#include <vector>
using Bool=int;using Window=unsigned long;using KeyCode=unsigned char;
constexpr int True=1,False=0,RTLD_NOW=2,RTLD_LOCAL=0;constexpr unsigned long CurrentTime=0,XK_g=103;
struct Display{void(*closeHook)()=nullptr;bool open=false;};
Display connection;bool libraryMapped=false;int scenario=0,keyCalls=0,closeCallbacks=0;std::vector<std::string> cleanup;
bool boolean(int,bool value){return value;}
Display* XOpenDisplay(const char*){if(scenario==1)return nullptr;connection.open=true;return &connection;}
void* dlopen(const char* name,int){assert(std::string(name)=="libXtst.so.6");if(scenario==2)return nullptr;libraryMapped=true;return &libraryMapped;}
bool ownsFocus(Display*,Window){return scenario!=3;}
void extensionClose(){assert(libraryMapped&&"XTest display callback ran after dlclose");++closeCallbacks;}
Bool fakeKey(Display* display,unsigned int key,Bool down,unsigned long){assert(display->open&&libraryMapped&&key==42);display->closeHook=extensionClose;++keyCalls;return !(scenario==5&&down||scenario==6&&!down);}
void* dlsym(void*,const char* name){assert(std::string(name)=="XTestFakeKeyEvent");return scenario==4?nullptr:reinterpret_cast<void*>(fakeKey);}
KeyCode XKeysymToKeycode(Display*,unsigned long symbol){assert(symbol==XK_g);return scenario==7?0:42;}
void XSync(Display* display,int){assert(display->open);}
void XCloseDisplay(Display* display){assert(display->open);if(display->closeHook)display->closeHook();display->open=false;cleanup.push_back("close");}
int dlclose(void*){assert(libraryMapped);libraryMapped=false;cleanup.push_back("unload");return 0;}
bool run(){const int env=0;const Window window=1;
`;
 const checks=String.raw`
}
int main(){
 for(scenario=0;scenario<8;scenario++){
  connection=Display{};libraryMapped=false;keyCalls=closeCallbacks=0;cleanup.clear();const bool sent=run();
  assert(sent==(scenario==0));assert(!connection.open&&!libraryMapped);
  if(scenario==1){assert(cleanup.empty());continue;}
  if(scenario==2){assert(cleanup==std::vector<std::string>{"close"});continue;}
  assert((cleanup==std::vector<std::string>{"close","unload"}));
  const bool registered=scenario==0||scenario==5||scenario==6;assert(closeCallbacks==(registered?1:0));
  assert(keyCalls==(scenario==0||scenario==6?2:scenario==5?1:0));
 }
}
`;
 try{
  for(const negative of [false,true]){
   const file=path.join(directory,negative?'reversed.cc':'correct.cc'),binary=path.join(directory,negative?'reversed':'correct');fs.writeFileSync(file,model+(negative?body.replace(safe,broken):body)+checks);
   cp.execFileSync('g++',['-std=c++17','-Wall','-Wextra','-Werror','-Wno-parentheses',file,'-o',binary],{stdio:'pipe',timeout:30000});
   const run=cp.spawnSync(binary,[],{encoding:'utf8',timeout:5000});
   if(negative){assert.notEqual(run.status,0);assert.match(run.stderr,/XTest display callback ran after dlclose/);}else assert.equal(run.status,0,run.stderr);
  }
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
