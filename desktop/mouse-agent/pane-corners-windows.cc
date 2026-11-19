// Native, noninteractive pane chrome. WebContentsView's public radius rounds
// all four corners; ordinary View clipping does not clip its separate Aura
// surface. Paint only the two small bottom cutouts, preserving the guest's
// viewport, scroll position, DOM and input routing (the same model as macOS).
#include <node_api.h>
#include <windows.h>
#include <commctrl.h>
#include <algorithm>
#include <cmath>
#include <cctype>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <utility>
#include <vector>

namespace {
constexpr wchar_t kCornerClass[]=L"MouseBrowserPaneCorner629";
constexpr UINT_PTR kCornerSubclass=1;
struct Pane {double x,y,width,height;uint32_t color;};
struct Corner {
 HWND window=nullptr;int width=0,height=0;double cx=0,cy=0,radius=0;uint32_t color=0;bool painted=false;
};
struct PaneTrim {
 HWND parent;std::vector<Pane> panes;std::vector<Corner> corners;bool painting=false;
 explicit PaneTrim(HWND handle):parent(handle){}
 void destroy(Corner& corner){
  if(corner.window&&GetWindowLongPtrW(corner.window,GWLP_USERDATA)==reinterpret_cast<LONG_PTR>(this))DestroyWindow(corner.window);
  corner.window=nullptr;
 }
 ~PaneTrim(){for(auto& corner:corners)destroy(corner);}
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
 if(GetClassInfoW(module,kCornerClass,&cls))return cls.lpfnWndProc==cornerWindowProc;
 cls.lpfnWndProc=cornerWindowProc;cls.hInstance=module;cls.lpszClassName=kCornerClass;
 return RegisterClassW(&cls)!=0;
}
bool drawCorner(Corner& corner,int width,int height,double cx,double cy,double radius,uint32_t color){
 // A top-down, premultiplied BGRA DIB. Supersampling only the tiny 13-DIP
 // cutouts makes the native arc smooth at fractional display scales.
 BITMAPINFO info{};info.bmiHeader.biSize=sizeof(BITMAPINFOHEADER);info.bmiHeader.biWidth=width;info.bmiHeader.biHeight=-height;
 info.bmiHeader.biPlanes=1;info.bmiHeader.biBitCount=32;info.bmiHeader.biCompression=BI_RGB;
 void* raw=nullptr;HDC dc=CreateCompatibleDC(nullptr);if(!dc)return false;
 HBITMAP bitmap=CreateDIBSection(dc,&info,DIB_RGB_COLORS,&raw,nullptr,0);
 if(!bitmap||!raw){if(bitmap)DeleteObject(bitmap);DeleteDC(dc);return false;}
 HGDIOBJ old=SelectObject(dc,bitmap);auto* pixels=static_cast<uint32_t*>(raw);
 const unsigned red=(color>>16)&255,green=(color>>8)&255,blue=color&255;const double square=radius*radius;
 for(int y=0;y<height;y++)for(int x=0;x<width;x++){
  unsigned outside=0;
  for(int sy=0;sy<4;sy++)for(int sx=0;sx<4;sx++){
   const double dx=x+(sx+0.5)/4-cx,dy=y+(sy+0.5)/4-cy;
   if(dx*dx+dy*dy>=square)outside++;
  }
  const unsigned alpha=(outside*255+8)/16;
  pixels[y*width+x]=(alpha<<24)|(((red*alpha+127)/255)<<16)|(((green*alpha+127)/255)<<8)|((blue*alpha+127)/255);
 }
 SIZE size{width,height};POINT source{0,0};BLENDFUNCTION blend{AC_SRC_OVER,0,255,AC_SRC_ALPHA};
 const bool ok=UpdateLayeredWindow(corner.window,nullptr,nullptr,&size,dc,&source,0,&blend,ULW_ALPHA)!=FALSE;
 const DWORD error=ok?0:GetLastError();SelectObject(dc,old);DeleteObject(bitmap);DeleteDC(dc);
 if(!ok){SetLastError(error);return false;}
 corner.width=width;corner.height=height;corner.cx=cx;corner.cy=cy;corner.radius=radius;corner.color=color;corner.painted=true;return true;
}
bool paintPaneTrim(PaneTrim& trim){
 if(trim.painting)return true;trim.painting=true;
 struct Reset {bool& value;~Reset(){value=false;}} reset{trim.painting};
 RECT client{};const UINT dpi=GetDpiForWindow(trim.parent);
 if(dpi<96||dpi>768||!GetClientRect(trim.parent,&client)){SetLastError(ERROR_INVALID_WINDOW_HANDLE);return false;}
 const double scale=dpi/96.0,radius=12*scale;size_t used=0;
 for(const auto& pane:trim.panes){
  if(pane.x+pane.width>(client.right-client.left)/scale+1||pane.y+pane.height>(client.bottom-client.top)/scale+1)continue;
  for(int side=0;side<2;side++){
   // Match the Mac trim's one-DIP overpaint outside the arc: this covers a
   // fractional DOM/native endpoint rim without altering the 12-DIP circle.
   const double left=(side?pane.x+pane.width-12:pane.x-1)*scale,top=(pane.y+pane.height-12)*scale;
   const int x=static_cast<int>(std::floor(left)),y=static_cast<int>(std::floor(top));
   const int width=static_cast<int>(std::ceil(left+13*scale))-x,height=static_cast<int>(std::ceil(top+13*scale))-y;
   const double cx=(side?pane.x+pane.width-12:pane.x+12)*scale-x,cy=(pane.y+pane.height-12)*scale-y;
   if(used==trim.corners.size())trim.corners.emplace_back();Corner& corner=trim.corners[used++];
   if(!corner.window){
    corner.window=CreateWindowExW(WS_EX_LAYERED|WS_EX_TRANSPARENT|WS_EX_NOACTIVATE|WS_EX_NOPARENTNOTIFY,kCornerClass,L"",WS_CHILD|WS_DISABLED|WS_CLIPSIBLINGS,
     x,y,width,height,trim.parent,nullptr,GetModuleHandleW(nullptr),&trim);
    if(!corner.window)return false;
   }
   if(!SetWindowPos(corner.window,HWND_TOP,x,y,width,height,SWP_NOACTIVATE|SWP_NOOWNERZORDER))return false;
   if(!corner.painted||corner.width!=width||corner.height!=height||corner.cx!=cx||corner.cy!=cy||corner.radius!=radius||corner.color!=pane.color)
    if(!drawCorner(corner,width,height,cx,cy,radius,pane.color))return false;
   ShowWindow(corner.window,SW_SHOWNOACTIVATE);
  }
 }
 while(trim.corners.size()>used){trim.destroy(trim.corners.back());trim.corners.pop_back();}
 return true;
}
LRESULT CALLBACK paneParentProc(HWND window,UINT message,WPARAM wparam,LPARAM lparam,UINT_PTR id,DWORD_PTR reference){
 if(message==WM_NCDESTROY){RemoveWindowSubclass(window,paneParentProc,id);delete reinterpret_cast<PaneTrim*>(reference);return DefSubclassProc(window,message,wparam,lparam);}
 const LRESULT result=DefSubclassProc(window,message,wparam,lparam);
 if(message==WM_DPICHANGED||message==WM_SIZE){
  DWORD_PTR current=0;
  // The original window may have been destroyed recursively by its handler.
  if(GetWindowSubclass(window,paneParentProc,id,&current)&&current==reference){
   auto* trim=reinterpret_cast<PaneTrim*>(reference);
   if(!paintPaneTrim(*trim)){for(auto& corner:trim->corners)ShowWindow(corner.window,SW_HIDE);}
  }
 }
 return result;
}
void clearPaneTrim(HWND parent,PaneTrim* trim){
 if(!trim)return;RemoveWindowSubclass(parent,paneParentProc,kCornerSubclass);delete trim;
}
napi_value answer(napi_env env,int count){napi_value result;napi_create_int32(env,count,&result);return result;}
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
 pane.color=static_cast<uint32_t>(std::strtoul(hex+1,nullptr,16));return true;
}
}

napi_value mousePaneCorners(napi_env env,napi_callback_info info){
 size_t count=2;napi_value args[2];napi_get_cb_info(env,info,&count,args,nullptr,nullptr);
 void* bytes=nullptr;size_t length=0;bool buffer=false,array=false;uint32_t items=0;
 if(count!=2||napi_is_buffer(env,args[0],&buffer)!=napi_ok||!buffer||napi_get_buffer_info(env,args[0],&bytes,&length)!=napi_ok||length!=sizeof(HWND)||
  napi_is_array(env,args[1],&array)!=napi_ok||!array||napi_get_array_length(env,args[1],&items)!=napi_ok||items>100)return answer(env,0);
 HWND parent=nullptr;std::memcpy(&parent,bytes,sizeof(parent));DWORD process=0;const DWORD thread=GetWindowThreadProcessId(parent,&process);
 // Do not paint or subclass foreign windows, other threads, or child HWNDs.
 if(!IsWindow(parent)||process!=GetCurrentProcessId()||thread!=GetCurrentThreadId()||GetAncestor(parent,GA_ROOT)!=parent)return answer(env,0);
 DWORD_PTR reference=0;GetWindowSubclass(parent,paneParentProc,kCornerSubclass,&reference);auto* trim=reinterpret_cast<PaneTrim*>(reference);
 std::vector<Pane> panes;panes.reserve(items);
 for(uint32_t i=0;i<items;i++){napi_value value;Pane pane{};if(napi_get_element(env,args[1],i,&value)==napi_ok&&paneValue(env,value,pane))panes.push_back(pane);}
 if(panes.empty()){clearPaneTrim(parent,trim);return answer(env,0);}
 if(!trim){
  if(!ensureCornerClass())return answer(env,0);trim=new PaneTrim(parent);
  if(!SetWindowSubclass(parent,paneParentProc,kCornerSubclass,reinterpret_cast<DWORD_PTR>(trim))){delete trim;return answer(env,0);}
 }
 trim->panes=std::move(panes);
 if(!paintPaneTrim(*trim)){const DWORD error=GetLastError();clearPaneTrim(parent,trim);std::fprintf(stderr,"Mouse pane corner chrome failed (Windows error %lu)\n",static_cast<unsigned long>(error));return answer(env,0);}
 return answer(env,static_cast<int>(trim->corners.size()/2));
}
