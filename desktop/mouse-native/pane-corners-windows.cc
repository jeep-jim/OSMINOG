// Native, noninteractive pane chrome. WebContentsView's public radius rounds
// all four corners; ordinary View clipping does not clip its separate Aura
// surface. Paint only the two small bottom cutouts, preserving the guest's
// viewport, scroll position, DOM and input routing (the same model as macOS).
#include <node_api.h>
#include <windows.h>
#include <commctrl.h>
#include <dcomp.h>
#include <dwmapi.h>
#include <wrl/client.h>
#include <algorithm>
#include <cmath>
#include <cctype>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <utility>
#include <vector>
#include "pane-corner-gradient-napi.h"

namespace {
using Microsoft::WRL::ComPtr;
constexpr wchar_t kCornerClass[]=L"MouseBrowserPaneCorner629";
constexpr UINT_PTR kCornerSubclass=1;
struct Pane {double x,y,width,height;uint32_t color;mouse_corner_gradient::Gradient gradient{};};
struct Corner {
 HWND window=nullptr;int width=0,height=0;double cx=0,cy=0,radius=0;uint32_t color=0;bool painted=false;
 mouse_corner_gradient::Gradient gradient{};int paintX=0,paintY=0;double paintScale=1;
 ComPtr<IUnknown> surface;ComPtr<IDCompositionVisual2> visual;int visualX=0,visualY=0;bool cloaked=false;
};
struct CornerTrace {
 HWND parent;std::string reason="received";DWORD error=0;HRESULT hresult=S_OK;uint32_t requested=0,accepted=0;int result=0;uint64_t calls=0;
};
thread_local std::vector<CornerTrace> cornerTraces;
CornerTrace& trace(HWND parent){
 for(auto& entry:cornerTraces)if(entry.parent==parent)return entry;
 if(cornerTraces.size()==32)cornerTraces.erase(cornerTraces.begin());
 cornerTraces.push_back(CornerTrace{parent});return cornerTraces.back();
}
void traceResult(HWND parent,const char* reason,DWORD error,uint32_t accepted,int result,HRESULT hresult=S_OK){
 auto& entry=trace(parent);entry.reason=reason;entry.error=error;entry.hresult=hresult;entry.accepted=accepted;entry.result=result;
}
void eraseTrace(HWND parent){
 cornerTraces.erase(std::remove_if(cornerTraces.begin(),cornerTraces.end(),[parent](const CornerTrace& entry){return entry.parent==parent;}),cornerTraces.end());
}
struct PaneTrim {
 HWND parent;std::vector<Pane> panes;std::vector<Corner> corners;bool painting=false;
 const char* paintStage="not-started";DWORD paintError=0;HRESULT paintHresult=S_OK;
 const bool composed;ComPtr<IDCompositionDesktopDevice> device;ComPtr<IDCompositionTarget> target;ComPtr<IDCompositionVisual2> root;
 int clipWidth=-1,clipHeight=-1;uint64_t commits=0;
 explicit PaneTrim(HWND handle):parent(handle),composed((GetWindowLongPtrW(handle,GWL_EXSTYLE)&WS_EX_NOREDIRECTIONBITMAP)!=0){}
 void releaseComposition(){
  HRESULT hr=S_OK;
  if(target)hr=target->SetRoot(nullptr);
  if(device){const HRESULT committed=device->Commit();if(SUCCEEDED(hr))hr=committed;}
  // Release only the target this trim created. Even if a detached/dead window
  // rejects the last transaction, releasing our target frees its own layer.
  for(auto& corner:corners){corner.visual.Reset();corner.surface.Reset();}
  root.Reset();target.Reset();device.Reset();
  if(FAILED(hr))std::fprintf(stderr,"Mouse pane corner composition cleanup failed (HRESULT 0x%08lx)\n",static_cast<unsigned long>(static_cast<uint32_t>(hr)));
 }
 void destroy(Corner& corner){
  corner.visual.Reset();corner.surface.Reset();
  if(corner.window&&GetWindowLongPtrW(corner.window,GWLP_USERDATA)==reinterpret_cast<LONG_PTR>(this))DestroyWindow(corner.window);
  corner.window=nullptr;
 }
 ~PaneTrim(){releaseComposition();for(auto& corner:corners)destroy(corner);}
};

LRESULT CALLBACK cornerWindowProc(HWND window,UINT message,WPARAM wparam,LPARAM lparam){
 if(message==WM_NCCREATE){const auto* create=reinterpret_cast<const CREATESTRUCTW*>(lparam);SetWindowLongPtrW(window,GWLP_USERDATA,reinterpret_cast<LONG_PTR>(create->lpCreateParams));}
 if(message==WM_NCDESTROY)SetWindowLongPtrW(window,GWLP_USERDATA,0);
 if(message==WM_NCHITTEST)return HTTRANSPARENT;
 if(message==WM_MOUSEACTIVATE)return MA_NOACTIVATE;
 if(message==WM_ERASEBKGND)return 1;
 return DefWindowProcW(window,message,wparam,lparam);
}
bool ensureCornerClass(){
 const HINSTANCE module=GetModuleHandleW(nullptr);WNDCLASSW cls{};
 if(GetClassInfoW(module,kCornerClass,&cls)){if(cls.lpfnWndProc==cornerWindowProc)return true;SetLastError(ERROR_CLASS_ALREADY_EXISTS);return false;}
 cls.lpfnWndProc=cornerWindowProc;cls.hInstance=module;cls.lpszClassName=kCornerClass;
 return RegisterClassW(&cls)!=0;
}
bool drawCorner(Corner& corner,int width,int height,double cx,double cy,double radius,uint32_t color,const mouse_corner_gradient::Gradient& gradient,int originX,int originY,double scale,const char*& stage){
 // A top-down, premultiplied BGRA DIB. Supersampling only the tiny 12-DIP
 // cutouts makes the native arc smooth at fractional display scales.
 BITMAPINFO info{};info.bmiHeader.biSize=sizeof(BITMAPINFOHEADER);info.bmiHeader.biWidth=width;info.bmiHeader.biHeight=-height;
 info.bmiHeader.biPlanes=1;info.bmiHeader.biBitCount=32;info.bmiHeader.biCompression=BI_RGB;
 void* raw=nullptr;stage="create-bitmap-dc";SetLastError(ERROR_SUCCESS);HDC dc=CreateCompatibleDC(nullptr);if(!dc)return false;
 stage="create-bitmap";SetLastError(ERROR_SUCCESS);
 HBITMAP bitmap=CreateDIBSection(dc,&info,DIB_RGB_COLORS,&raw,nullptr,0);
 if(!bitmap||!raw){const DWORD error=GetLastError();if(bitmap)DeleteObject(bitmap);DeleteDC(dc);SetLastError(error);return false;}
 stage="select-bitmap";SetLastError(ERROR_SUCCESS);HGDIOBJ old=SelectObject(dc,bitmap);
 if(!old||old==HGDI_ERROR){const DWORD error=GetLastError();DeleteObject(bitmap);DeleteDC(dc);SetLastError(error);return false;}
 auto* pixels=static_cast<uint32_t*>(raw);
 const double square=radius*radius;
 for(int y=0;y<height;y++)for(int x=0;x<width;x++){
  const uint32_t pixelColor=mouse_corner_gradient::sample(gradient,(originX+x+.5)/scale,(originY+y+.5)/scale,color);
  const unsigned red=(pixelColor>>16)&255,green=(pixelColor>>8)&255,blue=pixelColor&255;
  unsigned outside=0;
  for(int sy=0;sy<4;sy++)for(int sx=0;sx<4;sx++){
   const double dx=x+(sx+0.5)/4-cx,dy=y+(sy+0.5)/4-cy;
   if(dx*dx+dy*dy>=square)outside++;
  }
  const unsigned alpha=(outside*255+8)/16;
  pixels[y*width+x]=(alpha<<24)|(((red*alpha+127)/255)<<16)|(((green*alpha+127)/255)<<8)|((blue*alpha+127)/255);
 }
 SIZE size{width,height};POINT source{0,0};BLENDFUNCTION blend{AC_SRC_OVER,0,255,AC_SRC_ALPHA};
 stage="update-layered-corner";SetLastError(ERROR_SUCCESS);
 const bool ok=UpdateLayeredWindow(corner.window,nullptr,nullptr,&size,dc,&source,0,&blend,ULW_ALPHA)!=FALSE;
 const DWORD error=ok?0:GetLastError();SelectObject(dc,old);DeleteObject(bitmap);DeleteDC(dc);
 if(!ok){SetLastError(error);return false;}
 corner.width=width;corner.height=height;corner.cx=cx;corner.cy=cy;corner.radius=radius;corner.color=color;corner.gradient=gradient;corner.paintX=originX;corner.paintY=originY;corner.paintScale=scale;corner.painted=true;return true;
}
bool paintPaneTrim(PaneTrim& trim){
 if(trim.painting)return true;trim.painting=true;
 struct Reset {bool& value;~Reset(){value=false;}} reset{trim.painting};
 const auto failed=[&trim](const char* stage,DWORD error){trim.paintStage=stage;trim.paintError=error;SetLastError(error);return false;};
 const auto compositionFailed=[&trim](const char* stage,HRESULT hr){trim.paintStage=stage;trim.paintError=0;trim.paintHresult=hr;SetLastError(ERROR_SUCCESS);return false;};
 trim.paintStage="client-geometry";trim.paintError=0;trim.paintHresult=S_OK;
 RECT client{};const UINT dpi=GetDpiForWindow(trim.parent);
 if(dpi<96||dpi>768)return failed("invalid-dpi",ERROR_INVALID_WINDOW_HANDLE);
 if(!GetClientRect(trim.parent,&client))return failed("client-rect",GetLastError());
 bool compositionChanged=false;
 if(trim.composed){
  // Chromium's modern Windows parent has no redirection bitmap. Keep its
  // renderer flags intact and present these same tiny layered-window bitmaps
  // in an owned composition tree above the parent's children instead.
  if(!trim.device){
   HRESULT hr=DCompositionCreateDevice2(nullptr,__uuidof(IDCompositionDesktopDevice),reinterpret_cast<void**>(trim.device.GetAddressOf()));
   if(FAILED(hr))return compositionFailed("composition-create-device",hr);
   // A bound target at this exact HWND/layer causes failure. Never replace or
   // obtain another component's target, or change the parent's window styles.
   hr=trim.device->CreateTargetForHwnd(trim.parent,TRUE,trim.target.GetAddressOf());
   if(FAILED(hr))return compositionFailed("composition-create-target",hr);
   hr=trim.device->CreateVisual(trim.root.GetAddressOf());
   if(FAILED(hr))return compositionFailed("composition-create-root",hr);
   hr=trim.target->SetRoot(trim.root.Get());
   if(FAILED(hr))return compositionFailed("composition-set-root",hr);
   compositionChanged=true;
  }
  const int width=client.right-client.left,height=client.bottom-client.top;
  if(trim.clipWidth!=width||trim.clipHeight!=height){
   const D2D_RECT_F clip{0,0,static_cast<float>(width),static_cast<float>(height)};
   const HRESULT hr=trim.root->SetClip(clip);
   if(FAILED(hr))return compositionFailed("composition-clip-client",hr);
   trim.clipWidth=width;trim.clipHeight=height;compositionChanged=true;
  }
 }
 const double scale=dpi/96.0,radius=12*scale;size_t used=0;
 for(const auto& pane:trim.panes){
  if(pane.x+pane.width>(client.right-client.left)/scale+1||pane.y+pane.height>(client.bottom-client.top)/scale+1)continue;
  for(int side=0;side<2;side++){
   // Shared integer-DIP endpoints need no overpaint into neighbouring seams.
   const double left=(side?pane.x+pane.width-12:pane.x)*scale,top=(pane.y+pane.height-12)*scale;
   const int x=static_cast<int>(std::floor(left)),y=static_cast<int>(std::floor(top));
   const int width=static_cast<int>(std::ceil(left+12*scale))-x,height=static_cast<int>(std::ceil(top+12*scale))-y;
   const double cx=(side?pane.x+pane.width-12:pane.x+12)*scale-x,cy=(pane.y+pane.height-12)*scale-y;
   if(used==trim.corners.size())trim.corners.emplace_back();Corner& corner=trim.corners[used++];
   if(!corner.window){
    corner.window=CreateWindowExW(WS_EX_LAYERED|WS_EX_TRANSPARENT|WS_EX_NOACTIVATE|WS_EX_NOPARENTNOTIFY,kCornerClass,L"",WS_CHILD|WS_DISABLED|WS_CLIPSIBLINGS,
     x,y,width,height,trim.parent,nullptr,GetModuleHandleW(nullptr),&trim);
    if(!corner.window)return failed("create-corner",GetLastError());
   }
   if(!SetWindowPos(corner.window,HWND_TOP,x,y,width,height,SWP_NOACTIVATE|SWP_NOOWNERZORDER))return failed("position-corner",GetLastError());
   if(!corner.painted||corner.width!=width||corner.height!=height||corner.cx!=cx||corner.cy!=cy||corner.radius!=radius||corner.color!=pane.color||!mouse_corner_gradient::same(corner.gradient,pane.gradient)||(pane.gradient.active&&(corner.paintX!=x||corner.paintY!=y||corner.paintScale!=scale))){
    if(!drawCorner(corner,width,height,cx,cy,radius,pane.color,pane.gradient,x,y,scale,trim.paintStage))return failed(trim.paintStage,GetLastError());
    if(trim.composed)compositionChanged=true;
   }
   if(trim.composed&&!corner.cloaked){
    // Cloaking, unlike hiding or moving offscreen, retains the source bitmap
    // for CreateSurfaceFromHwnd while removing its ordinary HWND presentation.
    const BOOL cloak=TRUE;const HRESULT hr=DwmSetWindowAttribute(corner.window,DWMWA_CLOAK,&cloak,sizeof(cloak));
    if(FAILED(hr))return compositionFailed("composition-cloak-source",hr);
    corner.cloaked=true;
   }
   ShowWindow(corner.window,SW_SHOWNOACTIVATE);
   if(trim.composed){
    const bool newVisual=!corner.visual;HRESULT hr=S_OK;
    if(newVisual){
     hr=trim.device->CreateSurfaceFromHwnd(corner.window,corner.surface.GetAddressOf());
     if(FAILED(hr))return compositionFailed("composition-wrap-corner",hr);
     hr=trim.device->CreateVisual(corner.visual.GetAddressOf());
     if(FAILED(hr))return compositionFailed("composition-create-corner",hr);
     hr=corner.visual->SetContent(corner.surface.Get());
     if(FAILED(hr))return compositionFailed("composition-set-content",hr);
     hr=trim.root->AddVisual(corner.visual.Get(),TRUE,nullptr);
     if(FAILED(hr))return compositionFailed("composition-add-corner",hr);
     compositionChanged=true;
    }
    if(newVisual||corner.visualX!=x||corner.visualY!=y){
     hr=corner.visual->SetOffsetX(static_cast<float>(x));
     if(FAILED(hr))return compositionFailed("composition-position-x",hr);
     hr=corner.visual->SetOffsetY(static_cast<float>(y));
     if(FAILED(hr))return compositionFailed("composition-position-y",hr);
     corner.visualX=x;corner.visualY=y;compositionChanged=true;
    }
   }
  }
 }
 while(trim.corners.size()>used){
  auto& corner=trim.corners.back();
  if(corner.visual){const HRESULT hr=trim.root->RemoveVisual(corner.visual.Get());if(FAILED(hr))return compositionFailed("composition-remove-corner",hr);compositionChanged=true;}
  trim.destroy(corner);trim.corners.pop_back();
 }
 if(compositionChanged){const HRESULT hr=trim.device->Commit();if(FAILED(hr))return compositionFailed("composition-commit",hr);trim.commits++;}
 trim.paintStage="ready";
 return true;
}
LRESULT CALLBACK paneParentProc(HWND window,UINT message,WPARAM wparam,LPARAM lparam,UINT_PTR id,DWORD_PTR reference){
 if(message==WM_NCDESTROY){RemoveWindowSubclass(window,paneParentProc,id);delete reinterpret_cast<PaneTrim*>(reference);eraseTrace(window);return DefSubclassProc(window,message,wparam,lparam);}
 const LRESULT result=DefSubclassProc(window,message,wparam,lparam);
 if(message==WM_DPICHANGED||message==WM_SIZE){
  DWORD_PTR current=0;
  // The original window may have been destroyed recursively by its handler.
  if(GetWindowSubclass(window,paneParentProc,id,&current)&&current==reference){
   auto* trim=reinterpret_cast<PaneTrim*>(reference);
   if(!paintPaneTrim(*trim)){
    traceResult(window,trim->paintStage,trim->paintError,static_cast<uint32_t>(trim->panes.size()),0,trim->paintHresult);
    RemoveWindowSubclass(window,paneParentProc,id);delete trim;
   }
  }
 }
 return result;
}
void clearPaneTrim(HWND parent,PaneTrim* trim){
 if(!trim)return;RemoveWindowSubclass(parent,paneParentProc,kCornerSubclass);delete trim;
}
napi_value answer(napi_env env,int count){napi_value result;napi_create_int32(env,count,&result);return result;}
napi_value object(napi_env env){napi_value value;napi_create_object(env,&value);return value;}
void value(napi_env env,napi_value target,const char* key,napi_value item){napi_set_named_property(env,target,key,item);}
void number(napi_env env,napi_value target,const char* key,double item){napi_value result;napi_create_double(env,item,&result);value(env,target,key,result);}
void setBoolean(napi_env env,napi_value target,const char* key,bool item){napi_value result;napi_get_boolean(env,item,&result);value(env,target,key,result);}
void string(napi_env env,napi_value target,const char* key,const char* item){napi_value result;napi_create_string_utf8(env,item,NAPI_AUTO_LENGTH,&result);value(env,target,key,result);}
void hex(napi_env env,napi_value target,const char* key,uintptr_t item){char text[24]{};std::snprintf(text,sizeof(text),"0x%llx",static_cast<unsigned long long>(item));string(env,target,key,text);}
napi_value rectangle(napi_env env,const RECT& rect){napi_value result=object(env);number(env,result,"x",rect.left);number(env,result,"y",rect.top);number(env,result,"width",rect.right-rect.left);number(env,result,"height",rect.bottom-rect.top);return result;}
napi_value windowState(napi_env env,HWND window){
 napi_value result=object(env);hex(env,result,"handle",reinterpret_cast<uintptr_t>(window));setBoolean(env,result,"exists",IsWindow(window)!=FALSE);
 DWORD process=0;const DWORD thread=GetWindowThreadProcessId(window,&process);number(env,result,"pid",process);number(env,result,"threadId",thread);
 wchar_t name[128]{};const int length=GetClassNameW(window,name,128);napi_value className;napi_create_string_utf16(env,reinterpret_cast<const char16_t*>(name),length>0?static_cast<size_t>(length):0,&className);value(env,result,"className",className);
 hex(env,result,"style",static_cast<uint32_t>(GetWindowLongPtrW(window,GWL_STYLE)));hex(env,result,"exStyle",static_cast<uint32_t>(GetWindowLongPtrW(window,GWL_EXSTYLE)));
 setBoolean(env,result,"visible",IsWindowVisible(window)!=FALSE);setBoolean(env,result,"enabled",IsWindowEnabled(window)!=FALSE);setBoolean(env,result,"iconic",IsIconic(window)!=FALSE);
 hex(env,result,"parentHandle",reinterpret_cast<uintptr_t>(GetParent(window)));hex(env,result,"rootHandle",reinterpret_cast<uintptr_t>(GetAncestor(window,GA_ROOT)));
 RECT rect{};if(GetWindowRect(window,&rect))value(env,result,"rect",rectangle(env,rect));
 return result;
}
bool coordinate(napi_env env,napi_value value,const char* key,double& result){
 napi_value field;return napi_get_named_property(env,value,key,&field)==napi_ok&&napi_get_value_double(env,field,&result)==napi_ok&&std::isfinite(result);
}
bool paneValue(napi_env env,napi_value value,Pane& pane){
 napi_valuetype type;if(napi_typeof(env,value,&type)!=napi_ok||type!=napi_object||!coordinate(env,value,"x",pane.x)||!coordinate(env,value,"y",pane.y)||
  !coordinate(env,value,"width",pane.width)||!coordinate(env,value,"height",pane.height)||pane.x<0||pane.y<20||pane.width<24||pane.height<24)return false;
 napi_value color;size_t length=0;char hex[8]{};
 if(napi_get_named_property(env,value,"color",&color)!=napi_ok||napi_get_value_string_utf8(env,color,nullptr,0,&length)!=napi_ok||length!=7||
  napi_get_value_string_utf8(env,color,hex,sizeof(hex),&length)!=napi_ok||hex[0]!='#')return false;
 for(int i=1;i<7;i++)if(!std::isxdigit(static_cast<unsigned char>(hex[i])))return false;
 pane.color=static_cast<uint32_t>(std::strtoul(hex+1,nullptr,16));pane.gradient=mouse_corner_gradient::read(env,value);return true;
}
}

napi_value mousePaneCorners(napi_env env,napi_callback_info info){
 size_t count=2;napi_value args[2];napi_get_cb_info(env,info,&count,args,nullptr,nullptr);
 void* bytes=nullptr;size_t length=0;bool buffer=false,array=false;uint32_t items=0;
 if(count!=2||napi_is_buffer(env,args[0],&buffer)!=napi_ok||!buffer||napi_get_buffer_info(env,args[0],&bytes,&length)!=napi_ok||length!=sizeof(HWND))return answer(env,0);
 HWND parent=nullptr;std::memcpy(&parent,bytes,sizeof(parent));
 {auto& entry=trace(parent);entry.calls++;entry.reason="received";entry.error=0;entry.hresult=S_OK;entry.requested=0;entry.accepted=0;entry.result=0;}
 if(napi_is_array(env,args[1],&array)!=napi_ok||!array||napi_get_array_length(env,args[1],&items)!=napi_ok||items>100){traceResult(parent,"invalid-panes",0,0,0);return answer(env,0);}
 trace(parent).requested=items;
 if(!IsWindow(parent)){traceResult(parent,"invalid-window",0,0,0);return answer(env,0);}
 DWORD process=0;SetLastError(ERROR_SUCCESS);const DWORD thread=GetWindowThreadProcessId(parent,&process);const DWORD threadError=thread?0:GetLastError();
 // Do not paint or subclass foreign windows, other threads, or child HWNDs.
 if(!thread){traceResult(parent,"window-thread",threadError,0,0);return answer(env,0);}
 if(process!=GetCurrentProcessId()){traceResult(parent,"foreign-process",0,0,0);return answer(env,0);}
 if(thread!=GetCurrentThreadId()){traceResult(parent,"different-ui-thread",0,0,0);return answer(env,0);}
 if(GetAncestor(parent,GA_ROOT)!=parent){traceResult(parent,"not-top-level",0,0,0);return answer(env,0);}
 DWORD_PTR reference=0;GetWindowSubclass(parent,paneParentProc,kCornerSubclass,&reference);auto* trim=reinterpret_cast<PaneTrim*>(reference);
 std::vector<Pane> panes;panes.reserve(items);
 for(uint32_t i=0;i<items;i++){napi_value value;Pane pane{};if(napi_get_element(env,args[1],i,&value)==napi_ok&&paneValue(env,value,pane))panes.push_back(pane);}
 if(panes.empty()){clearPaneTrim(parent,trim);traceResult(parent,items?"no-valid-panes":"cleared",0,0,0);return answer(env,0);}
 if(!trim){
  if(!ensureCornerClass()){const DWORD error=GetLastError();traceResult(parent,"register-class",error,static_cast<uint32_t>(panes.size()),0);return answer(env,0);}trim=new PaneTrim(parent);
  SetLastError(ERROR_SUCCESS);
  if(!SetWindowSubclass(parent,paneParentProc,kCornerSubclass,reinterpret_cast<DWORD_PTR>(trim))){const DWORD error=GetLastError();delete trim;traceResult(parent,"subclass-parent",error,static_cast<uint32_t>(panes.size()),0);return answer(env,0);}
 }
 trim->panes=std::move(panes);
 if(!paintPaneTrim(*trim)){
  const DWORD error=trim->paintError;const HRESULT hr=trim->paintHresult;const char* stage=trim->paintStage;
  traceResult(parent,stage,error,static_cast<uint32_t>(trim->panes.size()),0,hr);clearPaneTrim(parent,trim);
  std::fprintf(stderr,"Mouse pane corner chrome failed (%s; Windows error %lu; HRESULT 0x%08lx)\n",stage,static_cast<unsigned long>(error),static_cast<unsigned long>(static_cast<uint32_t>(hr)));return answer(env,0);
 }
 traceResult(parent,"ready",0,static_cast<uint32_t>(trim->panes.size()),static_cast<int>(trim->corners.size()/2));
 return answer(env,static_cast<int>(trim->corners.size()/2));
}

// Diagnostic snapshot only: no painting, position changes, subclassing or HWND
// creation. Inspect only this process's top-level window on its owning thread.
napi_value mousePaneCornersState(napi_env env,napi_callback_info info){
 size_t count=1;napi_value args[1];napi_get_cb_info(env,info,&count,args,nullptr,nullptr);
 napi_value result=object(env),validation=object(env);value(env,result,"validation",validation);
 void* bytes=nullptr;size_t length=0;bool buffer=false;
 const bool validBuffer=count==1&&napi_is_buffer(env,args[0],&buffer)==napi_ok&&buffer&&napi_get_buffer_info(env,args[0],&bytes,&length)==napi_ok&&length==sizeof(HWND);
 setBoolean(env,validation,"buffer",validBuffer);
 if(!validBuffer){string(env,validation,"reason","invalid-handle-buffer");return result;}
 HWND parent=nullptr;std::memcpy(&parent,bytes,sizeof(parent));
 const bool exists=IsWindow(parent)!=FALSE;DWORD process=0;const DWORD thread=exists?GetWindowThreadProcessId(parent,&process):0;
 const bool owned=exists&&process==GetCurrentProcessId(),uiThread=owned&&thread==GetCurrentThreadId(),topLevel=exists&&GetAncestor(parent,GA_ROOT)==parent;
 setBoolean(env,validation,"window",exists);setBoolean(env,validation,"ownedProcess",owned);setBoolean(env,validation,"uiThread",uiThread);setBoolean(env,validation,"topLevel",topLevel);
 string(env,validation,"reason",!exists?"invalid-window":!owned?"foreign-process":!uiThread?"different-ui-thread":!topLevel?"not-top-level":"valid");
 napi_value last=object(env);string(env,last,"reason","not-called");value(env,result,"lastCall",last);
 for(const auto& entry:cornerTraces)if(entry.parent==parent){
  string(env,last,"reason",entry.reason.c_str());number(env,last,"win32Error",entry.error);hex(env,last,"hresult",static_cast<uint32_t>(entry.hresult));number(env,last,"requestedPanes",entry.requested);number(env,last,"acceptedPanes",entry.accepted);number(env,last,"result",entry.result);number(env,last,"calls",static_cast<double>(entry.calls));break;
 }
 if(!owned||!uiThread||!topLevel)return result;
 napi_value parentState=windowState(env,parent);value(env,result,"parent",parentState);number(env,parentState,"dpi",GetDpiForWindow(parent));
 RECT client{};if(GetClientRect(parent,&client))value(env,parentState,"clientRect",rectangle(env,client));
 POINT origin{0,0};if(ClientToScreen(parent,&origin)){napi_value point=object(env);number(env,point,"x",origin.x);number(env,point,"y",origin.y);value(env,parentState,"clientOrigin",point);}
 DWORD_PTR reference=0;GetWindowSubclass(parent,paneParentProc,kCornerSubclass,&reference);auto* trim=reinterpret_cast<PaneTrim*>(reference);
 napi_value trimState=object(env);value(env,result,"trim",trimState);setBoolean(env,trimState,"exists",trim!=nullptr);
 if(trim){
  setBoolean(env,trimState,"painting",trim->painting);string(env,trimState,"paintStage",trim->paintStage);number(env,trimState,"paintError",trim->paintError);hex(env,trimState,"paintHresult",static_cast<uint32_t>(trim->paintHresult));
  string(env,trimState,"renderingMode",trim->composed?"direct-composition":"layered-child");
  napi_value composition=object(env);value(env,trimState,"composition",composition);
  setBoolean(env,composition,"device",trim->device!=nullptr);setBoolean(env,composition,"target",trim->target!=nullptr);setBoolean(env,composition,"root",trim->root!=nullptr);number(env,composition,"commits",static_cast<double>(trim->commits));
  number(env,composition,"surfaceCount",static_cast<double>(std::count_if(trim->corners.begin(),trim->corners.end(),[](const Corner& corner){return corner.surface!=nullptr;})));
  number(env,composition,"visualCount",static_cast<double>(std::count_if(trim->corners.begin(),trim->corners.end(),[](const Corner& corner){return corner.visual!=nullptr;})));
  number(env,trimState,"paneCount",static_cast<double>(trim->panes.size()));number(env,trimState,"cornerCount",static_cast<double>(trim->corners.size()));
  number(env,trimState,"paintedCount",static_cast<double>(std::count_if(trim->corners.begin(),trim->corners.end(),[](const Corner& corner){return corner.painted;})));
  number(env,trimState,"visibleCount",static_cast<double>(std::count_if(trim->corners.begin(),trim->corners.end(),[](const Corner& corner){return IsWindowVisible(corner.window)!=FALSE;})));
  napi_value panes,corners;napi_create_array(env,&panes);napi_create_array(env,&corners);value(env,trimState,"panes",panes);value(env,trimState,"corners",corners);
  uint32_t i=0;for(const auto& pane:trim->panes){if(i==100)break;napi_value item=object(env);number(env,item,"x",pane.x);number(env,item,"y",pane.y);number(env,item,"width",pane.width);number(env,item,"height",pane.height);char color[8]{};std::snprintf(color,sizeof(color),"#%06x",pane.color);string(env,item,"color",color);napi_set_element(env,panes,i++,item);}
  i=0;for(const auto& corner:trim->corners){
   if(i==200)break;napi_value item=windowState(env,corner.window);setBoolean(env,item,"painted",corner.painted);
   number(env,item,"bitmapWidth",corner.width);number(env,item,"bitmapHeight",corner.height);number(env,item,"cx",corner.cx);number(env,item,"cy",corner.cy);number(env,item,"radius",corner.radius);
   setBoolean(env,item,"sourceCloaked",corner.cloaked);DWORD cloakState=0;const HRESULT cloakHr=DwmGetWindowAttribute(corner.window,DWMWA_CLOAKED,&cloakState,sizeof(cloakState));
   hex(env,item,"cloakHresult",static_cast<uint32_t>(cloakHr));if(SUCCEEDED(cloakHr))number(env,item,"cloakState",cloakState);
   setBoolean(env,item,"compositionSurface",corner.surface!=nullptr);setBoolean(env,item,"compositionVisual",corner.visual!=nullptr);
   if(corner.visual){number(env,item,"visualX",corner.visualX);number(env,item,"visualY",corner.visualY);}
   char color[8]{};std::snprintf(color,sizeof(color),"#%06x",corner.color);string(env,item,"color",color);napi_set_element(env,corners,i++,item);
  }
 }
 napi_value children;napi_create_array(env,&children);value(env,result,"children",children);uint32_t index=0;HWND child=GetWindow(parent,GW_CHILD);std::vector<HWND> seen;
 while(child&&index<256&&std::find(seen.begin(),seen.end(),child)==seen.end()){
  seen.push_back(child);napi_value item=windowState(env,child);number(env,item,"zOrder",index);setBoolean(env,item,"ownedCorner",trim&&GetWindowLongPtrW(child,GWLP_USERDATA)==reinterpret_cast<LONG_PTR>(trim));napi_set_element(env,children,index++,item);child=GetWindow(child,GW_HWNDNEXT);
 }
 setBoolean(env,result,"childrenTruncated",child!=nullptr);return result;
}
