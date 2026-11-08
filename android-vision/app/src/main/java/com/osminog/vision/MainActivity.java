package com.osminog.vision;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Outline;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.*;
import android.speech.*;
import android.speech.tts.*;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import org.json.*;
import java.io.*;
import java.util.*;

public class MainActivity extends Activity {
 static final String ORIGIN="https://appassets.androidplatform.net", HOME=ORIGIN+"/assets/index.html";
 static final String[] NAMES={"ChatGPT","Gemini","Claude","DeepSeek","Алиса","Grok","Свой ИИ"};
 static final String[] URLS={"https://chatgpt.com/","https://gemini.google.com/app","https://claude.ai/new","https://chat.deepseek.com/","https://alice.yandex.ru/","https://grok.com/",""};
 final Handler handler=new Handler(Looper.getMainLooper());
 WebView shell,provider; WebMessagePort port; LinearLayout providerPanel; FrameLayout root; TextureView preview;
 EyeCamera eye; SpeechRecognizer recognizer; TextToSpeech tts; Updater updater; android.content.SharedPreferences prefs;
 boolean transportVerified=false,nativeActionBusy=false;
 boolean foreground=false,connected=false,voice=false,camera=false,front=false,listening=false,speaking=false,ttsReady=false;
 int selected=0,permissionAction=0,resumeAction=0,epoch=0,probeEpoch=0,voiceErrors=0,bridgeMisses=0; float safeTop=0,safeBottom=0; String currentRequest="",partial=""; boolean frameSent=false,requestSent=false,enterSent=false;
 ValueCallback<Uri[]> fileCallback; Runnable pendingConsentAction;
 int dp(float value){return Math.round(value*getResources().getDisplayMetrics().density);}
 @Override public void onCreate(Bundle saved){super.onCreate(saved);configureSystemBars();if(Build.VERSION.SDK_INT>=30)getWindow().setDecorFitsSystemWindows(false);else getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);getWindow().setStatusBarColor(Color.TRANSPARENT);getWindow().setNavigationBarColor(Color.TRANSPARENT);if(Build.VERSION.SDK_INT>=29){getWindow().setStatusBarContrastEnforced(false);getWindow().setNavigationBarContrastEnforced(false);}prefs=getSharedPreferences("vision",MODE_PRIVATE);selected=Math.max(0,Math.min(NAMES.length-1,prefs.getInt("provider",0)));if(selected==6&&customUrl().isEmpty())selected=0;
  root=new FrameLayout(this);root.setBackgroundColor(0xff00396f);root.setOnApplyWindowInsetsListener((v,i)->{int topPx,bottomPx;if(Build.VERSION.SDK_INT>=30){android.graphics.Insets bars=i.getInsets(WindowInsets.Type.systemBars());android.graphics.Insets ime=i.getInsets(WindowInsets.Type.ime());topPx=bars.top;bottomPx=Math.max(bars.bottom,ime.bottom);}else{topPx=i.getSystemWindowInsetTop();bottomPx=i.getSystemWindowInsetBottom();}v.setPadding(0,0,0,0);float density=getResources().getDisplayMetrics().density;float top=topPx/density,bottom=bottomPx/density;v.post(()->applyInsets(top,bottom));if(Build.VERSION.SDK_INT>=30){int mask=WindowInsets.Type.systemBars()|WindowInsets.Type.ime()|WindowInsets.Type.displayCutout()|WindowInsets.Type.systemGestures()|WindowInsets.Type.mandatorySystemGestures()|WindowInsets.Type.tappableElement();return new WindowInsets.Builder(i).setInsets(mask,android.graphics.Insets.NONE).build().consumeSystemWindowInsets().consumeStableInsets();}return i.consumeSystemWindowInsets();});
  providerPanel=new LinearLayout(this);providerPanel.setOrientation(LinearLayout.VERTICAL);LinearLayout bar=new LinearLayout(this);bar.setGravity(Gravity.CENTER_VERTICAL);bar.setPadding(dp(8),dp(4),dp(8),dp(4));bar.addView(button("‹ Осьминог",v->returnToShell()),new LinearLayout.LayoutParams(0,dp(48),1));bar.addView(button("Готово ✓",v->returnToShell()),new LinearLayout.LayoutParams(dp(110),dp(48)));providerPanel.addView(bar);
  provider=web(false);providerPanel.addView(provider,new LinearLayout.LayoutParams(-1,0,1));root.addView(providerPanel,new FrameLayout.LayoutParams(-1,-1));
  shell=web(true);root.addView(shell,new FrameLayout.LayoutParams(-1,-1));preview=new TextureView(this);preview.setVisibility(View.GONE);preview.setClipToOutline(true);preview.setOutlineProvider(new ViewOutlineProvider(){public void getOutline(View v,Outline o){o.setRoundRect(0,0,v.getWidth(),v.getHeight(),dp(24));}});root.addView(preview,new FrameLayout.LayoutParams(1,1));
  eye=new EyeCamera(this,preview,new EyeCamera.Listener(){public void ready(){camera=true;emit("camera","on",true);}public void error(String message){camera=false;preview.setVisibility(View.GONE);emit("camera","on",false);notice(message);}});
  getWindow().setStatusBarColor(Color.TRANSPARENT);getWindow().setNavigationBarColor(Color.TRANSPARENT);
  setContentView(root);configureSystemBars();root.setFitsSystemWindows(false);shell.setFitsSystemWindows(false);root.requestApplyInsets();shell.loadUrl(HOME);updater=new Updater(this);
  tts=new TextToSpeech(this,status->{if(status==TextToSpeech.SUCCESS){int lang=tts.setLanguage(new Locale("ru","RU"));ttsReady=lang!=TextToSpeech.LANG_MISSING_DATA&&lang!=TextToSpeech.LANG_NOT_SUPPORTED;tts.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build());tts.setOnUtteranceProgressListener(new UtteranceProgressListener(){public void onStart(String id){}public void onDone(String id){handler.post(()->{speaking=false;if(voice&&foreground)listenLater(400);});}public void onError(String id){handler.post(()->{speaking=false;notice("Озвучивание недоступно. Ответ остался в чате.");if(voice)listenLater(600);});}});}});
 }
 Button button(String text,View.OnClickListener listener){Button b=new Button(this);b.setText(text);b.setTextColor(0xffd9efff);b.setAllCaps(false);b.setTextSize(14);b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(0xff0d5794));b.setOnClickListener(listener);return b;}
 WebView web(boolean local){WebView w=new WebView(this);w.setBackgroundColor(local?Color.TRANSPARENT:Color.BLACK);w.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);WebSettings s=w.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setUseWideViewPort(true);s.setLoadWithOverviewMode(false);s.setSupportZoom(false);s.setBuiltInZoomControls(false);s.setDisplayZoomControls(false);s.setAllowFileAccess(false);s.setAllowContentAccess(!local);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setGeolocationEnabled(false);s.setSupportMultipleWindows(false);s.setJavaScriptCanOpenWindowsAutomatically(false);s.setMediaPlaybackRequiresUserGesture(true);CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setAcceptThirdPartyCookies(w,true);
  w.setWebViewClient(new WebViewClient(){
   @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest r){if(!local)return null;String path=r.getUrl().getPath();if(!ORIGIN.equals(r.getUrl().getScheme()+"://"+r.getUrl().getAuthority())||path==null||!(Arrays.asList("/assets/index.html","/assets/app.js","/assets/app.css").contains(path)||path.matches("/assets/design/[A-Za-z0-9 _-]+\\.svg")))return new WebResourceResponse("text/plain","UTF-8",404,"Not found",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));try{String mime=path.endsWith(".js")?"text/javascript":path.endsWith(".css")?"text/css":path.endsWith(".svg")?"image/svg+xml":"text/html";Map<String,String> headers=new HashMap<>();headers.put("Content-Security-Policy","default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-src 'none'; base-uri 'none'; form-action 'none'");return new WebResourceResponse(mime,"UTF-8",200,"OK",headers,getAssets().open(path.substring(8)));}catch(IOException e){return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));}}
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest r){Uri u=r.getUrl();if(local)return !HOME.equals(u.toString());return !"https".equals(u.getScheme())||u.getHost()==null||u.getUserInfo()!=null;}
   @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon){if(!local){transportVerified=false;connected=false;connection();if(!currentRequest.isEmpty()&&!chatOrigin(url)){epoch++;error("Сервис открыл другую страницу. Запрос не повторён; открой чат сервиса.");}}}
   @Override public void onPageFinished(WebView view,String url){if(local&&HOME.equals(url)){if(port!=null)port.close();WebMessagePort[] channel=view.createWebMessageChannel();port=channel[0];port.setWebMessageCallback(new WebMessagePort.WebMessageCallback(){@Override public void onMessage(WebMessagePort p,WebMessage m){if(!HOME.equals(shell.getUrl())||m.getData()==null||m.getData().length()>20000)return;try{command(new JSONObject(m.getData()));}catch(Exception e){notice("Команда отклонена");}}},handler);String nonce=UUID.randomUUID().toString();view.evaluateJavascript("window.__osminogNativeNonce="+JSONObject.quote(nonce),ignored->{if(HOME.equals(view.getUrl()))view.postWebMessage(new WebMessage("OSMINOG:"+nonce,new WebMessagePort[]{channel[1]}),Uri.parse(ORIGIN));});}else if(!local&&chatOrigin(url)){try{Uri u=Uri.parse(url);prefs.edit().putString(savedUrlKey(),u.buildUpon().clearQuery().fragment(null).build().toString()).apply();}catch(Exception ignored){}inject();}}
   @Override public void onReceivedError(WebView view,WebResourceRequest r,WebResourceError error){if(!local&&r.isForMainFrame()){connected=false;emit("connected","ok",false,"provider",providerName(),"providerId",providerId(),"message","Сервис не загрузился. Проверь интернет или открой подключение ещё раз.");}}
   @Override public void onReceivedSslError(WebView view,android.webkit.SslErrorHandler h,android.net.http.SslError e){h.cancel();notice("Ошибка сертификата сайта. Подключение остановлено.");}
  });
  w.setWebChromeClient(new WebChromeClient(){@Override public void onPermissionRequest(PermissionRequest request){request.deny();}
   @Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> callback,FileChooserParams parameters){if(local){callback.onReceiveValue(null);return true;}if(fileCallback!=null)fileCallback.onReceiveValue(null);fileCallback=callback;try{startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("image/*").addCategory(Intent.CATEGORY_OPENABLE),50);}catch(Exception e){fileCallback.onReceiveValue(null);fileCallback=null;}return true;}
  });return w;
 }
 void configureSystemBars(){
  Window w=getWindow();w.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS|WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);w.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
  if(Build.VERSION.SDK_INT>=30)w.setDecorFitsSystemWindows(false);
  w.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
  w.setStatusBarColor(Color.TRANSPARENT);w.setNavigationBarColor(Color.TRANSPARENT);
  if(Build.VERSION.SDK_INT>=28)w.setNavigationBarDividerColor(Color.TRANSPARENT);
  if(Build.VERSION.SDK_INT>=29){w.setStatusBarContrastEnforced(false);w.setNavigationBarContrastEnforced(false);}
 }
 @Override public void onWindowFocusChanged(boolean focused){super.onWindowFocusChanged(focused);if(focused)configureSystemBars();}
 static String normalizeProviderUrl(String input){
  try{String value=input==null?"":input.trim();if(value.length()>2048||value.isEmpty())return "";if(!value.contains("://"))value="https://"+value;
   java.net.URI uri=new java.net.URI(value);String host=uri.getHost();if(!"https".equalsIgnoreCase(uri.getScheme())||host==null||uri.getRawUserInfo()!=null||(uri.getPort()!=-1&&uri.getPort()!=443)||host.equalsIgnoreCase("appassets.androidplatform.net"))return "";
   return new java.net.URI("https",null,host.toLowerCase(Locale.ROOT),-1,uri.getPath()==null||uri.getPath().isEmpty()?"/":uri.getPath(),null,null).toASCIIString();
  }catch(Exception error){return "";}
 }
 String customUrl(){return normalizeProviderUrl(prefs.getString("customProviderUrl",""));}
 String providerUrl(){return selected==6?customUrl():URLS[selected];}
 String providerId(){return selected==6?"custom:"+Uri.parse(customUrl()).getHost():String.valueOf(selected);}
 String providerName(){return selected==6?String.valueOf(Uri.parse(customUrl()).getHost()):NAMES[selected];}
 String savedUrlKey(){return "url"+providerId();}
 boolean chatOrigin(String url){try{Uri u=Uri.parse(url),expected=Uri.parse(providerUrl());return "https".equals(u.getScheme())&&u.getUserInfo()==null&&expected.getHost()!=null&&Objects.equals(u.getHost(),expected.getHost())&&(u.getPort()==-1||u.getPort()==443);}catch(Exception e){return false;}}
 String providerScript(){String origin=Uri.parse(providerUrl()).buildUpon().path("").clearQuery().fragment(null).build().toString();return "window.__OSMINOGProviderConfig={origin:"+JSONObject.quote(origin)+"};"+asset("provider.js");}
 void connection(){emit("connected","ok",connected,"verified",transportVerified,"provider",providerName(),"providerId",providerId(),"stage",transportVerified?"verified":connected?"ready":"checking");}
 String asset(String name){try(InputStream in=getAssets().open(name);ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1)out.write(b,0,n);return out.toString("UTF-8");}catch(Exception e){return "";}}
 void applyInsets(float top,float bottom){safeTop=top;safeBottom=bottom;if(providerPanel!=null)providerPanel.setPadding(0,dp(top),0,dp(bottom));if(shell==null||isDestroyed())return;String js="if(document.documentElement){document.documentElement.style.setProperty('--safe-top',"+JSONObject.quote(top+"px")+");document.documentElement.style.setProperty('--safe-bottom',"+JSONObject.quote(bottom+"px")+");}";shell.evaluateJavascript(js,null);}
 void ensureProviderLoaded(){if(prefs.getBoolean("disableProviderWarmupForTest",false))return;provider.setVisibility(View.VISIBLE);provider.onResume();provider.resumeTimers();String url=provider.getUrl();if(url==null||url.equals("about:blank")){url=prefs.getString(savedUrlKey(),providerUrl());if(!chatOrigin(url))url=providerUrl();provider.loadUrl(url);}else if(chatOrigin(url))inject();}
 void inject(){if(!chatOrigin(provider.getUrl()))return;final int chosen=selected;provider.evaluateJavascript(providerScript(),v->{if(chosen==selected)probe(0);});}
 void probe(int attempt){if(attempt==0)probeEpoch++;probeStep(attempt,selected,probeEpoch);}
 void probeStep(int attempt,int chosen,int token){if(token!=probeEpoch||chosen!=selected)return;if(!chatOrigin(provider.getUrl())){connected=false;emit("connected","ok",false,"provider",providerName(),"providerId",providerId(),"stage","checking");return;}provider.evaluateJavascript("JSON.stringify(window.OSMINOGMobileBridge?.probe()||{})",raw->{if(token!=probeEpoch||chosen!=selected||!chatOrigin(provider.getUrl()))return;JSONObject p=decode(raw);connected=p.optBoolean("ready");if(connected)prefs.edit().putBoolean("connectedBefore",true).putString(savedUrlKey(),provider.getUrl()).apply();connection();if(!connected&&foreground){if(attempt<40)handler.postDelayed(()->probeStep(attempt+1,chosen,token),750);else handler.postDelayed(()->probe(0),7000);}});}
 String version(){try{return getPackageManager().getPackageInfo(getPackageName(),0).versionName;}catch(Exception e){return "0.2.3";}}
 static JSONObject decode(String raw){try{Object o=new JSONTokener(raw==null?"null":raw).nextValue();if(o instanceof String)return new JSONObject((String)o);if(o instanceof JSONObject)return(JSONObject)o;}catch(Exception ignored){}return new JSONObject();}
 // Outbound events use the trusted local document directly. A repeated onPageFinished
 // can replace the inbound port; replies must not disappear into an old closed port.
 void emit(String type,Object... values){try{JSONObject o=new JSONObject().put("type",type);for(int i=0;i+1<values.length;i+=2)o.put(String.valueOf(values[i]),values[i+1]);String json=o.toString();runOnUiThread(()->{if(shell!=null&&!isDestroyed()&&HOME.equals(shell.getUrl()))shell.evaluateJavascript("window.OSMINOG&&window.OSMINOG.receive("+json+")",null);});}catch(Exception ignored){}}
 void notice(String text){emit("notice","message",text);}
 void error(String text){String id=currentRequest;currentRequest="";nativeActionBusy=false;transportVerified=false;connection();restoreShellFocus();voiceOff();emit("error","id",id,"message",text);}
 void command(JSONObject m)throws Exception{if(!foreground&&!m.optString("type").equals("ready"))return;switch(m.getString("type")){
  case "ready":emit("hello","version",version(),"providerId",providerId(),"provider",providerName());emit("resumed");connection();ensureProviderLoaded();applyInsets(safeTop,safeBottom);break;
  case "connect":emit("providerPicker","customUrl",customUrl());break;
  case "selectCustomProvider":{String url=normalizeProviderUrl(m.optString("url"));if(url.isEmpty()){notice("Укажи HTTPS-ссылку на сайт ИИ без логина и пароля в адресе.");break;}prefs.edit().putString("customProviderUrl",url).apply();chooseProvider(6);break;}
  case "selectProvider":chooseProvider(m.optInt("index",-1));break;
  case "downloadUpdate":if(updater!=null)updater.downloadAvailable();break;
  case "openInstallSettings":if(updater!=null)updater.openInstallSettings();break;
  case "grantConsent":prefs.edit().putBoolean("mediaConsent1",true).apply();Runnable consent=pendingConsentAction;pendingConsentAction=null;if(consent!=null)consent.run();break;
  case "denyConsent":pendingConsentAction=null;break;
  case "openProvider":openProvider();break;
  case "update":stopSession();updater.check();break;
  case "clear":emit("clearConfirm");break;
  case "clearConfirmed":emit("clear");break;
  case "privacy":emit("privacyInfo");break;
  case "cancelRequest":cancelRequest();break;
  case "voiceOn":withConsent(()->permission(1));break;
  case "voiceOff":voiceOff();break;
  case "cameraOn":withConsent(()->permission(2));break;
  case "cameraOff":cameraOff();break;
  case "cameraLayout":if(camera||eye.running){FrameLayout.LayoutParams p=new FrameLayout.LayoutParams(dp((float)Math.max(1,Math.min(1500,m.optDouble("w",1)))),dp((float)Math.max(1,Math.min(1000,m.optDouble("h",1)))));p.leftMargin=dp((float)Math.max(0,m.optDouble("x")));p.topMargin=dp((float)Math.max(0,m.optDouble("y")));preview.setLayoutParams(p);preview.setVisibility(m.optBoolean("visible",true)?View.VISIBLE:View.INVISIBLE);}break;
  case "flip":front=!front;if(camera){camera=false;eye.start(front);}break;
  case "ask":ask(m);break;
  case "speak":speak(m.optString("text"));break;
  case "continueVoice":listenLater(500);break;
  case "interrupt":if(tts!=null)tts.stop();speaking=false;listenLater(100);break;
  case "stop":stopSession();break;
  default:break;
 }}
 void chooseProvider(int index){if(index<0||index>=NAMES.length||index==6&&customUrl().isEmpty())return;stopSession();transportVerified=false;probeEpoch++;selected=index;prefs.edit().putInt("provider",selected).apply();connected=false;emit("connected","ok",false,"provider",providerName(),"providerId",providerId(),"stage","checking");String url=prefs.getString(savedUrlKey(),providerUrl());if(!chatOrigin(url))url=providerUrl();provider.setVisibility(View.VISIBLE);providerPanel.setVisibility(View.VISIBLE);shell.setVisibility(View.GONE);preview.setVisibility(View.GONE);if(provider.getUrl()==null||!chatOrigin(provider.getUrl())||!Objects.equals(Uri.parse(provider.getUrl()).getHost(),Uri.parse(url).getHost()))provider.loadUrl(url);else inject();}
 void returnToShell(){shell.setVisibility(View.VISIBLE);configureSystemBars();restoreShellFocus();emit("resumed");if(chatOrigin(provider.getUrl()))inject();else{connected=false;emit("connected","ok",false,"provider",providerName(),"providerId",providerId(),"message","Заверши вход и открой чат на сайте сервиса.");}}
 void openProvider(){stopSession();ensureProviderLoaded();shell.setVisibility(View.GONE);providerPanel.setVisibility(View.VISIBLE);preview.setVisibility(View.GONE);}
 void withConsent(Runnable action){if(!connected){emit("providerPicker");return;}if(prefs.getBoolean("mediaConsent1",false)){action.run();return;}pendingConsentAction=action;emit("consentRequired");}
 void permission(int action){String name=action==1?Manifest.permission.RECORD_AUDIO:Manifest.permission.CAMERA;if(checkSelfPermission(name)==PackageManager.PERMISSION_GRANTED){if(action==1)voiceOn();else cameraOn();return;}if(permissionAction!=0)return;permissionAction=action;requestPermissions(new String[]{name},action);}
 @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results){super.onRequestPermissionsResult(request,permissions,results);permissionAction=0;if(results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED){if(!foreground){resumeAction=request;return;}if(request==1)voiceOn();if(request==2)cameraOn();}else notice(request==1?"Микрофон не разрешён. Можно писать текстом.":"Камера не разрешена. Голосовой и текстовый чат доступны.");}
 void cameraOn(){if(!foreground)return;camera=true;preview.setVisibility(View.VISIBLE);emit("camera","on",true);eye.start(front);}
 void cameraOff(){camera=false;eye.close();preview.setVisibility(View.GONE);emit("camera","on",false);}
 void voiceOn(){if(!foreground)return;if(!SpeechRecognizer.isRecognitionAvailable(this)){notice("На устройстве нет службы распознавания речи. Установи/включи речевую службу Android или пиши текстом.");return;}voice=true;voiceErrors=0;getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);emit("voice","on",true);listenLater(100);}
 void voiceOff(){voice=false;listening=false;if(recognizer!=null){recognizer.cancel();recognizer.destroy();recognizer=null;}if(tts!=null)tts.stop();speaking=false;getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);emit("voice","on",false);}
 void listenLater(long delay){final int e=epoch;handler.postDelayed(()->{if(e==epoch&&foreground&&voice&&!speaking&&currentRequest.isEmpty()&&!listening)listen();},delay);}
 void listen(){if(!foreground||!voice||speaking||!currentRequest.isEmpty()||listening)return;try{if(recognizer==null){recognizer=Build.VERSION.SDK_INT>=31&&SpeechRecognizer.isOnDeviceRecognitionAvailable(this)?SpeechRecognizer.createOnDeviceSpeechRecognizer(this):SpeechRecognizer.createSpeechRecognizer(this);recognizer.setRecognitionListener(new RecognitionListener(){public void onReadyForSpeech(Bundle b){emit("listening");}public void onBeginningOfSpeech(){}public void onRmsChanged(float rms){}public void onBufferReceived(byte[] b){}public void onEndOfSpeech(){listening=false;}public void onError(int code){listening=false;if(!voice||!foreground||!currentRequest.isEmpty()||speaking)return;if(code==SpeechRecognizer.ERROR_NO_MATCH||code==SpeechRecognizer.ERROR_SPEECH_TIMEOUT){listenLater(1000);return;}if(++voiceErrors>2){voiceOff();notice("Речевой сервис не отвечает. Проверь язык и интернет; затем включи разговор снова.");}else listenLater(1800);}public void onResults(Bundle b){listening=false;ArrayList<String> text=b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);if(!voice||!foreground||speaking||!currentRequest.isEmpty())return;voiceErrors=0;if(text!=null&&!text.isEmpty()&&!text.get(0).trim().isEmpty())emit("speech","text",text.get(0));else listenLater(500);}public void onPartialResults(Bundle b){}public void onEvent(int t,Bundle b){}});}
  Intent i=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM).putExtra(RecognizerIntent.EXTRA_LANGUAGE,"ru-RU").putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS,false).putExtra(RecognizerIntent.EXTRA_MAX_RESULTS,1).putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE,true);listening=true;recognizer.startListening(i);
 }catch(Exception e){listening=false;voiceOff();notice("Не удалось включить распознавание речи.");}}
 void speak(String text){if(!voice||!foreground||text.isEmpty())return;if(!ttsReady){notice("Нет русского голоса Android. Включи его в настройках синтеза речи. Ответ доступен текстом.");listenLater(1200);return;}if(recognizer!=null)recognizer.cancel();listening=false;speaking=true;emit("speaking");String plain=text.replaceAll("https?://\\S+","").replaceAll("[#*_`]+","");int limit=Math.min(3500,TextToSpeech.getMaxSpeechInputLength()-1);plain=plain.substring(0,Math.min(limit,plain.length()));if(tts.speak(plain,TextToSpeech.QUEUE_FLUSH,null,"osminog-"+System.currentTimeMillis())==TextToSpeech.ERROR){speaking=false;notice("Не удалось озвучить ответ.");listenLater(1200);}}
 void ask(JSONObject m){if(!currentRequest.isEmpty()){emit("error","id",m.optString("id"),"message","Предыдущий вопрос ещё обрабатывается. Останови его глазом перед новым вопросом.");return;}if(!connected||!chatOrigin(provider.getUrl())){emit("error","id",m.optString("id"),"message","Сначала подключи ИИ-чат.");return;}String text=m.optString("text").trim(),id=m.optString("id");if(text.isEmpty()||text.length()>12000||!id.matches("m-[0-9]+"))return;currentRequest=id;partial="";frameSent=false;requestSent=false;enterSent=false;bridgeMisses=0;if(recognizer!=null)recognizer.cancel();listening=false;if(tts!=null)tts.stop();speaking=false;int gen=epoch;
  if(m.optBoolean("withCamera")){if(!camera){error("Камера выключена; вопрос с изображением не отправлен.");return;}eye.frame((image,problem)->{if(gen!=epoch||!id.equals(currentRequest))return;if(problem!=null){error(problem);return;}sendAsk(id,text,image);});}else sendAsk(id,text,"");}
 void sendAsk(String id,String text,String image){if(!foreground||!id.equals(currentRequest))return;try{provider.setFocusableInTouchMode(true);provider.requestFocus();JSONObject q=new JSONObject().put("id",id).put("text",text).put("image",image);provider.evaluateJavascript("Boolean(window.OSMINOGMobileBridge?.start("+q.toString()+"))",raw->{if(!id.equals(currentRequest))return;if(!"true".equals(raw)){error("Чат не готов принять запрос. Открой подключённый сервис.");return;}poll(id,epoch,System.currentTimeMillis());});}catch(Exception e){error("Не удалось передать вопрос.");}}
 // The native handler drives the transport; no reliance on timers in a covered WebView.
 void poll(String id,int gen,long started){if(gen!=epoch||!id.equals(currentRequest)||!foreground)return;if(System.currentTimeMillis()-started>180000){error("Превышено время ожидания. Открой чат сервиса: вопрос мог быть отправлен.");return;}if(!chatOrigin(provider.getUrl())){error("Сервис сменил адрес. Открой подключение и заверши вход.");return;}provider.evaluateJavascript("JSON.stringify(window.OSMINOGMobileBridge?.snapshot()||{})",raw->{if(gen!=epoch||!id.equals(currentRequest))return;JSONObject r=decode(raw);if(!id.equals(r.optString("id"))){if(++bridgeMisses<=12){provider.evaluateJavascript(providerScript(),ignored->handler.postDelayed(()->poll(id,gen,started),500));return;}error("Не удалось восстановить ответ после перезагрузки чата. Запрос автоматически не повторён; открой сервис.");return;}bridgeMisses=0;
  
  String action=r.optString("nativeAction");if(("insertText".equals(action)||"enter".equals(action))&&!nativeActionBusy){nativeActionBusy=true;NativeComposer.execute(this,id,action,gen,ok->{nativeActionBusy=false;if(gen!=epoch||!id.equals(currentRequest))return;provider.evaluateJavascript("window.OSMINOGMobileBridge?.nativeResult("+JSONObject.quote(id)+","+JSONObject.quote(action)+","+ok+")",ignored->handler.postDelayed(()->poll(id,gen,started),350));});return;}
  if(r.optBoolean("sent")&&!requestSent){requestSent=true;restoreShellFocus();emit("sent","id",id);}
  if(r.optBoolean("frameAccepted")&&!frameSent){frameSent=true;emit("frameSent","id",id);}
  String state=r.optString("state"),text=r.optString("text");if("error".equals(state)){error(r.optString("error","Ошибка ИИ-сервиса"));return;}if("done".equals(state)){transportVerified=true;connection();restoreShellFocus();currentRequest="";emit("answer","id",id,"text",text);return;}if(!text.equals(partial)&&!text.isEmpty()){partial=text;emit("partial","id",id,"text",text);}handler.postDelayed(()->poll(id,gen,started),350);});}
 void restoreShellFocus(){if(shell!=null&&shell.getVisibility()==View.VISIBLE){shell.requestFocus();android.view.inputmethod.InputMethodManager ime=(android.view.inputmethod.InputMethodManager)getSystemService(INPUT_METHOD_SERVICE);if(ime!=null)ime.hideSoftInputFromWindow(shell.getWindowToken(),0);}}
 void cancelRequest(){epoch++;nativeActionBusy=false;currentRequest="";restoreShellFocus();if(provider!=null&&chatOrigin(provider.getUrl()))provider.evaluateJavascript("window.OSMINOGMobileBridge?.cancel()",null);}
 void stopSession(){epoch++;nativeActionBusy=false;currentRequest="";voiceOff();cameraOff();if(provider!=null&&chatOrigin(provider.getUrl()))provider.evaluateJavascript("window.OSMINOGMobileBridge?.cancel()",null);}
 @Override protected void onResume(){super.onResume();configureSystemBars();foreground=true;provider.onResume();provider.resumeTimers();emit("resumed");ensureProviderLoaded();if(resumeAction!=0){int action=resumeAction;resumeAction=0;if(action==1)voiceOn();else cameraOn();}if(updater!=null)updater.resume();}
 @Override protected void onPause(){foreground=false;stopSession();provider.onPause();provider.pauseTimers();emit("paused");CookieManager.getInstance().flush();super.onPause();}
 @Override public void onBackPressed(){if(shell.getVisibility()!=View.VISIBLE){returnToShell();return;}shell.evaluateJavascript("!!document.getElementById('settings')&&!document.getElementById('settings').hidden",open->{if("true".equals(open)){emit("back");return;}if(voice||camera||!currentRequest.isEmpty()){stopSession();emit("resumed");return;}MainActivity.super.onBackPressed();});}
 @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==50&&fileCallback!=null){fileCallback.onReceiveValue(result==RESULT_OK&&data!=null?new Uri[]{data.getData()}:null);fileCallback=null;}}
 @Override protected void onDestroy(){stopSession();handler.removeCallbacksAndMessages(null);if(updater!=null)updater.close();if(tts!=null)tts.shutdown();if(fileCallback!=null)fileCallback.onReceiveValue(null);if(port!=null)port.close();root.removeAllViews();shell.destroy();provider.destroy();super.onDestroy();}
}
