package com.osminog.vision;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.speech.*;
import android.view.*;
import android.webkit.*;
import android.widget.FrameLayout;
import org.json.*;
import java.io.*;
import java.util.*;

/** Trusted local UI only. No remote AI website, hidden WebView or provider login. */
public class MainActivity extends Activity {
 static final String ORIGIN="https://appassets.androidplatform.net", HOME=ORIGIN+"/assets/index.html";
 final Handler handler=new Handler(Looper.getMainLooper());
 WebView shell; FrameLayout root; WebMessagePort port; Updater updater;
 boolean foreground=false, listening=false; float safeTop=0,safeBottom=0,safeLeft=0,safeRight=0;
 VoiceInput voiceInput; boolean voicePermissionPending=false,voiceResumePending=false; String voiceSession=""; PermissionRequest cameraPermission; ValueCallback<Uri[]> fileCallback;
 String speechLanguage="ru"; android.content.SharedPreferences prefs;
 int dp(float n){return Math.round(n*getResources().getDisplayMetrics().density);}
 @Override public void onCreate(Bundle saved){
  super.onCreate(saved);voiceInput=new VoiceInput(this::emit,VoiceInput.androidFactory(this),handler);prefs=getSharedPreferences("vision",MODE_PRIVATE);configureSystemBars();
  root=new FrameLayout(this);root.setBackgroundColor(0xff00396f);shell=new WebView(this);shell.setBackgroundColor(Color.TRANSPARENT);
  root.addView(shell,new FrameLayout.LayoutParams(-1,-1));setContentView(root);
  root.setOnApplyWindowInsetsListener((v,i)->{
   int top,left,right,bottom;
   if(Build.VERSION.SDK_INT>=30){android.graphics.Insets bars=i.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout());android.graphics.Insets ime=i.getInsets(WindowInsets.Type.ime());top=bars.top;left=bars.left;right=bars.right;bottom=Math.max(bars.bottom,ime.bottom);}else{top=i.getSystemWindowInsetTop();left=i.getSystemWindowInsetLeft();right=i.getSystemWindowInsetRight();bottom=i.getSystemWindowInsetBottom();}
   float density=getResources().getDisplayMetrics().density;safeLeft=left/density;safeRight=right/density;applyInsets(top/density,bottom/density);
   return i.consumeSystemWindowInsets();
  });
  WebSettings s=shell.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setUseWideViewPort(true);s.setLoadWithOverviewMode(false);s.setSupportZoom(false);s.setAllowFileAccess(false);s.setAllowContentAccess(true);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setGeolocationEnabled(false);s.setSupportMultipleWindows(false);s.setJavaScriptCanOpenWindowsAutomatically(false);s.setMediaPlaybackRequiresUserGesture(true);
  CookieManager.getInstance().setAcceptThirdPartyCookies(shell,false);
  shell.setWebViewClient(new WebViewClient(){
   @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){
    String path=r.getUrl().getPath();if(!trusted(r.getUrl().toString())||path==null||!(Arrays.asList("/assets/index.html","/assets/app.js","/assets/app.css","/assets/personal.css","/assets/ocean.js","/assets/media.js","/assets/fonts/InterVariable.woff2","/assets/ocean.css").contains(path)||path.matches("/assets/design/[A-Za-z0-9 _-]+\\.svg")))return blocked();
    try{String mime=path.endsWith(".woff2")?"font/woff2":path.endsWith(".js")?"text/javascript":path.endsWith(".css")?"text/css":path.endsWith(".svg")?"image/svg+xml":"text/html";Map<String,String> h=new HashMap<>();h.put("Content-Security-Policy","default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src blob:; font-src 'self'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'");h.put("Cache-Control","no-store");return new WebResourceResponse(mime,"UTF-8",200,"OK",h,getAssets().open(path.substring(8)));}catch(IOException e){return blocked();}
   }
   @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){return !HOME.equals(r.getUrl().toString());}
   @Override public void onPageFinished(WebView v,String url){if(!HOME.equals(url))return;applyInsets(safeTop,safeBottom);root.requestApplyInsets();if(port!=null)port.close();WebMessagePort[] c=v.createWebMessageChannel();port=c[0];port.setWebMessageCallback(new WebMessagePort.WebMessageCallback(){@Override public void onMessage(WebMessagePort p,WebMessage m){if(!HOME.equals(shell.getUrl())||m.getData()==null||m.getData().length()>20000)return;try{command(new JSONObject(m.getData()));}catch(Exception e){notice("Команда отклонена");}}},handler);String nonce=UUID.randomUUID().toString();v.evaluateJavascript("window.__osminogNativeNonce="+JSONObject.quote(nonce),ignored->{if(HOME.equals(v.getUrl()))v.postWebMessage(new WebMessage("OSMINOG:"+nonce,new WebMessagePort[]{c[1]}),Uri.parse(ORIGIN));});}
   @Override public void onReceivedSslError(WebView v,SslErrorHandler h,android.net.http.SslError e){h.cancel();notice("Ошибка сертификата. Соединение остановлено.");}
  });
  shell.setWebChromeClient(new WebChromeClient(){
   @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> cb,FileChooserParams p){if(!HOME.equals(view.getUrl())){cb.onReceiveValue(null);return true;}if(fileCallback!=null)fileCallback.onReceiveValue(null);fileCallback=cb;Intent in=new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*").putExtra(Intent.EXTRA_ALLOW_MULTIPLE,p.getMode()==FileChooserParams.MODE_OPEN_MULTIPLE).putExtra(Intent.EXTRA_MIME_TYPES,p.getAcceptTypes().length>0?p.getAcceptTypes():new String[]{"*/*"});try{startActivityForResult(in,50);}catch(Exception e){fileCallback.onReceiveValue(null);fileCallback=null;}return true;}
   @Override public void onPermissionRequest(PermissionRequest request){runOnUiThread(()->{if(!foreground||!trusted(request.getOrigin().toString())||!HOME.equals(shell.getUrl())||request.getResources().length!=1||!PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(request.getResources()[0])){request.deny();return;}if(checkSelfPermission(Manifest.permission.CAMERA)==PackageManager.PERMISSION_GRANTED){request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});return;}if(cameraPermission!=null)cameraPermission.deny();cameraPermission=request;requestPermissions(new String[]{Manifest.permission.CAMERA},60);});}
   @Override public void onPermissionRequestCanceled(PermissionRequest p){if(cameraPermission==p)cameraPermission=null;}
  });
  updater=new Updater(this);shell.loadUrl(HOME);
 }
 static boolean trusted(String value){try{Uri u=Uri.parse(value);return "https".equals(u.getScheme())&&"appassets.androidplatform.net".equals(u.getHost())&&u.getUserInfo()==null&&(u.getPort()==-1||u.getPort()==443);}catch(Exception e){return false;}}
 static WebResourceResponse blocked(){return new WebResourceResponse("text/plain","UTF-8",404,"Not found",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}
 void configureSystemBars(){Window w=getWindow();if(Build.VERSION.SDK_INT>=30)w.setDecorFitsSystemWindows(false);w.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);w.setStatusBarColor(Color.TRANSPARENT);w.setNavigationBarColor(Color.TRANSPARENT);if(Build.VERSION.SDK_INT>=29){w.setStatusBarContrastEnforced(false);w.setNavigationBarContrastEnforced(false);}}
 void applyInsets(float top,float bottom){safeTop=top;safeBottom=bottom;if(shell==null||isDestroyed())return;String js="if(document.documentElement){let s=document.documentElement.style;s.setProperty('--safe-top',"+JSONObject.quote(top+"px")+");s.setProperty('--safe-bottom',"+JSONObject.quote(bottom+"px")+");s.setProperty('--safe-left',"+JSONObject.quote(safeLeft+"px")+");s.setProperty('--safe-right',"+JSONObject.quote(safeRight+"px")+");}";shell.evaluateJavascript(js,null);}
 String version(){try{return getPackageManager().getPackageInfo(getPackageName(),0).versionName;}catch(Exception e){return "0.2.8";}}
 void command(JSONObject c){switch(c.optString("type")){
  case "ready":emit("init","version",version(),"brainReady",false,"oceanReady",false);applyInsets(safeTop,safeBottom);break;
  case "ask":emit("error","id",c.optString("id"),"message","Личная запись сохранена. Внутренний ИИ OSMINOG ещё не подключён к серверу.");break;
  case "openLink":try{Uri u=Uri.parse(c.optString("url"));if(("https".equals(u.getScheme())||"http".equals(u.getScheme()))&&u.getHost()!=null&&u.getUserInfo()==null)startActivity(new Intent(Intent.ACTION_VIEW,u).addCategory(Intent.CATEGORY_BROWSABLE));else notice("Некорректная ссылка");}catch(Exception e){notice("Не удалось открыть ссылку");}break;
  case "voice":speechLanguage=c.optString("language","ru");voiceSession=c.optString("session");startVoice();break;
  case "voiceSystem":if(foreground)voiceInput.chooseSystem(c.optString("session"));break;
  case "finishVoice":voiceInput.finish(c.optString("session"));break;
  case "stopVoice":stopVoice();break;
  case "checkUpdate":updater.check();break;
  case "downloadUpdate":updater.downloadAvailable();break;
  case "installSettings":updater.openInstallSettings();break;
  default:notice("Действие недоступно");
 }}
 void emit(String type,Object... values){try{JSONObject data=new JSONObject().put("type",type);for(int i=0;i+1<values.length;i+=2)data.put(String.valueOf(values[i]),values[i+1]);String js="window.OSMINOG?.receive("+data+")";runOnUiThread(()->{if(shell!=null&&!isDestroyed()&&HOME.equals(shell.getUrl()))shell.evaluateJavascript(js,null);});}catch(JSONException ignored){}}
 void notice(String message){emit("notice","message",message);}
 void startVoice(){
  if(!foreground)return;
  if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){if(!voicePermissionPending){voicePermissionPending=true;requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},61);}return;}
  voiceInput.start(voiceSession,speechLanguage);
 }
 void stopVoice(){voiceResumePending=false;if(voiceInput!=null)voiceInput.cancel();}
 @Override public void onRequestPermissionsResult(int code,String[] p,int[] grants){super.onRequestPermissionsResult(code,p,grants);boolean yes=grants.length>0&&grants[0]==PackageManager.PERMISSION_GRANTED;if(code==60&&cameraPermission!=null){PermissionRequest r=cameraPermission;cameraPermission=null;if(foreground&&yes)r.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});else r.deny();}if(code==61){voicePermissionPending=false;if(yes){voiceResumePending=true;if(foreground){voiceResumePending=false;startVoice();}}else{emit("voice","session",voiceSession,"on",false);notice("Микрофон не разрешён. Его можно включить в настройках приложения Android.");}}}
 @Override protected void onActivityResult(int r,int result,Intent data){super.onActivityResult(r,result,data);if(r==50&&fileCallback!=null){fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result,data));fileCallback=null;}}
 @Override public void onBackPressed(){if(shell==null){super.onBackPressed();return;}shell.evaluateJavascript("window.OSMINOG?.back()===true",value->{if(!"true".equals(value))MainActivity.super.onBackPressed();});}
 @Override protected void onResume(){super.onResume();foreground=true;configureSystemBars();if(shell!=null){shell.onResume();root.requestApplyInsets();emit("paused","value",false);}if(updater!=null)updater.resume();if(voiceResumePending){voiceResumePending=false;startVoice();}}
 @Override protected void onPause(){foreground=false;stopVoice();if(cameraPermission!=null){cameraPermission.deny();cameraPermission=null;}if(shell!=null){shell.evaluateJavascript("document.querySelectorAll('video,audio').forEach(v=>{v.pause();v.srcObject?.getTracks().forEach(t=>t.stop());v.srcObject=null;});window.OSMINOG?.receive({type:'paused',value:true})",null);shell.onPause();}super.onPause();}
 @Override protected void onDestroy(){stopVoice();if(fileCallback!=null)fileCallback.onReceiveValue(null);if(cameraPermission!=null)cameraPermission.deny();if(updater!=null)updater.close();if(port!=null)port.close();if(shell!=null){root.removeView(shell);shell.destroy();shell=null;}super.onDestroy();}
}
