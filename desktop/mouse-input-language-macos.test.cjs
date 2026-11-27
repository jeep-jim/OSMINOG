'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');

test('Mac fixture queries only owned IDs and retains cleanup ownership until observed exact restoration',{skip:process.platform!=='linux'},()=>{
 const source=fs.readFileSync(path.join(__dirname,'mouse-native/input-language-macos.mm'),'utf8');
 const helpers=source.slice(source.indexOf('std::string fixtureOriginal;'),source.indexOf('bool fixtureAllowed()'));
 const operation=source.slice(source.indexOf('napi_value fixture('),source.indexOf('napi_value testKey('));
 assert.ok(helpers.includes('copyFixtureSource')&&operation.includes('TISDisableInputSource'));
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'mouse-tis-fixture-')),file=path.join(directory,'fixture.cc'),binary=path.join(directory,'fixture');
 const model=String.raw`
#include <algorithm>
#include <cassert>
#include <memory>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>
struct Source{std::string id,label,language;};
struct State{bool available=false;std::string current,reason;std::vector<Source> sources;};
struct NativeSource{std::string id,language;bool enabled=false;int enables=0,disables=0;};
struct Filter{std::string id;};
using TISInputSourceRef=NativeSource*;using CFStringRef=std::string*;using CFDictionaryRef=Filter*;using CFArrayRef=std::vector<TISInputSourceRef>*;using CFIndex=long;
const std::string US="com.apple.keylayout.US",RU="com.apple.keylayout.Russian",AIN="com.apple.inputmethod.AinuIM.Ainu";
int idKey=1,enabledKey=2,trueValue=3,falseValue=4,kCFTypeDictionaryKeyCallBacks=5,kCFTypeDictionaryValueCallBacks=6;
const void* kTISPropertyInputSourceID=&idKey;const void* kTISPropertyInputSourceIsEnabled=&enabledKey;const void* kCFBooleanTrue=&trueValue;
constexpr int noErr=0,kCFStringEncodingUTF8=1;void* kCFAllocatorDefault=nullptr;
std::vector<NativeSource> installed;std::vector<std::pair<std::string,bool>> queries;std::string current,action;bool delayedDisable=false;int broadCalls=0;
NativeSource& item(const std::string& id){for(auto& source:installed)if(source.id==id)return source;throw std::runtime_error("missing model source");}
State read(){State state;state.current=current;for(const auto& source:installed)if(source.enabled)state.sources.push_back({source.id,source.id,source.language});state.available=!state.sources.empty()&&item(current).enabled;return state;}
std::string sourceIdentifier(TISInputSourceRef source){return source?source->id:std::string();}
CFStringRef CFStringCreateWithCString(void*,const char* value,int){return new std::string(value);}
CFDictionaryRef CFDictionaryCreate(void*,const void** key,const void** value,int count,const void*,const void*){assert(count==1&&*key==kTISPropertyInputSourceID);return new Filter{*static_cast<const std::string*>(*value)};}
CFArrayRef TISCreateInputSourceList(CFDictionaryRef filter,bool all){
 if(!filter&&all){++broadCalls;item(AIN).enabled=true;} // Models possible unrelated initialization consistent with the reported set drift.
 queries.push_back({filter?filter->id:"<all>",all});auto result=new std::vector<TISInputSourceRef>;
 for(auto& source:installed)if((!filter||source.id==filter->id)&&(all||source.enabled))result->push_back(&source);return result;
}
CFIndex CFArrayGetCount(CFArrayRef list){return static_cast<CFIndex>(list->size());}
const void* CFArrayGetValueAtIndex(CFArrayRef list,CFIndex index){return list->at(index);}
void CFRelease(CFStringRef value){delete value;}void CFRelease(CFDictionaryRef value){delete value;}void CFRelease(CFArrayRef value){delete value;}void CFRelease(TISInputSourceRef){}void CFRetain(TISInputSourceRef){}
const void* TISGetInputSourceProperty(TISInputSourceRef source,const void* key){assert(key==kTISPropertyInputSourceIsEnabled);return source->enabled?kCFBooleanTrue:&falseValue;}
int TISEnableInputSource(TISInputSourceRef source){source->enabled=true;++source->enables;return noErr;}
int TISDisableInputSource(TISInputSourceRef source){++source->disables;if(!(delayedDisable&&source->id==RU&&source->disables==1))source->enabled=false;return noErr;}
int TISSelectInputSource(TISInputSourceRef source){if(!source->enabled)return 1;current=source->id;return noErr;}
using napi_value=State*;using napi_env=void*;using napi_callback_info=void*;
void napi_get_cb_info(napi_env,napi_callback_info,size_t* count,napi_value* args,void*,void*){*count=2;args[0]=args[1]=nullptr;}
bool sourceID(napi_env,napi_value,std::string& output){output=action;return true;}
void napi_throw_error(napi_env,void*,const char* message){throw std::runtime_error(message);}
napi_value result(napi_env,const State& state){return new State(state);}bool fixtureAllowed(){return true;}
`;
 const checks=String.raw`
void reset(){installed={{US,"en",true},{RU,"ru",false},{AIN,"ain",false}};current=US;queries.clear();broadCalls=0;delayedDisable=false;fixtureOriginal.clear();fixtureAdded.clear();fixtureOriginalSources.clear();}
State call(const std::string& value){action=value;std::unique_ptr<State> answer(fixture(nullptr,nullptr));assert(answer);return *answer;}
int main(){
 reset();auto broad=TISCreateInputSourceList(nullptr,true);CFRelease(broad);assert(item(AIN).enabled&&read().sources.size()==2);
 reset();auto prepared=call("prepare");assert(prepared.available&&prepared.sources.size()==2&&item(RU).enables==1&&!item(AIN).enabled&&broadCalls==0);assert(fixtureAdded==std::vector<std::string>{RU});
 delayedDisable=true;current=RU;auto pending=call("restore");assert(pending.current==US&&item(RU).enabled&&pending.reason=="input-source-fixture-restoration-unconfirmed");assert(fixtureOriginal==US&&fixtureAdded==std::vector<std::string>{RU});
 auto restored=call("restore");assert(restored.sources.size()==1&&restored.current==US&&!item(RU).enabled);assert(item(RU).disables==2&&fixtureOriginal.empty()&&fixtureAdded.empty()&&fixtureOriginalSources.empty());assert(item(AIN).disables==0&&broadCalls==0);
 for(const auto& query:queries)assert(query.first==US||query.first==RU);
 reset();item(RU).enabled=true;call("prepare");assert(fixtureAdded.empty()&&item(RU).enables==0);current=RU;auto existing=call("restore");assert(existing.current==US&&existing.sources.size()==2&&item(RU).enabled&&item(RU).disables==0);
 reset();call("prepare");item(AIN).enabled=true;auto drift=call("restore");assert(drift.sources.size()==2&&drift.reason=="input-source-fixture-restoration-unconfirmed");assert(!fixtureOriginal.empty()&&fixtureAdded==std::vector<std::string>{RU});call("restore");assert(item(AIN).enabled&&item(AIN).disables==0&&broadCalls==0);
}
`;
 try{
  fs.writeFileSync(file,model+helpers+operation+checks);
  cp.execFileSync('g++',['-std=c++17','-Wall','-Wextra','-Werror','-Wno-misleading-indentation',file,'-o',binary],{stdio:'pipe',timeout:30000});
  cp.execFileSync(binary,[],{stdio:'pipe',timeout:5000});
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
