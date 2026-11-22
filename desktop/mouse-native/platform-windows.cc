// Browser native input, pane corners, updater and safe archive reads.
// Archive child names are opened relative to a held directory HANDLE.
// Reparse points (including junctions) and hardlinks remain denied.
#include <node_api.h>
#include <uv.h>
#include <windows.h>
#include <winternl.h>
#include <cstdint>
#include <cwchar>
#include <cwctype>
#include <string>
#include <vector>

napi_value mousePaneCorners(napi_env env,napi_callback_info info);
napi_value mousePaneCornersState(napi_env env,napi_callback_info info);
napi_value mouseLaunchUpdateHelper(napi_env env,napi_callback_info info);
napi_value mouseUpdateHelperStatus(napi_env env,napi_callback_info info);
napi_value mouseStopUpdateHelper(napi_env env,napi_callback_info info);
napi_value mouseReleaseUpdateHelper(napi_env env,napi_callback_info info);

namespace {
constexpr ULONG kOpen=1,kSynchronous=0x20,kNonDirectory=0x40,kReparse=0x200000;
constexpr DWORD kDirectoryShare=FILE_SHARE_READ|FILE_SHARE_WRITE|FILE_SHARE_DELETE;
constexpr ACCESS_MASK kDirectoryAccess=FILE_LIST_DIRECTORY|FILE_TRAVERSE|FILE_READ_ATTRIBUTES|SYNCHRONIZE;
using NtCreate=NTSTATUS(NTAPI*)(PHANDLE,ACCESS_MASK,POBJECT_ATTRIBUTES,PIO_STATUS_BLOCK,PLARGE_INTEGER,ULONG,ULONG,ULONG,ULONG,PVOID,ULONG);
using NtError=ULONG(NTAPI*)(NTSTATUS);
NtCreate ntCreate=nullptr;NtError ntError=nullptr;

struct Handle {
 HANDLE value=INVALID_HANDLE_VALUE;
 explicit Handle(HANDLE handle=INVALID_HANDLE_VALUE):value(handle){}
 ~Handle(){if(value!=INVALID_HANDLE_VALUE&&value!=nullptr)CloseHandle(value);}
 Handle(const Handle&)=delete;Handle& operator=(const Handle&)=delete;
 HANDLE release(){const HANDLE handle=value;value=INVALID_HANDLE_VALUE;return handle;}
};
napi_value fail(napi_env env,const char* message,DWORD code=0){
 const std::string detail=std::string(message)+(code?" (Windows error "+std::to_string(code)+")":"");
 napi_value msg,error;napi_create_string_utf8(env,detail.c_str(),detail.size(),&msg);napi_create_error(env,nullptr,msg,&error);
 if(code){napi_value value;napi_create_uint32(env,code,&value);napi_set_named_property(env,error,"win32Error",value);}
 napi_throw(env,error);return nullptr;
}
bool string(napi_env env,napi_value value,std::wstring& out){
 napi_valuetype type;if(napi_typeof(env,value,&type)!=napi_ok||type!=napi_string)return false;
 size_t length=0;if(napi_get_value_string_utf16(env,value,nullptr,0,&length)!=napi_ok||length>8192)return false;
 std::vector<char16_t> data(length+1);if(napi_get_value_string_utf16(env,value,data.data(),data.size(),&length)!=napi_ok)return false;
 out.assign(reinterpret_cast<const wchar_t*>(data.data()),length);return out.find(L'\0')==std::wstring::npos;
}
bool name(napi_env env,napi_value value,std::wstring& out){
 if(!string(env,value,out)||out.empty()||out.size()>255||out==L"."||out==L".."||out.back()==L'.'||out.back()==L' ')return false;
 for(wchar_t c:out)if(c<32||c==127||wcschr(L"<>:\"/\\|?*",c))return false;
 std::wstring stem=out.substr(0,out.find(L'.'));for(auto& c:stem)c=static_cast<wchar_t>(towupper(c));
 if(stem==L"CON"||stem==L"PRN"||stem==L"AUX"||stem==L"NUL"||stem==L"CLOCK$")return false;
 if(stem.size()==4&&(stem.compare(0,3,L"COM")==0||stem.compare(0,3,L"LPT")==0)&&((stem[3]>=L'1'&&stem[3]<=L'9')||stem[3]==L'\u00b9'||stem[3]==L'\u00b2'||stem[3]==L'\u00b3'))return false;
 return true;
}
bool descriptor(napi_env env,napi_value value,HANDLE& handle){
 int32_t fd=-1;if(napi_get_value_int32(env,value,&fd)!=napi_ok||fd<0)return false;
 uv_fs_t request{};const int result=uv_fs_fstat(nullptr,&request,fd,nullptr);uv_fs_req_cleanup(&request);if(result<0)return false;
 handle=uv_get_osfhandle(fd);return handle!=INVALID_HANDLE_VALUE&&handle!=nullptr;
}
napi_value number(napi_env env,int value){napi_value result;napi_create_int32(env,value,&result);return result;}
napi_value boolean(napi_env env,bool value){napi_value result;napi_get_boolean(env,value,&result);return result;}
napi_value fdValue(napi_env env,Handle& handle){
 // Use the host's CRT table through libuv. A separately linked addon's CRT
 // descriptors are not necessarily meaningful to Node fs or Electron.
 const int fd=uv_open_osfhandle(handle.value);
 if(fd<0)return fail(env,"Could not create a Node file descriptor",GetLastError());handle.release();return number(env,fd);
}
struct FileStat {FILE_BASIC_INFO basic{};FILE_STANDARD_INFO standard{};FILE_ID_INFO id{};DWORD kind=FILE_TYPE_UNKNOWN;};
bool statHandle(HANDLE handle,FileStat& stat){
 stat.kind=GetFileType(handle);if(stat.kind!=FILE_TYPE_DISK){SetLastError(ERROR_ACCESS_DENIED);return false;}
 return GetFileInformationByHandleEx(handle,FileBasicInfo,&stat.basic,sizeof(stat.basic))&&
  GetFileInformationByHandleEx(handle,FileStandardInfo,&stat.standard,sizeof(stat.standard))&&
  GetFileInformationByHandleEx(handle,FileIdInfo,&stat.id,sizeof(stat.id));
}
bool reparse(const FileStat& stat){return(stat.basic.FileAttributes&FILE_ATTRIBUTE_REPARSE_POINT)!=0;}
bool directory(const FileStat& stat){return stat.standard.Directory&&!reparse(stat);}
bool regular(const FileStat& stat){return!stat.standard.Directory&&!reparse(stat)&&stat.standard.NumberOfLinks==1&&!stat.standard.DeletePending;}
HANDLE openChild(HANDLE parent,const std::wstring& child,ACCESS_MASK access,ULONG disposition,ULONG options,DWORD share=FILE_SHARE_READ|FILE_SHARE_WRITE|FILE_SHARE_DELETE){
 // Other editors must remain able to rename/create inside the directory.
 // Confinement comes from the held directory object and one-component relative
 // opens, not Windows sharing locks. Never reuse a mutated reparse capability.
 FileStat parentStat;if(!statHandle(parent,parentStat)||!directory(parentStat)){SetLastError(ERROR_ACCESS_DENIED);return INVALID_HANDLE_VALUE;}
 UNICODE_STRING string{};string.Buffer=const_cast<wchar_t*>(child.data());string.Length=static_cast<USHORT>(child.size()*sizeof(wchar_t));string.MaximumLength=string.Length;
 OBJECT_ATTRIBUTES attributes{};attributes.Length=sizeof(attributes);attributes.RootDirectory=parent;attributes.ObjectName=&string;attributes.Attributes=0x40; // OBJ_CASE_INSENSITIVE
 IO_STATUS_BLOCK io{};HANDLE handle=INVALID_HANDLE_VALUE;
 const NTSTATUS status=ntCreate(&handle,access|SYNCHRONIZE,&attributes,&io,nullptr,FILE_ATTRIBUTE_NORMAL,share,disposition,options|kSynchronous,nullptr,0);
 if(status<0){SetLastError(ntError(status));return INVALID_HANDLE_VALUE;}return handle;
}
napi_value openRoot(napi_env env,napi_callback_info info){
 size_t count=1;napi_value args[1];napi_get_cb_info(env,info,&count,args,nullptr,nullptr);std::wstring root;
 if(count!=1||!string(env,args[0],root))return fail(env,"Absolute Windows project root required");
 if(root.rfind(L"\\\\?\\UNC\\",0)==0)root=L"\\\\"+root.substr(8);
 else if(root.rfind(L"\\\\?\\",0)==0)root=root.substr(4);
 const bool drive=root.size()>=3&&iswalpha(root[0])&&root[1]==L':'&&(root[2]==L'\\'||root[2]==L'/');
 const bool unc=root.size()>4&&root.rfind(L"\\\\",0)==0&&root[2]!=L'.'&&root[2]!=L'?';
 if(!drive&&!unc)return fail(env,"Absolute Windows project root required");
 if(drive)root=L"\\\\?\\"+root;else root=L"\\\\?\\UNC\\"+root.substr(2);
 Handle handle(CreateFileW(root.c_str(),kDirectoryAccess,kDirectoryShare,nullptr,OPEN_EXISTING,FILE_FLAG_BACKUP_SEMANTICS|FILE_FLAG_OPEN_REPARSE_POINT,nullptr));
 if(handle.value==INVALID_HANDLE_VALUE)return fail(env,"Project root cannot be opened",GetLastError());
 FileStat stat;if(!statHandle(handle.value,stat)||!directory(stat))return fail(env,"Project root symlink or non-directory denied",GetLastError());
 return fdValue(env,handle);
}
napi_value openRead(napi_env env,napi_callback_info info){
 size_t count=2;napi_value args[2];napi_get_cb_info(env,info,&count,args,nullptr,nullptr);HANDLE parent;std::wstring child;
 if(count!=2||!descriptor(env,args[0],parent)||!name(env,args[1],child))return fail(env,"Invalid project file component");
 Handle handle(openChild(parent,child,FILE_READ_DATA|FILE_READ_ATTRIBUTES,kOpen,kReparse|kNonDirectory));
 if(handle.value==INVALID_HANDLE_VALUE)return fail(env,"Project file cannot be read",GetLastError());
 FileStat stat;if(!statHandle(handle.value,stat)||!regular(stat))return fail(env,"Only ordinary files without symlinks or hardlinks can be read");
 return fdValue(env,handle);
}
napi_value primaryDown(napi_env env,napi_callback_info){return boolean(env,(GetAsyncKeyState(VK_LBUTTON)&0x8000)!=0);}
}

napi_value init(napi_env env,napi_value exports){
 HMODULE ntdll=GetModuleHandleW(L"ntdll.dll");ntCreate=reinterpret_cast<NtCreate>(GetProcAddress(ntdll,"NtCreateFile"));ntError=reinterpret_cast<NtError>(GetProcAddress(ntdll,"RtlNtStatusToDosError"));
 if(!ntCreate||!ntError)return fail(env,"Required Windows filesystem APIs unavailable");
 napi_property_descriptor properties[]={
  {"openRoot",nullptr,openRoot,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"openRead",nullptr,openRead,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"primaryDown",nullptr,primaryDown,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"paneCorners",nullptr,mousePaneCorners,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"paneCornersState",nullptr,mousePaneCornersState,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"launchUpdateHelper",nullptr,mouseLaunchUpdateHelper,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"updateHelperStatus",nullptr,mouseUpdateHelperStatus,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"stopUpdateHelper",nullptr,mouseStopUpdateHelper,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"releaseUpdateHelper",nullptr,mouseReleaseUpdateHelper,nullptr,nullptr,nullptr,napi_default,nullptr}
 };
 napi_define_properties(env,exports,sizeof(properties)/sizeof(properties[0]),properties);return exports;
}
NAPI_MODULE(NODE_GYP_MODULE_NAME,init)
