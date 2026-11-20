// Native, input-transparent bottom-corner chrome for the actual X11 backend.
// It paints tiny inverse-circle regions above the application's own window.
// No website CSS, viewport change, overlay renderer or backend switch is used.
#include <node_api.h>
#include <X11/Xlib.h>
#include <X11/Xatom.h>
#include <X11/extensions/shape.h>
#include <unistd.h>
#include <algorithm>
#include <atomic>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <map>
#include <mutex>
#include <string>
#include <vector>
#include "pane-corners-linux-geometry.h"

namespace {
using mouse_linux_corners::Pane;
using mouse_linux_corners::Shape;
struct Corner {Window window=0;Shape shape{};};
struct Trim {
 std::vector<Pane> panes;std::vector<Corner> corners;double width=0,height=0,sx=0,sy=0;
 uint64_t calls=0,paints=0,cached=0;std::string reason="not-called";bool owned=false;int error=0;
};
struct State {Display* display=nullptr;bool shape=false;std::map<Window,Trim> trims;};
// Trap errors only on this addon's separate X connection. A stale Electron
// handle must not reach Xlib's default fatal handler; other clients retain
// the handler which was installed before this synchronous operation.
struct Trap;
thread_local Trap* activeTrap=nullptr;
std::mutex trapMutex;
using ErrorHandler=int(*)(Display*,XErrorEvent*);
std::atomic<ErrorHandler> previousHandler{nullptr};
struct Trap {
 std::unique_lock<std::mutex> lock;Display* display;int error=0;ErrorHandler previous;
 static int onError(Display* display,XErrorEvent* event){
  if(activeTrap&&display==activeTrap->display){activeTrap->error=event->error_code;return 0;}
  const auto handler=previousHandler.load(std::memory_order_acquire);return handler?handler(display,event):0;
 }
 explicit Trap(Display* d):lock(trapMutex),display(d){activeTrap=this;previous=XSetErrorHandler(onError);previousHandler.store(previous,std::memory_order_release);}
 ~Trap(){XSync(display,False);activeTrap=nullptr;XSetErrorHandler(previous);}
 bool sync(){XSync(display,False);return error==0;}
};
void clear(State& state,Trim& trim){
 if(state.display)for(const auto& corner:trim.corners)if(corner.window)XDestroyWindow(state.display,corner.window);
 trim.corners.clear();trim.panes.clear();trim.width=trim.height=0;
}
void cleanup(void* data){
 auto* state=static_cast<State*>(data);
 if(state->display){{Trap trap(state->display);for(auto& item:state->trims)clear(*state,item.second);}XCloseDisplay(state->display);}
 delete state;
}
State* stateFor(napi_env env,napi_callback_info info,size_t& n,napi_value* args){void* data=nullptr;napi_get_cb_info(env,info,&n,args,nullptr,&data);return static_cast<State*>(data);}
bool connect(State& state){
 if(state.display)return state.shape;
 state.display=XOpenDisplay(nullptr);if(!state.display)return false;
 int event=0,error=0,major=0,minor=0;Trap trap(state.display);
 state.shape=XShapeQueryExtension(state.display,&event,&error)&&XShapeQueryVersion(state.display,&major,&minor)&&(major>1||(major==1&&minor>=1));
 if(!trap.sync())state.shape=false;return state.shape;
}
napi_value object(napi_env env){napi_value value;napi_create_object(env,&value);return value;}
void number(napi_env env,napi_value object,const char* name,double value){napi_value item;napi_create_double(env,value,&item);napi_set_named_property(env,object,name,item);}
void boolean(napi_env env,napi_value object,const char* name,bool value){napi_value item;napi_get_boolean(env,value,&item);napi_set_named_property(env,object,name,item);}
void string(napi_env env,napi_value object,const char* name,const char* value){napi_value item;napi_create_string_utf8(env,value,NAPI_AUTO_LENGTH,&item);napi_set_named_property(env,object,name,item);}
napi_value result(napi_env env,size_t count){napi_value value;napi_create_uint32(env,static_cast<uint32_t>(count),&value);return value;}
bool handle(napi_env env,napi_value value,Window& window){
 bool buffer=false;void* bytes=nullptr;size_t size=0;uint64_t number=0;
 if(napi_is_buffer(env,value,&buffer)!=napi_ok||!buffer||napi_get_buffer_info(env,value,&bytes,&size)!=napi_ok||(size!=4&&size!=8))return false;
 std::memcpy(&number,bytes,size);if(!number||number>0xffffffffULL)return false;window=static_cast<Window>(number);return true;
}
bool property(napi_env env,napi_value value,const char* key,double& out){napi_value field;return napi_get_named_property(env,value,key,&field)==napi_ok&&napi_get_value_double(env,field,&out)==napi_ok&&std::isfinite(out);}
bool ownedParent(State& state,Window parent,XWindowAttributes& attr){
 if(!XGetWindowAttributes(state.display,parent,&attr)||attr.c_class!=InputOutput||attr.width<1||attr.height<1||attr.depth<1||attr.depth>32||parent==attr.root||!attr.visual||attr.visual->c_class!=TrueColor)return false;
 const Atom pid=XInternAtom(state.display,"_NET_WM_PID",True);if(pid==None)return false;
 Atom type=None;int format=0;unsigned long count=0,left=0;unsigned char* value=nullptr;
 const int status=XGetWindowProperty(state.display,parent,pid,0,1,False,XA_CARDINAL,&type,&format,&count,&left,&value);
 const bool owned=status==Success&&type==XA_CARDINAL&&format==32&&count==1&&value&&*reinterpret_cast<unsigned long*>(value)==static_cast<unsigned long>(getpid());
 if(value)XFree(value);return owned;
}
bool paneValue(napi_env env,napi_value value,double width,double height,Pane& pane){
 if(!property(env,value,"x",pane.x)||!property(env,value,"y",pane.y)||!property(env,value,"width",pane.width)||!property(env,value,"height",pane.height)||pane.x<0||pane.y<0||pane.width<24||pane.height<24||pane.x+pane.width>width+1||pane.y+pane.height>height+1)return false;
 napi_value color;char text[8]{};size_t size=0;
 if(napi_get_named_property(env,value,"color",&color)!=napi_ok||napi_get_value_string_utf8(env,color,nullptr,0,&size)!=napi_ok||size!=7||napi_get_value_string_utf8(env,color,text,sizeof(text),&size)!=napi_ok||text[0]!='#')return false;
 uint32_t rgb=0;for(int i=1;i<7;i++){const char c=text[i];const int n=c>='0'&&c<='9'?c-'0':c>='a'&&c<='f'?c-'a'+10:c>='A'&&c<='F'?c-'A'+10:-1;if(n<0)return false;rgb=(rgb<<4)|n;}pane.color=rgb;return true;
}
}

static napi_value paneCorners(napi_env env,napi_callback_info info){
 size_t n=3;napi_value args[3];State* state=stateFor(env,info,n,args);Window parent=0;
 if(n!=3||!state||!handle(env,args[0],parent))return result(env,0);
 if(!state->trims.count(parent)&&state->trims.size()>=32)return result(env,0);
 auto& trim=state->trims[parent];trim.calls++;trim.error=0;
 bool array=false;uint32_t count=0;
 if(napi_is_array(env,args[1],&array)!=napi_ok||!array||napi_get_array_length(env,args[1],&count)!=napi_ok||count>100){trim.reason="invalid-panes";return result(env,0);}
 if(!connect(*state)){trim.reason=state->display?"shape-unavailable":"x11-unavailable";return result(env,0);}
 Trap trap(state->display);
 if(!count){clear(*state,trim);trim.reason="cleared";trap.sync();trim.error=trap.error;return result(env,0);}
 double width=0,height=0;XWindowAttributes attr{};
 if(!property(env,args[2],"width",width)||!property(env,args[2],"height",height)||width<32||height<32||!ownedParent(*state,parent,attr)||!trap.sync()){
  clear(*state,trim);trim.owned=false;trim.reason="invalid-owned-parent";trim.error=trap.error;return result(env,0);
 }
 trim.owned=true;const double sx=attr.width/width,sy=attr.height/height;
 if(sx<.5||sx>8||sy<.5||sy>8||std::abs(sx-sy)>2/std::min(width,height)){clear(*state,trim);trim.reason="invalid-device-scale";return result(env,0);}
 std::vector<Pane> panes;panes.reserve(count);
 for(uint32_t i=0;i<count;i++){napi_value value;Pane pane{};if(napi_get_element(env,args[1],i,&value)==napi_ok&&paneValue(env,value,width,height,pane))panes.push_back(pane);}
 if(panes.empty()){clear(*state,trim);trim.reason="no-valid-panes";return result(env,0);}
 if(trim.width==width&&trim.height==height&&trim.sx==sx&&trim.sy==sy&&panes.size()==trim.panes.size()&&std::equal(panes.begin(),panes.end(),trim.panes.begin(),mouse_linux_corners::same)){
  trim.cached++;trim.reason="cached";return result(env,trim.panes.size());
 }
 size_t used=0;bool failed=false;
 for(const auto& pane:panes)for(bool right:{false,true}){
  Shape shape=mouse_linux_corners::corner(pane,sx,sy,right);
  if(shape.width<1||shape.width>128||shape.height<1||shape.height>128||shape.runs.empty()){failed=true;break;}
  if(used==trim.corners.size())trim.corners.emplace_back();auto& corner=trim.corners[used++];
  const unsigned long color=mouse_linux_corners::pixel(shape.color,attr.visual->red_mask,attr.visual->green_mask,attr.visual->blue_mask,attr.depth);
  if(!corner.window){
   XSetWindowAttributes attributes{};attributes.background_pixel=color;attributes.override_redirect=True;attributes.event_mask=0;
   corner.window=XCreateWindow(state->display,parent,shape.x,shape.y,shape.width,shape.height,0,CopyFromParent,InputOutput,CopyFromParent,CWBackPixel|CWOverrideRedirect|CWEventMask,&attributes);
   // An empty input region passes pointer and wheel input through the native
   // child, even in the small painted cutout. It cannot steal focus or keys.
   XShapeCombineRectangles(state->display,corner.window,ShapeInput,0,0,nullptr,0,ShapeSet,Unsorted);
  }else{XMoveResizeWindow(state->display,corner.window,shape.x,shape.y,shape.width,shape.height);XSetWindowBackground(state->display,corner.window,color);}
  std::vector<XRectangle> region;region.reserve(shape.runs.size());for(const auto& run:shape.runs)region.push_back({run.x,run.y,run.width,run.height});
  XShapeCombineRectangles(state->display,corner.window,ShapeBounding,0,0,region.data(),region.size(),ShapeSet,YXBanded);
  XClearWindow(state->display,corner.window);XMapRaised(state->display,corner.window);corner.shape=std::move(shape);
 }
 while(trim.corners.size()>used){XDestroyWindow(state->display,trim.corners.back().window);trim.corners.pop_back();}
 if(failed||!trap.sync()){trim.error=trap.error;clear(*state,trim);trim.reason="x11-paint-failed";return result(env,0);}
 trim.panes=std::move(panes);trim.width=width;trim.height=height;trim.sx=sx;trim.sy=sy;trim.paints++;trim.reason="ready";
 return result(env,trim.panes.size());
}

static napi_value paneCornersState(napi_env env,napi_callback_info info){
 size_t n=1;napi_value args[1];State* state=stateFor(env,info,n,args);Window parent=0;napi_value out=object(env);
 string(env,out,"backend","X11 Shape");boolean(env,out,"supported",state&&state->display&&state->shape);
 if(n!=1||!state||!handle(env,args[0],parent)){string(env,out,"reason","invalid-handle");return out;}
 number(env,out,"parent",parent);auto found=state->trims.find(parent);if(found==state->trims.end()){string(env,out,"reason","not-called");return out;}const auto& trim=found->second;
 string(env,out,"reason",trim.reason.c_str());number(env,out,"calls",trim.calls);number(env,out,"paints",trim.paints);number(env,out,"cached",trim.cached);number(env,out,"error",trim.error);boolean(env,out,"ownedParent",trim.owned);
 number(env,out,"paneCount",trim.panes.size());number(env,out,"cornerCount",trim.corners.size());number(env,out,"scaleX",trim.sx);number(env,out,"scaleY",trim.sy);number(env,out,"logicalWidth",trim.width);number(env,out,"logicalHeight",trim.height);
 napi_value corners;napi_create_array(env,&corners);napi_set_named_property(env,out,"corners",corners);if(!state->display)return out;
 Trap trap(state->display);uint32_t i=0;
 for(const auto& corner:trim.corners){
  napi_value item=object(env);number(env,item,"window",corner.window);number(env,item,"x",corner.shape.x);number(env,item,"y",corner.shape.y);number(env,item,"width",corner.shape.width);number(env,item,"height",corner.shape.height);number(env,item,"radiusX",corner.shape.rx);number(env,item,"radiusY",corner.shape.ry);
  XWindowAttributes attributes{};const bool exists=XGetWindowAttributes(state->display,corner.window,&attributes)!=0;
  boolean(env,item,"exists",exists);boolean(env,item,"mapped",exists&&attributes.map_state==IsViewable);boolean(env,item,"overrideRedirect",exists&&attributes.override_redirect);
  int count=0,order=0;XRectangle* input=XShapeGetRectangles(state->display,corner.window,ShapeInput,&count,&order);number(env,item,"inputRectangles",count);if(input)XFree(input);
  napi_set_element(env,corners,i++,item);
 }
 trap.sync();number(env,out,"queryError",trap.error);return out;
}

void installMouseLinuxPaneCorners(napi_env env,napi_value exports){
 auto* state=new State();napi_add_env_cleanup_hook(env,cleanup,state);
 const napi_property_descriptor props[]={{"paneCorners",nullptr,paneCorners,nullptr,nullptr,nullptr,napi_default,state},{"paneCornersState",nullptr,paneCornersState,nullptr,nullptr,nullptr,napi_default,state}};
 napi_define_properties(env,exports,2,props);
}
