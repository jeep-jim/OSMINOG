package com.osminog.vision;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.view.*;
import android.webkit.*;
import android.widget.FrameLayout;
import java.io.*;
import java.util.*;
import org.json.*;

/** Packaged shared UI, same-origin owned API, no third-party AI WebViews.
 * Old appassets history remains untouched and is never uploaded or published.
 */
public final class MainActivity extends Activity {
 static final String ORIGIN="https://osminog.red", HOME=ORIGIN+"/";
 static final Set<String> STATIC=new HashSet<>(Arrays.asList("index.html","ocean.js","ocean.css","manifest.webmanifest","sw.js","icon-192.png","icon-512.png"));
 WebView shell; FrameLayout root; WebMessagePort port; Updater updater;
 ValueCallback<Uri[]> fileCallback; PermissionRequest cameraRequest;
 boolean foreground=false;
 static boolean owned(String value){try{Uri u=Uri.parse(value);return "https".equals(u.getScheme())&&"osminog.red".equals(u.getHost())&&u.getUserInfo()==null&&(u.getPort()==-1||u.getPort()==443);}catch(Exception e){return false;}}
 static String localAsset(String path){if(path==null)return null;if("/".equals(path))return "index.html";String name=path.startsWith("/")?path.substring(1):path;if(STATIC.contains(name))return name;if(name.matches("design/[A-Za-z0-9 _-]+\\.svg"))return name;return null;}
 @Override public void onCreate(Bundle saved){super.onCreate(saved);systemBars();root=new FrameLayout(this);root.setBackgroundColor(0xff064579);shell=new WebView(this);shell.setBackgroundColor(Color.TRANSPARENT);root.addView(shell,new FrameLayout.LayoutParams(-1,-1));setContentView(root);
  root.setOnApplyWindowInsetsListener((view,insets)->{int top,bottom;if(Build.VERSION.SDK_INT>=30){android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars());android.graphics.Insets ime=insets.getInsets(WindowInsets.Type.ime());top=bars.top;bottom=Math.max(bars.bottom,ime.bottom);}else{top=insets.getSystemWindowInsetTop();bottom=insets.getSystemWindowInsetBottom();}float density=getResources().getDisplayMetrics().density;String js="document.documentElement.style.setProperty('--top','"+(top/density)+"px');document.documentElement.style.setProperty('--bottom','"+(bottom/density)+"px');";shell.evaluateJavascript(js,null);return insets;});
  WebSettings s=shell.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(true);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setSupportMultipleWindows(false);s.setJavaScriptCanOpenWindowsAutomatically(false);s.setMediaPlaybackRequiresUserGesture(true);s.setUserAgentString(s.getUserAgentString()+" OSMINOG_Ocean/0.3.0");CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setAcceptThirdPartyCookies(shell,false);
  shell.setWebViewClient(new WebViewClient(){
   @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){if(!owned(r.getUrl().toString()))return null;String asset=localAsset(r.getUrl().getPath());if(asset==null)return null;try{String mime=asset.endsWith(".js")?"text/javascript":asset.endsWith(".css")?"text/css":asset.endsWith(".svg")?"image/svg+xml":asset.endsWith(".png")?"image/png":asset.endsWith(".webmanifest")?"application/manifest+json":"text/html";Map<String,String> headers=new HashMap<>();headers.put("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-src 'none'; form-action 'self'");headers.put("Cache-Control","no-store");return new WebResourceResponse(mime,"UTF-8",200,"OK",headers,getAssets().open(asset));}catch(IOException e){return new WebResourceResponse("text/plain","UTF-8",404,"Not found",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}}
   @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){Uri u=r.getUrl();if(!r.isForMainFrame())return !owned(u.toString());if(HOME.equals(u.toString()))return false;if("https".equals(u.getScheme())){try{startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception e){notice("Не удалось открыть ссылку");}}return true;}
   @Override public void onPageFinished(WebView v,String url){if(!HOME.equals(url))return;root.requestApplyInsets();if(port!=null)port.close();WebMessagePort[] channel=v.createWebMessageChannel();port=channel[0];port.setWebMessageCallback(new WebMessagePort.WebMessageCallback(){@Override public void onMessage(WebMessagePort p,WebMessage message){if(!HOME.equals(shell.getUrl())||message.getData()==null||message.getData().length()>256)return;try{String action=new JSONObject(message.getData()).optString("type");if("checkUpdate".equals(action))updater.check();else if("downloadUpdate".equals(action))updater.downloadAvailable();else if("installSettings".equals(action))updater.openInstallSettings();}catch(JSONException ignored){}}});v.postWebMessage(new WebMessage("OSMINOG_OCEAN_NATIVE",new WebMessagePort[]{channel[1]}),Uri.parse(ORIGIN));}
   @Override public void onReceivedSslError(WebView v,SslErrorHandler h,android.net.http.SslError error){h.cancel();notice("Ошибка сертификата сервера. Отправка остановлена.");}
  });
  shell.setWebChromeClient(new WebChromeClient(){
   @Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> callback,FileChooserParams params){if(!HOME.equals(v.getUrl())){callback.onReceiveValue(null);return true;}if(fileCallback!=null)fileCallback.onReceiveValue(null);fileCallback=callback;Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*").putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"image/jpeg","image/png","application/pdf","text/plain"});try{startActivityForResult(intent,50);}catch(Exception e){callback.onReceiveValue(null);fileCallback=null;}return true;}
   @Override public void onPermissionRequest(PermissionRequest request){runOnUiThread(()->{if(!foreground||!HOME.equals(shell.getUrl())||!ORIGIN.equals(request.getOrigin().toString().replaceAll("/$",""))||request.getResources().length!=1||!PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(request.getResources()[0])){request.deny();return;}if(checkSelfPermission(Manifest.permission.CAMERA)==PackageManager.PERMISSION_GRANTED){request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});return;}if(cameraRequest!=null)cameraRequest.deny();cameraRequest=request;requestPermissions(new String[]{Manifest.permission.CAMERA},60);});}
   @Override public void onPermissionRequestCanceled(PermissionRequest request){if(cameraRequest==request)cameraRequest=null;}
  });updater=new Updater(this);shell.loadUrl(HOME);
 }
 void systemBars(){Window w=getWindow();if(Build.VERSION.SDK_INT>=30)w.setDecorFitsSystemWindows(false);else w.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);w.setStatusBarColor(Color.TRANSPARENT);w.setNavigationBarColor(Color.TRANSPARENT);if(Build.VERSION.SDK_INT>=29){w.setNavigationBarContrastEnforced(false);w.setStatusBarContrastEnforced(false);}}
 void emit(String type,Object... args){try{JSONObject value=new JSONObject().put("type",type);for(int i=0;i+1<args.length;i+=2)value.put(String.valueOf(args[i]),args[i+1]);String script="window.dispatchEvent(new CustomEvent('ocean-native',{detail:"+value+"}))";runOnUiThread(()->{if(shell!=null&&!isDestroyed()&&HOME.equals(shell.getUrl()))shell.evaluateJavascript(script,null);});}catch(JSONException ignored){}}
 void notice(String message){emit("notice","message",message);}
 @Override protected void onResume(){super.onResume();foreground=true;systemBars();if(shell!=null){shell.onResume();shell.evaluateJavascript("document.body.classList.remove('paused');",null);}if(updater!=null)updater.resume();}
 @Override protected void onPause(){foreground=false;if(cameraRequest!=null){cameraRequest.deny();cameraRequest=null;}if(shell!=null){shell.evaluateJavascript("document.querySelectorAll('video').forEach(v=>{if(v.srcObject)v.srcObject.getTracks().forEach(t=>t.stop());v.srcObject=null;});document.body.classList.add('paused');",null);shell.onPause();}CookieManager.getInstance().flush();super.onPause();}
 @Override public void onRequestPermissionsResult(int code,String[] permissions,int[] grants){super.onRequestPermissionsResult(code,permissions,grants);if(code==60&&cameraRequest!=null){PermissionRequest request=cameraRequest;cameraRequest=null;if(foreground&&grants.length>0&&grants[0]==PackageManager.PERMISSION_GRANTED)request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});else request.deny();}}
 @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==50&&fileCallback!=null){fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result,data));fileCallback=null;}}
 @Override public void onBackPressed(){if(shell!=null&&shell.canGoBack())shell.goBack();else super.onBackPressed();}
 @Override protected void onDestroy(){if(fileCallback!=null)fileCallback.onReceiveValue(null);if(cameraRequest!=null)cameraRequest.deny();if(updater!=null)updater.close();if(port!=null)port.close();if(shell!=null){root.removeView(shell);shell.destroy();shell=null;}super.onDestroy();}
}
