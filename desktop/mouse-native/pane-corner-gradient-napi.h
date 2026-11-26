#ifndef MOUSE_PANE_CORNER_GRADIENT_NAPI_H
#define MOUSE_PANE_CORNER_GRADIENT_NAPI_H
#include <node_api.h>
#include "pane-corner-gradient.h"
namespace mouse_corner_gradient {
inline bool rgbProperty(napi_env env,napi_value value,const char* key,uint32_t& color){
 napi_value field;char text[8]{};size_t size=0;
 if(napi_get_named_property(env,value,key,&field)!=napi_ok||napi_get_value_string_utf8(env,field,nullptr,0,&size)!=napi_ok||size!=7||napi_get_value_string_utf8(env,field,text,sizeof(text),&size)!=napi_ok||text[0]!='#')return false;
 color=0;for(int i=1;i<7;i++){const char c=text[i];const int n=c>='0'&&c<='9'?c-'0':c>='a'&&c<='f'?c-'a'+10:c>='A'&&c<='F'?c-'A'+10:-1;if(n<0)return false;color=(color<<4)|n;}return true;
}
inline Gradient read(napi_env env,napi_value pane){
 Gradient result{};napi_value value;napi_valuetype type;
 if(napi_get_named_property(env,pane,"gradient",&value)!=napi_ok||napi_typeof(env,value,&type)!=napi_ok||type!=napi_object)return result;
 const char* keys[]={"x0","y0","x1","y1"};double* fields[]={&result.x0,&result.y0,&result.x1,&result.y1};
 for(int i=0;i<4;i++){napi_value field;if(napi_get_named_property(env,value,keys[i],&field)!=napi_ok||napi_get_value_double(env,field,fields[i])!=napi_ok||!std::isfinite(*fields[i])||std::abs(*fields[i])>32768)return {};}
 if(!rgbProperty(env,value,"start",result.start)||!rgbProperty(env,value,"end",result.end)||std::hypot(result.x1-result.x0,result.y1-result.y0)<1)return {};
 result.active=true;return result;
}
}
#endif
