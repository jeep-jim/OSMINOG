package com.osminog.vision;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Outline;
import android.net.Uri;
import android.os.*;
import android.speech.*;
import android.view.*;
import android.webkit.*;
import android.widget.FrameLayout;
import org.json.*;
import java.io.*;
import java.util.*;

/** Local private shell. No provider WebView, DOM automation, login or embedded API key.
 * A future authenticated OSMINOG gateway must replace ServiceUnavailable, not bypass it.
 */
public class MainActivity extends Activity {
 static final String ORIGIN="https://appassets.androidplatform.net", HOME=ORIGIN+"/assets/index.html";
 final Handler handler=new Handler(Looper.getMainLooper());
 WebView shell; FrameLayout root; TextureView preview; EyeCamera eye; Updater updater;
 WebMessagePort port; SpeechRecognizer recognizer; ValueCallback<Uri[]> fileCallback;
 boolean foreground=false,camera=false,front=false,listening=false; int permissionAction=0;
 float safeTop=0,safeBottom=0,safeLeft=0,safeRight=0,keyboard=0;
 int dp(float x){return Math.round(x*getResources().getDisplayMetrics().density);}
 @Override public void onCreate(Bundle saved){
  super.onCreate(saved);configureSystemBars();
  root=new FrameLayout(this);root.setBackgroundColor(0xff00396f);
  root.setOnApplyWindowInsetsListener((v,insets)->{
   int top,bottom,left,right,ime=0;
   if(Build.VERSION.SDK_INT>=30){android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout());android.graphics.Insets k=insets.getInsets(WindowInsets.Type.ime());top=bars.top;bottom=bars.bottom;left=bars.left;right=bars.right;ime=k.bottom;}
   else{top=insets.getSystemWindowInsetTop();bottom=insets.getSystemWindowInsetBottom();left=insets.getSystemWindowInsetLeft();right=insets.getSystemWindowInsetRight();}
   float density=getResources().getDisplayMetrics().density;safeTop=top/density;safeBottom=bottom/density;safeLeft=left/density;safeRight=right/density;keyboard=ime/density;applyInsets(safeTop,safeBottom);
   if(Build.VERSION.SDK_INT>=30){int mask=WindowInsets.Type.systemBars()|WindowInsets.Type.ime()|WindowInsets.Type.displayCutout()|WindowInsets.Type.systemGestures()|WindowInsets.Type.mandatorySystemGestures()|WindowInsets.Type.tappableElement();return new WindowInsets.Builder(insets).setInsets(mask,android.graphics.Insets.NONE).build().consumeSystemWindowInsets().consumeStableInsets();}
   return insets.consumeSystemWindowInsets();
  });
  shell=new WebView(this);shell.setBackgroundColor(Color.TRANSPARENT);shell.setFitsSystemWindows(false);
  WebSettings settings=shell.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(true);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setGeolocationEnabled(false);settings.setSupportMultipleWindows(false);settings.setJavaScriptCanOpenWindowsAutomatically(false);settings.setMediaPlaybackRequiresUserGesture(true);settings.setSupportZoom(false);settings.setUseWideViewPort(true);settings.setLoadWithOverviewMode(false);
  CookieManager.getInstance().setAcceptThirdPartyCookies(shell,false);
  shell.setWebViewClient(new WebViewClient(){
   @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
    Uri u=request.getUrl();String path=u.getPath();
    if(!ORIGIN.equals(u.getScheme()+"://"+u.getAuthority())||path==null||!(Arrays.asList("/assets/index.html","/assets/app.js","/assets/app.css","/assets/intent.css","/assets/ambience.js").contains(path)||path.matches("/assets/design/[A-Za-z0-9 _-]+\\.svg")))return missing();
    try{String mime=path.endsWith(".js")?"text/javascript":path.endsWith(".css")?"text/css":path.endsWith(".svg")?"image/svg+xml":"text/html";Map<String,String> headers=new HashMap<>();headers.put("Content-Security-Policy","default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'");headers.put("Cache-Control","no-store");return new WebResourceResponse(mime,"UTF-8",200,"OK",headers,getAssets().open(path.substring(8)));}catch(IOException error){return missing();}
   }
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return !HOME.equals(request.getUrl().toString());}
   @Override public void onPageFinished(WebView view,String url){if(!HOME.equals(url))return;applyInsets(safeTop,safeBottom);if(port!=null)port.close();WebMessagePort[] channel=view.createWebMessageChannel();port=channel[0];port.setWebMessageCallback(new WebMessagePort.WebMessageCallback(){@Override public void onMessage(WebMessagePort p,WebMessage message){String raw=message.getData();if(!HOME.equals(shell.getUrl())||raw==null||raw.length()>20000)return;try{command(new JSONObject(raw));}catch(Exception error){notice("Команда отклонена");}}},handler);String nonce=UUID.randomUUID().toString();view.evaluateJavascript("window.__osminogNativeNonce="+JSONObject.quote(nonce),unused->{if(HOME.equals(view.getUrl()))view.postWebMessage(new WebMessage("OSMINOG:"+nonce,new WebMessagePort[]{channel[1]}),Uri.parse(ORIGIN));});}
   @Override public void onReceivedSslError(WebView view,SslErrorHandler h,android.net.http.SslError error){h.cancel();notice("Ошибка сертификата. Соединение остановлено.");}
  });
  shell.setWebChromeClient(new WebChromeClient(){
   @Override public void onPermissionRequest(PermissionRequest request){request.deny();}
   @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams parameters){if(!HOME.equals(view.getUrl())){callback.onReceiveValue(null);return true;}if(fileCallback!=null)fileCallback.onReceiveValue(null);fileCallback=callback;Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*").putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"image/jpeg","image/png","text/plain","application/pdf"});try{startActivityForResult(intent,50);}catch(Exception error){callback.onReceiveValue(null);fileCallback=null;}return true;}
  });
  root.addView(shell,new FrameLayout.LayoutParams(-1,-1));
  preview=new TextureView(this);preview.setVisibility(View.GONE);preview.setClipToOutline(true);preview.setOutlineProvider(new ViewOutlineProvider(){public void getOutline(View view,Outline outline){outline.setRoundRect(0,0,view.getWidth(),view.getHeight(),dp(24));}});root.addView(preview,new FrameLayout.LayoutParams(1,1));
  eye=new EyeCamera(this,preview,new EyeCamera.Listener(){public void ready(){camera=true;emit("camera","on",true);}public void error(String message){camera=false;preview.setVisibility(View.GONE);emit("camera","on",false);notice(message);}});
  updater=new Updater(this);setContentView(root);root.requestApplyInsets();shell.loadUrl(HOME);
 }
 static WebResourceResponse missing(){return new WebResourceResponse("text/plain","UTF-8",404,"Not found",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}
 void configureSystemBars(){Window w=getWindow();if(Build.VERSION.SDK_INT>=30)w.setDecorFitsSystemWindows(false);w.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);w.setStatusBarColor(Color.TRANSPARENT);w.setNavigationBarColor(Color.TRANSPARENT);if(Build.VERSION.SDK_INT>=28)w.setNavigationBarDividerColor(Color.TRANSPARENT);if(Build.VERSION.SDK_INT>=29){w.setStatusBarContrastEnforced(false);w.setNavigationBarContrastEnforced(false);}}
 void applyInsets(float top,float bottom){safeTop=top;safeBottom=bottom;if(shell==null||isDestroyed())return;String js="if(document.documentElement){const s=document.documentElement.style;s.setProperty('--safe-top',"+JSONObject.quote(top+"px")+");s.setProperty('--safe-bottom',"+JSONObject.quote(bottom+"px")+");s.setProperty('--safe-left',"+JSONObject.quote(safeLeft+"px")+");s.setProperty('--safe-right',"+JSONObject.quote(safeRight+"px")+");s.setProperty('--keyboard',"+JSONObject.quote(keyboard+"px")+");}";shell.evaluateJavascript(js,null);}
 String version(){try{return getPackageManager().getPackageInfo(getPackageName(),0).versionName;}catch(Exception error){return "0.2.6";}}
 void emit(String type,Object... values){try{JSONObject obj=new JSONObject().put("type",type);for(int i=0;i+1<values.length;i+=2)obj.put(String.valueOf(values[i]),values[i+1]);String js="window.OSMINOG?.receive("+obj+")";runOnUiThread(()->{if(shell!=null&&!isDestroyed()&&HOME.equals(shell.getUrl()))shell.evaluateJavascript(js,null);});}catch(JSONException ignored){}}
 void notice(String message){emit("notice","message",message);}
 void command(JSONObject event){String type=event.optString("type");switch(type){
  case "ready":emit("ready","version",version());applyInsets(safeTop,safeBottom);break;
  case "state":emit("camera","on",camera);break;
  case "ask":case "publish":
   String id=event.optString("id"),text=event.optString("text");int revision=event.optInt("revision",0);
   if(!id.matches("[a-zA-Z0-9_-]{1,80}")||text.trim().isEmpty()||text.length()>4000||revision<0){notice("Некорректное сообщение");return;}
   // Unavailable until the owner's authenticated gateway is actually deployed.
   emit("delivery","action",type,"id",id,"revision",revision,"ok",false,"code","service_not_configured");break;
  case "camera":if(camera)stopCamera();else if(foreground){if(checkSelfPermission(Manifest.permission.CAMERA)==PackageManager.PERMISSION_GRANTED)startCamera();else{permissionAction=1;requestPermissions(new String[]{Manifest.permission.CAMERA},60);}}break;
  case "cameraLayout":layoutCamera(event);break;
  case "capture":if(camera)eye.frame((data,error)->{if(error!=null)notice(error);else emit("frame","data",data);});break;
  case "voice":if(listening)stopVoice();else if(foreground){if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED)startVoice();else{permissionAction=2;requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},60);}}break;
  case "pauseMedia":stopCamera();stopVoice();break;
  case "checkUpdate":updater.check();break;
  case "downloadUpdate":updater.downloadAvailable();break;
  case "installSettings":updater.openInstallSettings();break;
  default:break;
 }}
 void startCamera(){if(!foreground)return;preview.setVisibility(View.VISIBLE);eye.start(front);}
 void stopCamera(){if(eye!=null)eye.close();camera=false;if(preview!=null)preview.setVisibility(View.GONE);emit("camera","on",false);}
 void layoutCamera(JSONObject e){if(preview==null)return;double x=e.optDouble("x",0),y=e.optDouble("y",0),w=e.optDouble("w",0),h=e.optDouble("h",0);if(!Double.isFinite(x)||!Double.isFinite(y)||!Double.isFinite(w)||!Double.isFinite(h)||x<0||y<0||w<1||h<1||w>2000||h>2000)return;FrameLayout.LayoutParams p=new FrameLayout.LayoutParams(dp((float)w),dp((float)h));p.leftMargin=dp((float)x);p.topMargin=dp((float)y);preview.setLayoutParams(p);preview.setVisibility(camera&&foreground&&e.optBoolean("visible")?View.VISIBLE:View.GONE);}
 void startVoice(){if(!SpeechRecognizer.isRecognitionAvailable(this)){notice("Речевой ввод недоступен на устройстве.");return;}stopVoice();recognizer=SpeechRecognizer.createSpeechRecognizer(this);recognizer.setRecognitionListener(new RecognitionListener(){public void onReadyForSpeech(Bundle b){listening=true;emit("listening","on",true);}public void onBeginningOfSpeech(){}public void onRmsChanged(float f){}public void onBufferReceived(byte[] b){}public void onEndOfSpeech(){listening=false;emit("listening","on",false);}public void onError(int error){listening=false;emit("listening","on",false);notice("Речь не распознана. Можно повторить или набрать текст.");}public void onResults(Bundle b){listening=false;emit("listening","on",false);ArrayList<String> results=b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);if(foreground&&results!=null&&!results.isEmpty())emit("voiceText","text",results.get(0));}public void onPartialResults(Bundle b){}public void onEvent(int type,Bundle b){}});Intent intent=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM).putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS,false);recognizer.startListening(intent);}
 void stopVoice(){if(recognizer!=null){recognizer.cancel();recognizer.destroy();recognizer=null;}listening=false;emit("listening","on",false);}
 @Override public void onRequestPermissionsResult(int code,String[] permissions,int[] grants){super.onRequestPermissionsResult(code,permissions,grants);int action=permissionAction;permissionAction=0;if(code==60&&foreground&&grants.length>0&&grants[0]==PackageManager.PERMISSION_GRANTED){if(action==1)startCamera();else if(action==2)startVoice();}}
 @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==50&&fileCallback!=null){fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result,data));fileCallback=null;}}
 @Override protected void onResume(){super.onResume();foreground=true;configureSystemBars();if(shell!=null){shell.onResume();emit("paused","on",false);root.requestApplyInsets();}if(updater!=null)updater.resume();}
 @Override protected void onPause(){foreground=false;permissionAction=0;stopCamera();stopVoice();emit("paused","on",true);if(shell!=null)shell.onPause();super.onPause();}
 @Override public void onBackPressed(){if(shell!=null)shell.evaluateJavascript("(()=>{const d=document.querySelector('dialog[open]');if(d){d.close();return true;}if(document.body.classList.contains('menu-open')){document.getElementById('closeMenu').click();return true;}return false;})()",value->{if(!"true".equals(value))MainActivity.super.onBackPressed();});else super.onBackPressed();}
 @Override protected void onDestroy(){if(updater!=null)updater.close();if(port!=null)port.close();if(fileCallback!=null)fileCallback.onReceiveValue(null);if(eye!=null)eye.close();if(recognizer!=null)recognizer.destroy();handler.removeCallbacksAndMessages(null);if(shell!=null){root.removeView(shell);shell.destroy();shell=null;}super.onDestroy();}
}
