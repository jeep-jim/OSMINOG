// Small POSIX directory-capability layer for Mouse Local file tools.
// Every child lookup is one basename relative to an already held directory FD.
// No supplied path is ever followed through a symlink; rename stays on that FD.
#include <node_api.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
#include <dirent.h>
#include <cerrno>
#include <cstring>
#include <string>
#include <vector>
#ifdef __linux__
#include <X11/Xlib.h>
#endif

static napi_value fail(napi_env e,const char* message,int code=0){
 napi_value text,error,value;napi_create_string_utf8(e,message,NAPI_AUTO_LENGTH,&text);napi_create_error(e,nullptr,text,&error);
 if(code){napi_create_int32(e,code,&value);napi_set_named_property(e,error,"errno",value);}
 napi_throw(e,error);return nullptr;
}
static bool string(napi_env e,napi_value value,std::string& out){
 napi_valuetype type;napi_typeof(e,value,&type);if(type!=napi_string)return false;size_t n=0;napi_get_value_string_utf8(e,value,nullptr,0,&n);if(n>8192)return false;
 std::vector<char> buf(n+1);napi_get_value_string_utf8(e,value,buf.data(),buf.size(),&n);out.assign(buf.data(),n);return out.find('\0')==std::string::npos;
}
static bool name(napi_env e,napi_value value,std::string& out){return string(e,value,out)&&!out.empty()&&out!="."&&out!=".."&&out.find('/')==std::string::npos&&out.find('\\')==std::string::npos;}
static bool descriptor(napi_env e,napi_value value,int& fd){return napi_get_value_int32(e,value,&fd)==napi_ok&&fd>=0;}
static napi_value number(napi_env e,int n){napi_value v;napi_create_int32(e,n,&v);return v;}
static void prop(napi_env e,napi_value o,const char* key,const std::string& s){napi_value v;napi_create_string_utf8(e,s.c_str(),s.size(),&v);napi_set_named_property(e,o,key,v);}
static void numeric(napi_env e,napi_value o,const char* key,double n){napi_value v;napi_create_double(e,n,&v);napi_set_named_property(e,o,key,v);}
static long long mtime(const struct stat& s){
#ifdef __APPLE__
 return (long long)s.st_mtimespec.tv_sec*1000000000LL+s.st_mtimespec.tv_nsec;
#else
 return (long long)s.st_mtim.tv_sec*1000000000LL+s.st_mtim.tv_nsec;
#endif
}
static long long ctime(const struct stat& s){
#ifdef __APPLE__
 return (long long)s.st_ctimespec.tv_sec*1000000000LL+s.st_ctimespec.tv_nsec;
#else
 return (long long)s.st_ctim.tv_sec*1000000000LL+s.st_ctim.tv_nsec;
#endif
}
static napi_value statValue(napi_env e,const struct stat& s){
 napi_value result;napi_create_object(e,&result);prop(e,result,"type",S_ISREG(s.st_mode)?"file":S_ISDIR(s.st_mode)?"directory":S_ISLNK(s.st_mode)?"symlink":"special");
 prop(e,result,"dev",std::to_string(s.st_dev));prop(e,result,"ino",std::to_string(s.st_ino));prop(e,result,"mtimeNs",std::to_string(mtime(s)));prop(e,result,"ctimeNs",std::to_string(ctime(s)));
 numeric(e,result,"size",s.st_size);numeric(e,result,"nlink",s.st_nlink);numeric(e,result,"mode",s.st_mode);numeric(e,result,"modifiedAt",mtime(s)/1000000.0);return result;
}
static bool equalProperty(napi_env e,napi_value o,const char* key,const std::string& expected){napi_value v;std::string actual;return napi_get_named_property(e,o,key,&v)==napi_ok&&string(e,v,actual)&&actual==expected;}
static bool regular(const struct stat& s){return S_ISREG(s.st_mode)&&s.st_nlink==1;}
static napi_value openRoot(napi_env e,napi_callback_info info){
 size_t n=1;napi_value args[1];napi_get_cb_info(e,info,&n,args,nullptr,nullptr);std::string path;
 if(n!=1||!string(e,args[0],path)||path.empty()||path[0]!='/')return fail(e,"Invalid root directory");
 int fd=open(path.c_str(),O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);if(fd<0)return fail(e,"Cannot open project directory",errno);return number(e,fd);
}
static napi_value openDir(napi_env e,napi_callback_info info){
 size_t n=3;napi_value args[3];napi_get_cb_info(e,info,&n,args,nullptr,nullptr);int parent;std::string child;bool create=false;
 if(n<2||!descriptor(e,args[0],parent)||!name(e,args[1],child)||(n>2&&napi_get_value_bool(e,args[2],&create)!=napi_ok))return fail(e,"Invalid directory capability");
 int fd=openat(parent,child.c_str(),O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
 if(fd<0&&errno==ENOENT&&create){if(mkdirat(parent,child.c_str(),0700)<0&&errno!=EEXIST)return fail(e,"Cannot create project directory",errno);fd=openat(parent,child.c_str(),O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);}
 if(fd<0)return fail(e,"Project directory missing or symlink denied",errno);return number(e,fd);
}
static napi_value openRead(napi_env e,napi_callback_info info){
 size_t n=2;napi_value args[2];napi_get_cb_info(e,info,&n,args,nullptr,nullptr);int parent;std::string child;
 if(n!=2||!descriptor(e,args[0],parent)||!name(e,args[1],child))return fail(e,"Invalid file capability");
 int fd=openat(parent,child.c_str(),O_RDONLY|O_NOFOLLOW|O_NONBLOCK|O_CLOEXEC);if(fd<0)return fail(e,"File missing or symlink denied",errno);
 struct stat s;if(fstat(fd,&s)<0||!regular(s)){close(fd);return fail(e,"Only regular files without hardlinks are permitted");}return number(e,fd);
}
static napi_value openTemp(napi_env e,napi_callback_info info){
 size_t n=3;napi_value args[3];napi_get_cb_info(e,info,&n,args,nullptr,nullptr);int parent,mode;std::string child;
 if(n!=3||!descriptor(e,args[0],parent)||!name(e,args[1],child)||child.rfind(".mouse-local-",0)!=0||napi_get_value_int32(e,args[2],&mode)!=napi_ok)return fail(e,"Invalid temporary file capability");
 int fd=openat(parent,child.c_str(),O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,mode&0777);if(fd<0)return fail(e,"Cannot create temporary project file",errno);return number(e,fd);
}
static napi_value statAt(napi_env e,napi_callback_info info){
 size_t n=2;napi_value args[2];napi_get_cb_info(e,info,&n,args,nullptr,nullptr);int parent;std::string child;
 if(n!=2||!descriptor(e,args[0],parent)||!name(e,args[1],child))return fail(e,"Invalid file metadata capability");
 struct stat s;if(fstatat(parent,child.c_str(),&s,AT_SYMLINK_NOFOLLOW)<0){if(errno==ENOENT){napi_value v;napi_get_null(e,&v);return v;}return fail(e,"Cannot read project metadata",errno);}return statValue(e,s);
}
static napi_value list(napi_env e,napi_callback_info info){
 size_t n=2;napi_value args[2];napi_get_cb_info(e,info,&n,args,nullptr,nullptr);int fd,limit;
 if(n!=2||!descriptor(e,args[0],fd)||napi_get_value_int32(e,args[1],&limit)!=napi_ok||limit<1||limit>1001)return fail(e,"Invalid directory listing limit");
 int owned=openat(fd,".",O_RDONLY|O_DIRECTORY|O_CLOEXEC);if(owned<0)return fail(e,"Cannot duplicate directory capability",errno);DIR* dir=fdopendir(owned);if(!dir){close(owned);return fail(e,"Cannot list project directory",errno);}
 napi_value result,items,v;napi_create_object(e,&result);napi_create_array(e,&items);unsigned index=0;bool truncated=false;errno=0;
 while(struct dirent* entry=readdir(dir)){if(!strcmp(entry->d_name,".")||!strcmp(entry->d_name,".."))continue;if(index>=(unsigned)limit){truncated=true;break;}napi_create_string_utf8(e,entry->d_name,NAPI_AUTO_LENGTH,&v);napi_set_element(e,items,index++,v);}
 int error=errno;closedir(dir);if(error)return fail(e,"Project directory listing failed",error);napi_set_named_property(e,result,"names",items);napi_get_boolean(e,truncated,&v);napi_set_named_property(e,result,"truncated",v);return result;
}
static napi_value commit(napi_env e,napi_callback_info info){
 size_t n=4;napi_value args[4];napi_get_cb_info(e,info,&n,args,nullptr,nullptr);int parent;std::string temp,target;
 if(n!=4||!descriptor(e,args[0],parent)||!name(e,args[1],temp)||temp.rfind(".mouse-local-",0)!=0||!name(e,args[2],target))return fail(e,"Invalid commit capability");
 struct stat s,tmp;if(fstatat(parent,temp.c_str(),&tmp,AT_SYMLINK_NOFOLLOW)<0||!regular(tmp))return fail(e,"Temporary project file changed");
 napi_valuetype expectedType;napi_typeof(e,args[3],&expectedType);bool exists=fstatat(parent,target.c_str(),&s,AT_SYMLINK_NOFOLLOW)==0;
 if(!exists&&errno!=ENOENT)return fail(e,"Cannot check current project file",errno);
 if(expectedType==napi_null){if(exists)return fail(e,"File was created by another writer");}
 else if(!exists||!regular(s)||!equalProperty(e,args[3],"dev",std::to_string(s.st_dev))||!equalProperty(e,args[3],"ino",std::to_string(s.st_ino))||!equalProperty(e,args[3],"mtimeNs",std::to_string(mtime(s)))||!equalProperty(e,args[3],"ctimeNs",std::to_string(ctime(s))))return fail(e,"File changed after reading; not overwritten");
 if(expectedType==napi_null){
  // Exclusive creation is atomic even if another writer appears after the
  // metadata check. linkat never replaces an existing directory entry.
  if(linkat(parent,temp.c_str(),parent,target.c_str(),0)<0)return fail(e,"New file already exists or cannot be installed",errno);
  if(unlinkat(parent,temp.c_str(),0)<0)return fail(e,"File created but temporary cleanup failed",errno);
 }else if(renameat(parent,temp.c_str(),parent,target.c_str())<0)return fail(e,"Cannot commit project file",errno);
 napi_value result;napi_get_boolean(e,true,&result);return result;
}
static napi_value remove(napi_env e,napi_callback_info info){
 size_t n=2;napi_value args[2];napi_get_cb_info(e,info,&n,args,nullptr,nullptr);int parent;std::string child;
 if(n!=2||!descriptor(e,args[0],parent)||!name(e,args[1],child)||child.rfind(".mouse-local-",0)!=0)return fail(e,"Invalid temporary cleanup capability");
 if(unlinkat(parent,child.c_str(),0)<0&&errno!=ENOENT)return fail(e,"Cannot clean temporary project file",errno);napi_value v;napi_get_undefined(e,&v);return v;
}
#ifdef __linux__
// The image-drag IPC must still be backed by a held native button. X11 is
// queried at each gesture check; a missing display never grants the gesture.
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
#endif
static napi_value init(napi_env e,napi_value exports){
 const napi_property_descriptor props[]={
  {"openRoot",nullptr,openRoot,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"openDir",nullptr,openDir,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"openRead",nullptr,openRead,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"openTemp",nullptr,openTemp,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"stat",nullptr,statAt,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"list",nullptr,list,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"commit",nullptr,commit,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"remove",nullptr,remove,nullptr,nullptr,nullptr,napi_default,nullptr}
#ifdef __linux__
  ,{"primaryDown",nullptr,primaryDown,nullptr,nullptr,nullptr,napi_default,nullptr}
#endif
 };napi_define_properties(e,exports,sizeof(props)/sizeof(props[0]),props);return exports;
}
NAPI_MODULE(NODE_GYP_MODULE_NAME,init)
