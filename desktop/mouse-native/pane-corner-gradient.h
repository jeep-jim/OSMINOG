#ifndef MOUSE_PANE_CORNER_GRADIENT_H
#define MOUSE_PANE_CORNER_GRADIENT_H
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <initializer_list>
namespace mouse_corner_gradient {
// Window coordinates in device-independent pixels, opaque sRGB endpoints.
// No native layer interprets CSS or executes renderer-provided code.
struct Gradient {bool active=false;double x0=0,y0=0,x1=0,y1=0;uint32_t start=0,end=0;};
inline bool same(const Gradient& a,const Gradient& b){return a.active==b.active&&(!a.active||(a.x0==b.x0&&a.y0==b.y0&&a.x1==b.x1&&a.y1==b.y1&&a.start==b.start&&a.end==b.end));}
inline uint32_t sample(const Gradient& g,double x,double y,uint32_t fallback){
 if(!g.active)return fallback;
 const double dx=g.x1-g.x0,dy=g.y1-g.y0,denominator=dx*dx+dy*dy;
 if(!std::isfinite(denominator)||denominator<1)return fallback;
 const double t=std::max(0.,std::min(1.,((x-g.x0)*dx+(y-g.y0)*dy)/denominator));uint32_t out=0;
 for(int shift:{16,8,0}){const double first=(g.start>>shift)&255,last=(g.end>>shift)&255;out|=static_cast<uint32_t>(std::round(first+(last-first)*t))<<shift;}return out;
}
}
#endif
