#pragma once
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <vector>
#include "pane-corner-gradient.h"

namespace mouse_linux_corners {
struct Pane {double x,y,width,height;uint32_t color;mouse_corner_gradient::Gradient gradient{};};
struct Run {short x,y;unsigned short width,height;};
struct Shape {
 int x,y,width,height;double cx,cy,rx,ry;uint32_t color;std::vector<Run> runs;
};
// X11 Shape uses device-pixel regions. Sample each physical pixel at its
// centre; only the inverse lower quadrant is opaque. The 12-DIP circle and
// the guest viewport stay unchanged, including fractional display scales.
inline Shape corner(const Pane& pane,double sx,double sy,bool right){
 const double left=(right?pane.x+pane.width-12:pane.x)*sx;
 const double top=(pane.y+pane.height-12)*sy;
 const double end=(right?pane.x+pane.width:pane.x+12)*sx;
 Shape shape{static_cast<int>(std::floor(left)),static_cast<int>(std::floor(top)),0,0,0,0,12*sx,12*sy,pane.color,{}};
 shape.width=static_cast<int>(std::ceil(end))-shape.x;
 shape.height=static_cast<int>(std::ceil((pane.y+pane.height)*sy))-shape.y;
 shape.cx=(right?pane.x+pane.width-12:pane.x+12)*sx-shape.x;
 shape.cy=(pane.y+pane.height-12)*sy-shape.y;
 for(int y=0;y<shape.height;y++){
  int start=-1;
  for(int x=0;x<=shape.width;x++){
   const double dx=(x+.5-shape.cx)/shape.rx,dy=(y+.5-shape.cy)/shape.ry;
   const bool outside=x<shape.width&&dx*dx+dy*dy>=1;
   if(outside&&start<0)start=x;
   if(!outside&&start>=0){shape.runs.push_back({static_cast<short>(start),static_cast<short>(y),static_cast<unsigned short>(x-start),1});start=-1;}
  }
 }
 return shape;
}
inline bool same(const Pane& a,const Pane& b){return a.x==b.x&&a.y==b.y&&a.width==b.width&&a.height==b.height&&a.color==b.color&&mouse_corner_gradient::same(a.gradient,b.gradient);}
inline unsigned long channel(unsigned value,unsigned long mask){if(!mask)return 0;unsigned shift=0;while((mask&(1UL<<shift))==0)shift++;return ((static_cast<unsigned long>(value)*(mask>>shift)+127)/255<<shift)&mask;}
inline unsigned long pixel(uint32_t rgb,unsigned long red,unsigned long green,unsigned long blue,unsigned depth){
 const unsigned long bits=depth>=sizeof(unsigned long)*8?~0UL:(1UL<<depth)-1;
 // A composited ARGB32 parent may give its children the same visual. Keep
 // every non-RGB bit within the actual depth opaque; RGB24 has no alpha bits.
 return channel((rgb>>16)&255,red)|channel((rgb>>8)&255,green)|channel(rgb&255,blue)|(bits&~(red|green|blue));
}
}
