// Shared browser gesture checks and native pane corners on X11.
#include <node_api.h>
#include <X11/Xlib.h>
void installMouseLinuxPaneCorners(napi_env env,napi_value exports);

static napi_value primaryDown(napi_env e,napi_callback_info){
 bool down=false;Display* display=XOpenDisplay(nullptr);
 if(display){
  for(int index=0;index<ScreenCount(display);index++){
   Window root,child;int rootX,rootY,windowX,windowY;unsigned int mask=0;
   if(XQueryPointer(display,RootWindow(display,index),&root,&child,&rootX,&rootY,&windowX,&windowY,&mask)&&(mask&Button1Mask)){down=true;break;}
  }
  XCloseDisplay(display);
 }
 napi_value value;napi_get_boolean(e,down,&value);return value;
}

static napi_value init(napi_env env,napi_value exports){
 const napi_property_descriptor property={"primaryDown",nullptr,primaryDown,nullptr,nullptr,nullptr,napi_default,nullptr};
 napi_define_properties(env,exports,1,&property);installMouseLinuxPaneCorners(env,exports);return exports;
}
NAPI_MODULE(NODE_GYP_MODULE_NAME,init)
