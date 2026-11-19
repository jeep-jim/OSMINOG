// A noninteractive updater must survive its originating Electron process.
// Use documented CreateProcessW directly: libuv assigns ordinary spawned
// children to its own Job, while DETACHED_PROCESS and conhost --headless do
// not provide a stable PowerShell startup/stdio contract across Windows.
#include <node_api.h>
#include <uv.h>
#include <windows.h>
#include <algorithm>
#include <climits>
#include <cmath>
#include <cstdint>
#include <cwctype>
#include <memory>
#include <string>
#include <utility>
#include <vector>

namespace {
constexpr napi_type_tag kHelperTag{0xb6fd73c174df4c1eULL,0x98d6b530e9b6d74aULL};
struct ScopedHandle {
 HANDLE value=INVALID_HANDLE_VALUE;
 explicit ScopedHandle(HANDLE handle=INVALID_HANDLE_VALUE):value(handle){}
 ~ScopedHandle(){if(value&&value!=INVALID_HANDLE_VALUE)CloseHandle(value);}
 ScopedHandle(const ScopedHandle&)=delete;ScopedHandle& operator=(const ScopedHandle&)=delete;
 HANDLE release(){const HANDLE handle=value;value=INVALID_HANDLE_VALUE;return handle;}
};
struct HelperProcess {
 HANDLE process=nullptr;DWORD pid=0;
 ~HelperProcess(){if(process)CloseHandle(process);}
};
struct AttributeList {
 std::vector<unsigned char> bytes;LPPROC_THREAD_ATTRIBUTE_LIST value=nullptr;
 ~AttributeList(){if(value)DeleteProcThreadAttributeList(value);}
 bool initialize(){
  SIZE_T size=0;InitializeProcThreadAttributeList(nullptr,1,0,&size);
  if(!size)return false;bytes.resize(size);
  auto* list=reinterpret_cast<LPPROC_THREAD_ATTRIBUTE_LIST>(bytes.data());
  if(!InitializeProcThreadAttributeList(list,1,0,&size))return false;value=list;return true;
 }
};
napi_value helperError(napi_env env,const char* message,DWORD code=0){
 const std::string detail=std::string(message)+(code?" (Windows error "+std::to_string(code)+")":"");
 napi_value text,error;napi_create_string_utf8(env,detail.c_str(),detail.size(),&text);napi_create_error(env,nullptr,text,&error);
 if(code){napi_value value;napi_create_uint32(env,code,&value);napi_set_named_property(env,error,"win32Error",value);}
 napi_throw(env,error);return nullptr;
}
bool wideString(napi_env env,napi_value value,std::wstring& result,size_t limit=32766){
 napi_valuetype type;size_t length=0;
 if(napi_typeof(env,value,&type)!=napi_ok||type!=napi_string||napi_get_value_string_utf16(env,value,nullptr,0,&length)!=napi_ok||length>limit)return false;
 std::vector<char16_t> buffer(length+1);
 if(napi_get_value_string_utf16(env,value,buffer.data(),buffer.size(),&length)!=napi_ok)return false;
 result.assign(reinterpret_cast<const wchar_t*>(buffer.data()),length);return result.find(L'\0')==std::wstring::npos;
}
bool encodedCommand(const std::wstring& encoded){
 if(encoded.empty()||encoded.size()%4)return false;size_t padding=0;
 for(wchar_t c:encoded){
  if(c==L'='){if(++padding>2)return false;}
  else if(padding||!((c>=L'A'&&c<=L'Z')||(c>=L'a'&&c<=L'z')||(c>=L'0'&&c<=L'9')||c==L'+'||c==L'/'))return false;
 }
 return true;
}
bool environmentBlock(napi_env env,napi_value input,std::vector<wchar_t>& block){
 bool array=false;uint32_t count=0;
 if(napi_is_array(env,input,&array)!=napi_ok||!array||napi_get_array_length(env,input,&count)!=napi_ok||count>4096)return false;
 struct Entry{std::wstring text;size_t keyLength;};std::vector<Entry> entries;entries.reserve(count);size_t total=1;
 for(uint32_t i=0;i<count;i++){
  napi_value value;std::wstring text;
  if(napi_get_element(env,input,i,&value)!=napi_ok||!wideString(env,value,text))return false;
  // Preserve Windows' optional =C:=... drive-current-directory entries too.
  const size_t keyLength=text.find(L'=',text.empty()||text[0]!=L'='?0:1);
  if(keyLength==std::wstring::npos||keyLength==0)return false;
  if(text[0]==L'='&&(keyLength!=3||!iswalpha(text[1])||text[2]!=L':'))return false;
  total+=text.size()+1;if(total>1024*1024)return false;entries.push_back({std::move(text),keyLength});
 }
 const auto compare=[](const Entry& a,const Entry& b){return CompareStringOrdinal(a.text.data(),static_cast<int>(a.keyLength),b.text.data(),static_cast<int>(b.keyLength),TRUE);};
 std::sort(entries.begin(),entries.end(),[&](const Entry& a,const Entry& b){return compare(a,b)==CSTR_LESS_THAN;});
 for(size_t i=1;i<entries.size();i++)if(compare(entries[i-1],entries[i])==CSTR_EQUAL)return false;
 block.reserve(total+1);for(const auto& entry:entries){block.insert(block.end(),entry.text.begin(),entry.text.end());block.push_back(L'\0');}
 block.push_back(L'\0');if(entries.empty())block.push_back(L'\0');return true;
}
bool logDescriptor(napi_env env,napi_value value,HANDLE& handle){
 double number=0;if(napi_get_value_double(env,value,&number)!=napi_ok||!std::isfinite(number)||number<0||number>INT_MAX||std::floor(number)!=number)return false;
 const int fd=static_cast<int>(number);uv_fs_t request{};
 const int status=uv_fs_fstat(nullptr,&request,fd,nullptr);uv_fs_req_cleanup(&request);if(status<0)return false;
 handle=uv_get_osfhandle(fd);if(!handle||handle==INVALID_HANDLE_VALUE||GetFileType(handle)!=FILE_TYPE_DISK)return false;
 FILE_STANDARD_INFO info{};return GetFileInformationByHandleEx(handle,FileStandardInfo,&info,sizeof(info))&&!info.Directory&&!info.DeletePending;
}
void finalizeHelper(napi_env,void* data,void*){delete static_cast<HelperProcess*>(data);}
HelperProcess* helperToken(napi_env env,napi_callback_info info){
 size_t count=1;napi_value args[1];void* data=nullptr;bool tagged=false;
 if(napi_get_cb_info(env,info,&count,args,nullptr,nullptr)!=napi_ok||count!=1||
  napi_check_object_type_tag(env,args[0],&kHelperTag,&tagged)!=napi_ok||!tagged||napi_unwrap(env,args[0],&data)!=napi_ok||!data){helperError(env,"Invalid Windows update helper handle");return nullptr;}
 return static_cast<HelperProcess*>(data);
}
napi_value flag(napi_env env,bool value){napi_value result;napi_get_boolean(env,value,&result);return result;}
}

// Arguments are data. Neither the application path nor PowerShell switches are
// caller-selectable; the encoded command is the application's fixed helper.
napi_value mouseLaunchUpdateHelper(napi_env env,napi_callback_info info){
 size_t count=5;napi_value args[5];napi_get_cb_info(env,info,&count,args,nullptr,nullptr);
 std::wstring encoded,cwd;std::vector<wchar_t> environment;HANDLE out=INVALID_HANDLE_VALUE,err=INVALID_HANDLE_VALUE;
 if(count!=5||!wideString(env,args[0],encoded,30000)||!encodedCommand(encoded)||!environmentBlock(env,args[1],environment)||
  !wideString(env,args[2],cwd)||cwd.empty()||!logDescriptor(env,args[3],out)||!logDescriptor(env,args[4],err))return helperError(env,"Invalid Windows update helper launch data");
 const bool drive=cwd.size()>=3&&iswalpha(cwd[0])&&cwd[1]==L':'&&(cwd[2]==L'\\'||cwd[2]==L'/');
 const bool unc=cwd.size()>4&&cwd.rfind(L"\\\\",0)==0&&cwd[2]!=L'.';
 if(!drive&&!unc)return helperError(env,"Absolute Windows update helper directory required");
 wchar_t directory[32768]{};const UINT length=GetSystemDirectoryW(directory,32768);
 if(!length||length>=32768)return helperError(env,"Windows system directory unavailable",length?ERROR_INSUFFICIENT_BUFFER:GetLastError());
 const std::wstring application=std::wstring(directory,length)+L"\\WindowsPowerShell\\v1.0\\powershell.exe";
 std::wstring command=L"\""+application+L"\" -NoLogo -NoProfile -NonInteractive -EncodedCommand "+encoded;
 if(command.size()>=32767)return helperError(env,"Windows update helper command exceeds the process limit");

 SECURITY_ATTRIBUTES security{sizeof(SECURITY_ATTRIBUTES),nullptr,TRUE};
 ScopedHandle input(CreateFileW(L"NUL",GENERIC_READ,FILE_SHARE_READ|FILE_SHARE_WRITE,&security,OPEN_EXISTING,FILE_ATTRIBUTE_NORMAL,nullptr));
 if(input.value==INVALID_HANDLE_VALUE)return helperError(env,"Windows update helper input could not be opened",GetLastError());
 ScopedHandle output,error;
 if(!DuplicateHandle(GetCurrentProcess(),out,GetCurrentProcess(),&output.value,0,TRUE,DUPLICATE_SAME_ACCESS)||
  !DuplicateHandle(GetCurrentProcess(),err,GetCurrentProcess(),&error.value,0,TRUE,DUPLICATE_SAME_ACCESS))return helperError(env,"Windows update helper logs could not be inherited",GetLastError());
 AttributeList attributes;if(!attributes.initialize())return helperError(env,"Windows update helper handle list could not be allocated",GetLastError());
 HANDLE inherited[]={input.value,output.value,error.value};
 if(!UpdateProcThreadAttribute(attributes.value,0,PROC_THREAD_ATTRIBUTE_HANDLE_LIST,inherited,sizeof(inherited),nullptr,nullptr))return helperError(env,"Windows update helper handle list could not be restricted",GetLastError());

 // Type-tag the token before a child exists. A different native external or an
 // invented JS object cannot be used to query/terminate an unrelated process.
 auto owned=std::make_unique<HelperProcess>();napi_value token,result;
 if(napi_create_object(env,&token)!=napi_ok||napi_type_tag_object(env,token,&kHelperTag)!=napi_ok||
  napi_create_object(env,&result)!=napi_ok||napi_set_named_property(env,result,"handle",token)!=napi_ok||
  napi_wrap(env,token,owned.get(),finalizeHelper,nullptr,nullptr)!=napi_ok)return helperError(env,"Windows update helper token could not be allocated");
 auto* helper=owned.release();
 STARTUPINFOEXW startup{};startup.StartupInfo.cb=sizeof(startup);startup.StartupInfo.dwFlags=STARTF_USESTDHANDLES;
 startup.StartupInfo.hStdInput=input.value;startup.StartupInfo.hStdOutput=output.value;startup.StartupInfo.hStdError=error.value;startup.lpAttributeList=attributes.value;
 PROCESS_INFORMATION process{};
 // No DETACHED_PROCESS, CREATE_NEW_CONSOLE or BREAKAWAY flag. Direct Win32
 // creation avoids libuv's extra child Job while preserving any enclosing OS
 // Job policy. Only the three duplicated standard handles are inherited.
 const DWORD flags=CREATE_NO_WINDOW|CREATE_UNICODE_ENVIRONMENT|EXTENDED_STARTUPINFO_PRESENT|CREATE_SUSPENDED;
 if(!CreateProcessW(application.c_str(),command.data(),nullptr,nullptr,TRUE,flags,environment.data(),cwd.c_str(),&startup.StartupInfo,&process))return helperError(env,"Windows update helper could not be started",GetLastError());
 ScopedHandle thread(process.hThread);helper->process=process.hProcess;helper->pid=process.dwProcessId;
 napi_value pid;
 if(napi_create_uint32(env,helper->pid,&pid)!=napi_ok||napi_set_named_property(env,result,"pid",pid)!=napi_ok){
  TerminateProcess(helper->process,1);WaitForSingleObject(helper->process,1000);CloseHandle(helper->process);helper->process=nullptr;
  return helperError(env,"Windows update helper PID could not be returned");
 }
 if(ResumeThread(thread.value)==static_cast<DWORD>(-1)){
  const DWORD code=GetLastError();TerminateProcess(helper->process,1);WaitForSingleObject(helper->process,1000);CloseHandle(helper->process);helper->process=nullptr;
  return helperError(env,"Windows update helper could not be resumed",code);
 }
 return result;
}

napi_value mouseUpdateHelperStatus(napi_env env,napi_callback_info info){
 auto* helper=helperToken(env,info);if(!helper)return nullptr;
 if(!helper->process)return helperError(env,"Windows update helper handle was released");
 const DWORD wait=WaitForSingleObject(helper->process,0);if(wait==WAIT_FAILED)return helperError(env,"Windows update helper status unavailable",GetLastError());
 const bool running=wait==WAIT_TIMEOUT;DWORD code=0;
 if(!running&&!GetExitCodeProcess(helper->process,&code))return helperError(env,"Windows update helper exit code unavailable",GetLastError());
 napi_value result,exit;napi_create_object(env,&result);napi_set_named_property(env,result,"running",flag(env,running));
 if(running)napi_get_null(env,&exit);else napi_create_uint32(env,code,&exit);napi_set_named_property(env,result,"exitCode",exit);return result;
}
napi_value mouseStopUpdateHelper(napi_env env,napi_callback_info info){
 auto* helper=helperToken(env,info);if(!helper)return nullptr;if(!helper->process)return flag(env,false);
 if(WaitForSingleObject(helper->process,0)==WAIT_OBJECT_0)return flag(env,false);
 if(!TerminateProcess(helper->process,1)){
  const DWORD code=GetLastError();if(WaitForSingleObject(helper->process,0)==WAIT_OBJECT_0)return flag(env,false);
  return helperError(env,"Windows update helper could not be cancelled",code);
 }
 return flag(env,true);
}
napi_value mouseReleaseUpdateHelper(napi_env env,napi_callback_info info){
 auto* helper=helperToken(env,info);if(!helper)return nullptr;if(!helper->process)return flag(env,false);
 const HANDLE process=helper->process;helper->process=nullptr;
 if(!CloseHandle(process))return helperError(env,"Windows update helper handle could not be released",GetLastError());return flag(env,true);
}
