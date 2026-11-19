// Windows counterpart of mcp-fs-native.cc. Every child name is a single
// component opened relative to a held directory HANDLE, never a reconstructed
// absolute path. Reparse points (including junctions) and hardlinks are denied.
// References: Microsoft NtCreateFile, FILE_RENAME_INFO and directory-handle APIs.
#include <node_api.h>
#include <uv.h>
#include <windows.h>
#include <winternl.h>
#include <cerrno>
#include <cstdint>
#include <cwchar>
#include <cwctype>
#include <cstring>
#include <string>
#include <vector>

napi_value mousePaneCorners(napi_env env,napi_callback_info info);

namespace {
constexpr ULONG kOpen=1,kCreate=2,kDirectory=1,kSynchronous=0x20,kNonDirectory=0x40,kReparse=0x200000;
constexpr DWORD kDirectoryShare=FILE_SHARE_READ|FILE_SHARE_WRITE|FILE_SHARE_DELETE;
constexpr DWORD kCommitSourceShare=FILE_SHARE_READ|FILE_SHARE_DELETE;
constexpr ACCESS_MASK kDirectoryAccess=FILE_LIST_DIRECTORY|FILE_TRAVERSE|FILE_READ_ATTRIBUTES|SYNCHRONIZE;
using NtCreate=NTSTATUS(NTAPI*)(PHANDLE,ACCESS_MASK,POBJECT_ATTRIBUTES,PIO_STATUS_BLOCK,PLARGE_INTEGER,ULONG,ULONG,ULONG,ULONG,PVOID,ULONG);
using NtSetInfo=NTSTATUS(NTAPI*)(HANDLE,PIO_STATUS_BLOCK,PVOID,ULONG,FILE_INFORMATION_CLASS);
using NtError=ULONG(NTAPI*)(NTSTATUS);
NtCreate ntCreate=nullptr;NtSetInfo ntSetInfo=nullptr;NtError ntError=nullptr;

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
void prop(napi_env env,napi_value object,const char* key,const std::string& value){napi_value text;napi_create_string_utf8(env,value.c_str(),value.size(),&text);napi_set_named_property(env,object,key,text);}
void numeric(napi_env env,napi_value object,const char* key,double value){napi_value num;napi_create_double(env,value,&num);napi_set_named_property(env,object,key,num);}
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
std::string fileId(const FileStat& stat){
 static constexpr char hex[]="0123456789abcdef";std::string result;result.reserve(32);
 for(unsigned char byte:stat.id.FileId.Identifier){result.push_back(hex[byte>>4]);result.push_back(hex[byte&15]);}return result;
}
std::string timeNs(LARGE_INTEGER time){const auto ticks=time.QuadPart-116444736000000000LL;return ticks?std::to_string(ticks)+"00":"0";}
napi_value statValue(napi_env env,const FileStat& stat){
 napi_value value;napi_create_object(env,&value);prop(env,value,"type",reparse(stat)?"symlink":stat.standard.Directory?"directory":stat.kind==FILE_TYPE_DISK?"file":"special");
 prop(env,value,"dev",std::to_string(stat.id.VolumeSerialNumber));prop(env,value,"ino",fileId(stat));prop(env,value,"mtimeNs",timeNs(stat.basic.LastWriteTime));prop(env,value,"ctimeNs",timeNs(stat.basic.ChangeTime));
 numeric(env,value,"size",static_cast<double>(stat.standard.EndOfFile.QuadPart));numeric(env,value,"nlink",stat.standard.NumberOfLinks);
 numeric(env,value,"mode",stat.standard.Directory?0040777:(stat.basic.FileAttributes&FILE_ATTRIBUTE_READONLY)?0100444:0100666);
 numeric(env,value,"modifiedAt",static_cast<double>(stat.basic.LastWriteTime.QuadPart-116444736000000000LL)/10000);return value;
}
bool equalProperty(napi_env env,napi_value object,const char* key,const std::string& expected){
 napi_value value;napi_valuetype type;size_t length=0;
 if(napi_get_named_property(env,object,key,&value)!=napi_ok||napi_typeof(env,value,&type)!=napi_ok||type!=napi_string||napi_get_value_string_utf8(env,value,nullptr,0,&length)!=napi_ok||length>100)return false;
 std::vector<char> data(length+1);return napi_get_value_string_utf8(env,value,data.data(),data.size(),&length)==napi_ok&&std::string(data.data(),length)==expected;
}
bool equalBytes(napi_env env,napi_value expected,HANDLE handle,const FileStat& current){
 napi_value snapshot;bool isBuffer=false;void* bytes=nullptr;size_t length=0;
 if(napi_get_named_property(env,expected,"expectedBytes",&snapshot)!=napi_ok||napi_is_buffer(env,snapshot,&isBuffer)!=napi_ok||!isBuffer||
  napi_get_buffer_info(env,snapshot,&bytes,&length)!=napi_ok||length>256*1024||current.standard.EndOfFile.QuadPart<0||
  static_cast<uint64_t>(current.standard.EndOfFile.QuadPart)!=length)return false;
 // The destination was opened synchronously with write sharing denied. Compare
 // bounded bytes, not just timestamps, which may coincide across rapid writes.
 unsigned char buffer[4096];size_t offset=0;
 while(offset<length){
  const DWORD request=static_cast<DWORD>((length-offset)<sizeof(buffer)?length-offset:sizeof(buffer));DWORD read=0;
  if(!ReadFile(handle,buffer,request,&read,nullptr)||!read||std::memcmp(static_cast<unsigned char*>(bytes)+offset,buffer,read))return false;
  offset+=read;
 }
 DWORD read=0;return ReadFile(handle,buffer,1,&read,nullptr)&&read==0;
}
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
bool missing(DWORD error){return error==ERROR_FILE_NOT_FOUND||error==ERROR_PATH_NOT_FOUND;}
bool tempName(const std::wstring& value){return value.rfind(L".mouse-local-",0)==0;}

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
napi_value openDir(napi_env env,napi_callback_info info){
 size_t count=3;napi_value args[3];napi_get_cb_info(env,info,&count,args,nullptr,nullptr);HANDLE parent;std::wstring child;bool create=false;
 if(count<2||!descriptor(env,args[0],parent)||!name(env,args[1],child))return fail(env,"Invalid project directory component");
 if(count>2&&napi_get_value_bool(env,args[2],&create)!=napi_ok)return fail(env,"Invalid directory creation flag");
 HANDLE raw=openChild(parent,child,kDirectoryAccess,kOpen,kReparse,kDirectoryShare);
 if(raw==INVALID_HANDLE_VALUE&&missing(GetLastError())&&create){
  // Exclusive directory creation cannot follow an existing link. Open existing
  // objects separately with OPEN_REPARSE_POINT and inspect the returned handle.
  raw=openChild(parent,child,kDirectoryAccess,kCreate,kDirectory,kDirectoryShare);
  if(raw==INVALID_HANDLE_VALUE&&(GetLastError()==ERROR_ALREADY_EXISTS||GetLastError()==ERROR_FILE_EXISTS))raw=openChild(parent,child,kDirectoryAccess,kOpen,kReparse,kDirectoryShare);
 }
 Handle handle(raw);if(raw==INVALID_HANDLE_VALUE)return fail(env,"Project directory missing or symlink denied",GetLastError());
 FileStat stat;if(!statHandle(raw,stat)||!directory(stat))return fail(env,"Project directory symlink denied",GetLastError());
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
napi_value openTemp(napi_env env,napi_callback_info info){
 size_t count=3;napi_value args[3];napi_get_cb_info(env,info,&count,args,nullptr,nullptr);HANDLE parent;std::wstring child;
 if(count<2||!descriptor(env,args[0],parent)||!name(env,args[1],child)||!tempName(child))return fail(env,"Invalid temporary file component");
 Handle handle(openChild(parent,child,FILE_WRITE_DATA|FILE_READ_ATTRIBUTES,kCreate,kReparse|kNonDirectory));
 if(handle.value==INVALID_HANDLE_VALUE)return fail(env,"Exclusive temporary file creation failed",GetLastError());
 return fdValue(env,handle);
}
napi_value stat(napi_env env,napi_callback_info info){
 size_t count=2;napi_value args[2];napi_get_cb_info(env,info,&count,args,nullptr,nullptr);HANDLE parent;std::wstring child;
 if(count!=2||!descriptor(env,args[0],parent)||!name(env,args[1],child))return fail(env,"Invalid project file component");
 Handle handle(openChild(parent,child,FILE_READ_ATTRIBUTES,kOpen,kReparse));
 if(handle.value==INVALID_HANDLE_VALUE){const DWORD error=GetLastError();if(missing(error)){napi_value result;napi_get_null(env,&result);return result;}return fail(env,"Project file inspection failed",error);}
 FileStat value;if(!statHandle(handle.value,value))return fail(env,"Project file information unavailable",GetLastError());return statValue(env,value);
}
napi_value list(napi_env env,napi_callback_info info){
 size_t count=2;napi_value args[2];napi_get_cb_info(env,info,&count,args,nullptr,nullptr);HANDLE parent;int32_t limit=0;
 if(count!=2||!descriptor(env,args[0],parent)||napi_get_value_int32(env,args[1],&limit)!=napi_ok||limit<1||limit>1001)return fail(env,"Invalid directory enumeration limit");
 FileStat check;if(!statHandle(parent,check)||!directory(check))return fail(env,"Directory symlink denied");
 napi_value result,names;napi_create_object(env,&result);napi_create_array(env,&names);uint32_t index=0;bool truncated=false,first=true,done=false;
 // Fixed, aligned 64 KiB buffer; stop before collecting/sorting unbounded names.
 std::vector<DWORDLONG> buffer(8192);
 while(!done){
  if(!GetFileInformationByHandleEx(parent,first?FileIdBothDirectoryRestartInfo:FileIdBothDirectoryInfo,buffer.data(),static_cast<DWORD>(buffer.size()*sizeof(DWORDLONG)))){
   const DWORD error=GetLastError();if(error==ERROR_NO_MORE_FILES)break;return fail(env,"Project directory enumeration failed",error);
  }
  first=false;auto* entry=reinterpret_cast<FILE_ID_BOTH_DIR_INFO*>(buffer.data());
  for(;;){
   const std::wstring child(entry->FileName,entry->FileNameLength/sizeof(wchar_t));
   if(child!=L"."&&child!=L".."){
    if(index>=static_cast<uint32_t>(limit)){truncated=true;done=true;break;}
    napi_value value;napi_create_string_utf16(env,reinterpret_cast<const char16_t*>(child.data()),child.size(),&value);napi_set_element(env,names,index++,value);
   }
   if(!entry->NextEntryOffset)break;entry=reinterpret_cast<FILE_ID_BOTH_DIR_INFO*>(reinterpret_cast<char*>(entry)+entry->NextEntryOffset);
  }
 }
 napi_set_named_property(env,result,"names",names);napi_set_named_property(env,result,"truncated",boolean(env,truncated));return result;
}
napi_value commit(napi_env env,napi_callback_info info){
 size_t count=4;napi_value args[4];napi_get_cb_info(env,info,&count,args,nullptr,nullptr);HANDLE parent;std::wstring temporary,target;
 if(count!=4||!descriptor(env,args[0],parent)||!name(env,args[1],temporary)||!tempName(temporary)||!name(env,args[2],target))return fail(env,"Invalid project commit arguments");
 Handle source(openChild(parent,temporary,DELETE|FILE_READ_ATTRIBUTES,kOpen,kReparse|kNonDirectory,kCommitSourceShare));
 FileStat temporaryStat;if(source.value==INVALID_HANDLE_VALUE||!statHandle(source.value,temporaryStat)||!regular(temporaryStat))return fail(env,"Unsafe temporary file denied",GetLastError());
 Handle destination(openChild(parent,target,FILE_READ_DATA|FILE_READ_ATTRIBUTES,kOpen,kReparse,kCommitSourceShare));const DWORD targetError=destination.value==INVALID_HANDLE_VALUE?GetLastError():0;
 if(destination.value==INVALID_HANDLE_VALUE&&!missing(targetError))return fail(env,"File changed after reading; not overwritten",targetError);
 napi_valuetype type;napi_typeof(env,args[3],&type);const bool expected=type!=napi_null;
 if(!expected){if(destination.value!=INVALID_HANDLE_VALUE)return fail(env,"File was created by another writer");}
 else{
  FileStat current;if(type!=napi_object||destination.value==INVALID_HANDLE_VALUE||!statHandle(destination.value,current)||!regular(current)||
   !equalProperty(env,args[3],"dev",std::to_string(current.id.VolumeSerialNumber))||!equalProperty(env,args[3],"ino",fileId(current))||
   !equalProperty(env,args[3],"mtimeNs",timeNs(current.basic.LastWriteTime))||!equalProperty(env,args[3],"ctimeNs",timeNs(current.basic.ChangeTime))||
   !equalBytes(env,args[3],destination.value,current))return fail(env,"File changed after reading; not overwritten");
 }
 // Both source and destination are in the held parent. FALSE publishes a new
 // file exclusively. Replacement retains the same documented precommit check
 // as macOS; it is not a compare-and-swap with every possible external editor.
 // Legacy FileRenameInformation refuses to replace an open destination even
 // when its handle permits delete sharing. Release only our metadata handle
 // after validation; the source and parent remain held for the relative rename.
 if(destination.value!=INVALID_HANDLE_VALUE)CloseHandle(destination.release());
 const size_t bytes=sizeof(FILE_RENAME_INFO)+target.size()*sizeof(wchar_t);std::vector<unsigned char> buffer(bytes);
 auto* rename=reinterpret_cast<FILE_RENAME_INFO*>(buffer.data());rename->ReplaceIfExists=expected?TRUE:FALSE;rename->RootDirectory=parent;rename->FileNameLength=static_cast<DWORD>(target.size()*sizeof(wchar_t));std::memcpy(rename->FileName,target.data(),rename->FileNameLength);
 // Use the native handle-relative contract directly. On the tested Windows
 // runner the Win32 FileRenameInfo wrapper returned ERROR_INVALID_PARAMETER
 // with this non-null RootDirectory; do not fall back to resolving a path.
 IO_STATUS_BLOCK io{};const NTSTATUS status=ntSetInfo(source.value,&io,rename,static_cast<ULONG>(bytes),static_cast<FILE_INFORMATION_CLASS>(10)); // FileRenameInformation
 if(status<0){const std::string message=std::string(expected?"Atomic project file replacement failed":"Exclusive project file publication failed")+" (NTSTATUS "+std::to_string(static_cast<uint32_t>(status))+")";return fail(env,message.c_str(),ntError(status));}
 return boolean(env,true);
}
napi_value remove(napi_env env,napi_callback_info info){
 size_t count=2;napi_value args[2];napi_get_cb_info(env,info,&count,args,nullptr,nullptr);HANDLE parent;std::wstring child;
 if(count!=2||!descriptor(env,args[0],parent)||!name(env,args[1],child)||!tempName(child))return fail(env,"Only temporary project files may be removed");
 Handle handle(openChild(parent,child,DELETE|FILE_READ_ATTRIBUTES,kOpen,kReparse|kNonDirectory));
 if(handle.value==INVALID_HANDLE_VALUE){if(missing(GetLastError()))return boolean(env,true);return fail(env,"Temporary file cleanup failed",GetLastError());}
 FILE_DISPOSITION_INFO disposition{};disposition.DeleteFile=TRUE;if(!SetFileInformationByHandle(handle.value,FileDispositionInfo,&disposition,sizeof(disposition)))return fail(env,"Temporary file cleanup failed",GetLastError());return boolean(env,true);
}

struct ProcessOwner {HANDLE job=nullptr;};
void finalizeOwner(napi_env,void* data,void*){auto* owner=static_cast<ProcessOwner*>(data);if(owner->job)CloseHandle(owner->job);delete owner;}
napi_value ownProcess(napi_env env,napi_callback_info info){
 size_t count=1;napi_value args[1];napi_get_cb_info(env,info,&count,args,nullptr,nullptr);uint32_t pid=0;
 if(count!=1||napi_get_value_uint32(env,args[0],&pid)!=napi_ok||pid<=1||pid==GetCurrentProcessId())return fail(env,"Invalid terminal process");
 Handle process(OpenProcess(PROCESS_SET_QUOTA|PROCESS_TERMINATE|PROCESS_QUERY_LIMITED_INFORMATION,FALSE,pid));
 if(!process.value)return fail(env,"Terminal process cannot be owned",GetLastError());
 DWORD exitCode=0;if(!GetExitCodeProcess(process.value,&exitCode)||exitCode!=STILL_ACTIVE)return fail(env,"Terminal process already exited");
 Handle job(CreateJobObjectW(nullptr,nullptr));if(!job.value)return fail(env,"Terminal job creation failed",GetLastError());
 JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits{};limits.BasicLimitInformation.LimitFlags=JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
 if(!SetInformationJobObject(job.value,JobObjectExtendedLimitInformation,&limits,sizeof(limits))||!AssignProcessToJobObject(job.value,process.value))return fail(env,"Terminal process tree could not be isolated",GetLastError());
 auto* owner=new ProcessOwner{job.release()};napi_value result;if(napi_create_external(env,owner,finalizeOwner,nullptr,&result)!=napi_ok){finalizeOwner(env,owner,nullptr);return fail(env,"Terminal owner allocation failed");}return result;
}
napi_value stopProcessTree(napi_env env,napi_callback_info info){
 size_t count=1;napi_value args[1];napi_get_cb_info(env,info,&count,args,nullptr,nullptr);void* data=nullptr;
 if(count!=1||napi_get_value_external(env,args[0],&data)!=napi_ok||!data)return fail(env,"Invalid terminal owner");
 auto* owner=static_cast<ProcessOwner*>(data);if(owner->job){TerminateJobObject(owner->job,1);CloseHandle(owner->job);owner->job=nullptr;}return boolean(env,true);
}
napi_value primaryDown(napi_env env,napi_callback_info){return boolean(env,(GetAsyncKeyState(VK_LBUTTON)&0x8000)!=0);}
}

napi_value init(napi_env env,napi_value exports){
 HMODULE ntdll=GetModuleHandleW(L"ntdll.dll");ntCreate=reinterpret_cast<NtCreate>(GetProcAddress(ntdll,"NtCreateFile"));ntSetInfo=reinterpret_cast<NtSetInfo>(GetProcAddress(ntdll,"NtSetInformationFile"));ntError=reinterpret_cast<NtError>(GetProcAddress(ntdll,"RtlNtStatusToDosError"));
 if(!ntCreate||!ntSetInfo||!ntError)return fail(env,"Required Windows filesystem APIs unavailable");
 napi_property_descriptor properties[]={
  {"openRoot",nullptr,openRoot,nullptr,nullptr,nullptr,napi_default,nullptr},{"openDir",nullptr,openDir,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"openRead",nullptr,openRead,nullptr,nullptr,nullptr,napi_default,nullptr},{"openTemp",nullptr,openTemp,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"stat",nullptr,stat,nullptr,nullptr,nullptr,napi_default,nullptr},{"list",nullptr,list,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"commit",nullptr,commit,nullptr,nullptr,nullptr,napi_default,nullptr},{"remove",nullptr,remove,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"ownProcess",nullptr,ownProcess,nullptr,nullptr,nullptr,napi_default,nullptr},{"stopProcessTree",nullptr,stopProcessTree,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"primaryDown",nullptr,primaryDown,nullptr,nullptr,nullptr,napi_default,nullptr},{"paneCorners",nullptr,mousePaneCorners,nullptr,nullptr,nullptr,napi_default,nullptr}
 };
 napi_define_properties(env,exports,sizeof(properties)/sizeof(properties[0]),properties);return exports;
}
NAPI_MODULE(NODE_GYP_MODULE_NAME,init)
