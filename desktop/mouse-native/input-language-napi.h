#pragma once
#include <node_api.h>
#include <cstdint>
#include <string>
#include <vector>
#include <utility>

// Only OS input-source metadata crosses this boundary. No typed text is read.
namespace mouse_input_language {
struct Source {std::string id,label,language;};
struct State {bool available=false;std::string current,reason;std::vector<Source> sources;};
inline napi_value text(napi_env env,const std::string& value){napi_value result;napi_create_string_utf8(env,value.c_str(),value.size(),&result);return result;}
inline napi_value boolean(napi_env env,bool value){napi_value result;napi_get_boolean(env,value,&result);return result;}
inline void property(napi_env env,napi_value object,const char* key,const std::string& value){napi_set_named_property(env,object,key,text(env,value));}
inline bool sourceID(napi_env env,napi_value value,std::string& result){
 napi_valuetype type;size_t size=0;
 if(napi_typeof(env,value,&type)!=napi_ok||type!=napi_string||napi_get_value_string_utf8(env,value,nullptr,0,&size)!=napi_ok||size==0||size>512)return false;
 std::vector<char> buffer(size+1);if(napi_get_value_string_utf8(env,value,buffer.data(),buffer.size(),&size)!=napi_ok)return false;
 result.assign(buffer.data(),size);return result.find('\0')==std::string::npos;
}
inline napi_value result(napi_env env,const State& state){
 napi_value output,list;napi_create_object(env,&output);napi_create_array_with_length(env,state.sources.size(),&list);
 napi_set_named_property(env,output,"available",boolean(env,state.available));property(env,output,"currentId",state.current);property(env,output,"reason",state.reason);
 for(size_t index=0;index<state.sources.size();index++){
  const auto& source=state.sources[index];napi_value value;napi_create_object(env,&value);
  property(env,value,"id",source.id);property(env,value,"label",source.label);property(env,value,"language",source.language);
  napi_set_named_property(env,value,"active",boolean(env,source.id==state.current));napi_set_element(env,list,static_cast<uint32_t>(index),value);
 }
 napi_set_named_property(env,output,"layouts",list);return output;
}
inline void install(napi_env env,napi_value exports,napi_callback state,napi_callback select){
 const napi_property_descriptor properties[]={
  {"inputLanguageState",nullptr,state,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"selectInputLanguage",nullptr,select,nullptr,nullptr,nullptr,napi_default,nullptr}
 };
 napi_define_properties(env,exports,2,properties);
}
}
