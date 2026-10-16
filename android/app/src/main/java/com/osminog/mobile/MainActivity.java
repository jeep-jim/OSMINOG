package com.osminog.mobile;

import android.app.*;
import android.content.*;
import android.net.Uri;
import android.os.*;
import android.provider.OpenableColumns;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import androidx.core.content.FileProvider;
import androidx.webkit.*;
import org.json.*;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;

public class MainActivity extends Activity {
 static final String ORIGIN="https://appassets.androidplatform.net";
 static final int PICK_BOARD=10,PICK_CHAT=11;
 final ArrayList<WebView> tabs=new ArrayList<>();
 final ExecutorService io=Executors.newSingleThreadExecutor();
 WebView board,active; FrameLayout surface; EditText address; TextView status; LinearLayout tabBar;
 ValueCallback<Uri[]> fileCallback; WebView chooserOwner; String chooserOrigin; String queuedFile,queuedOrigin; boolean boardReady=false;
 android.content.SharedPreferences prefs;
 int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}
 @Override public void onCreate(Bundle state){super.onCreate(state);prefs=getSharedPreferences("workspace",MODE_PRIVATE);
  LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(0xff101a2b);
  root.setOnApplyWindowInsetsListener((v,i)->{if(Build.VERSION.SDK_INT>=30){android.graphics.Insets bars=i.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.ime());v.setPadding(bars.left,bars.top,bars.right,bars.bottom);}else v.setPadding(i.getSystemWindowInsetLeft(),i.getSystemWindowInsetTop(),i.getSystemWindowInsetRight(),i.getSystemWindowInsetBottom());return i;});
  LinearLayout nav=new LinearLayout(this);nav.setGravity(Gravity.CENTER_VERTICAL);nav.addView(button("‹",v->back()),new LinearLayout.LayoutParams(dp(48),dp(48)));
  address=new EditText(this);address.setSingleLine();address.setTextColor(0xfff1f5fc);address.setHintTextColor(0xff94a3b8);address.setTextSize(14);address.setHint("Адрес или поиск");address.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_VARIATION_URI);address.setImeOptions(android.view.inputmethod.EditorInfo.IME_ACTION_GO);address.setOnEditorActionListener((v,a,e)->{navigate(address.getText().toString());return true;});nav.addView(address,new LinearLayout.LayoutParams(0,dp(48),1));nav.addView(button("↻",v->{if(active!=null)active.reload();}),new LinearLayout.LayoutParams(dp(48),dp(48)));root.addView(nav);
  HorizontalScrollView strip=new HorizontalScrollView(this);tabBar=new LinearLayout(this);strip.setHorizontalScrollBarEnabled(false);strip.addView(tabBar);root.addView(strip,new LinearLayout.LayoutParams(-1,dp(44)));
  surface=new FrameLayout(this);root.addView(surface,new LinearLayout.LayoutParams(-1,0,1));
  status=new TextView(this);status.setTextColor(0xffabbcd4);status.setTextSize(11);status.setPadding(dp(12),dp(5),dp(12),dp(5));status.setText("Локальные столы • доступ ИИ к инструментам не подключён");root.addView(status);
  LinearLayout bottom=new LinearLayout(this);String[] names={"Столы","Вкладки","＋ Файл","ИИ"};for(int i=0;i<4;i++){final int n=i;bottom.addView(button(names[i],v->{if(n==0){show(board);board.evaluateJavascript("window.showDesks&&showDesks()",null);}if(n==1)tabMenu();if(n==2)pick(PICK_BOARD);if(n==3)aiMenu();}),new LinearLayout.LayoutParams(0,dp(52),1));}root.addView(bottom);setContentView(root);
  board=makeWeb(true);surface.addView(board,new FrameLayout.LayoutParams(-1,-1));active=board;board.loadUrl(ORIGIN+"/assets/mobile.html");
  try{JSONArray saved=new JSONArray(prefs.getString("tabs","[]"));for(int i=0;i<Math.min(8,saved.length());i++){String u=saved.getString(i);if(safeUrl(u))newTab(u,false);}}catch(Exception ignored){}show(board);
  surface.setOnDragListener((v,event)->{if(event.getAction()==DragEvent.ACTION_DRAG_STARTED)return event.getClipDescription()!=null&&active==board;if(event.getAction()==DragEvent.ACTION_DROP){requestDragAndDropPermissions(event);ClipData clip=event.getClipData();if(clip!=null)for(int i=0;i<clip.getItemCount();i++){Uri u=clip.getItemAt(i).getUri();if(u!=null)importUri(u);}return true;}return true;});
 }
 Button button(String text,View.OnClickListener listener){Button b=new Button(this);b.setText(text);b.setTextSize(12);b.setTextColor(0xffe7eefb);b.setAllCaps(false);b.setMinWidth(0);b.setMinimumWidth(0);b.setPadding(dp(6),0,dp(6),0);b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(0xff1b2a41));b.setOnClickListener(listener);return b;}
 WebView makeWeb(boolean local){WebView w=new WebView(this);WebSettings s=w.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(true);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setSupportMultipleWindows(false);s.setJavaScriptCanOpenWindowsAutomatically(false);s.setMediaPlaybackRequiresUserGesture(true);s.setBuiltInZoomControls(true);s.setDisplayZoomControls(false);CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setAcceptThirdPartyCookies(w,true);
  WebViewAssetLoader loader=new WebViewAssetLoader.Builder().addPathHandler("/assets/",new WebViewAssetLoader.AssetsPathHandler(this)).build();
  w.setWebViewClient(new WebViewClient(){
   @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest req){return local?loader.shouldInterceptRequest(req.getUrl()):null;}
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest req){String u=req.getUrl().toString();if(local){if(!u.startsWith(ORIGIN+"/assets/")){if(safeUrl(u))runOnUiThread(()->newTab(u,true));return true;}return false;}if(!safeUrl(u))return true;return false;}
   @Override public void onPageFinished(WebView view,String url){if(local){boardReady=true;refreshBoard();handleSharedIntent();}else{saveTabs();renderTabs();if(active==view)address.setText(url);}}
   @Override public void onReceivedError(WebView view,WebResourceRequest req,WebResourceError e){if(req.isForMainFrame())status.setText("Страница не загружена: "+e.getDescription());}
  });
  w.setWebChromeClient(new WebChromeClient(){
   @Override public void onReceivedTitle(WebView view,String title){if(!local)renderTabs();}
   @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> cb,FileChooserParams params){if(fileCallback!=null)fileCallback.onReceiveValue(null);fileCallback=cb;chooserOwner=view;chooserOrigin=origin(view.getUrl());
    if(queuedFile!=null&&Objects.equals(queuedOrigin,chooserOrigin)){String id=queuedFile;queuedFile=null;queuedOrigin=null;deliverFile(id);return true;}
    new AlertDialog.Builder(MainActivity.this).setTitle("Прикрепить файл").setItems(new String[]{"С рабочего стола","С устройства"},(d,i)->{if(i==0)chooseBoardFile();else pick(PICK_CHAT);}).setOnCancelListener(d->finishChooser(null)).show();return true;}
  });
  if(local&&WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER))WebViewCompat.addWebMessageListener(w,"Osminog",Collections.singleton(ORIGIN),(view,message,sourceOrigin,isMainFrame,reply)->{if(!isMainFrame||!ORIGIN.equals(sourceOrigin.toString()))return;try{JSONObject m=new JSONObject(message.getData());handleBoardMessage(m);}catch(Exception e){status.setText("Команда стола отклонена");}});
  if(local&&!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER))status.setText("Обновите Android System WebView для работы со столами");
  return w;
 }
 boolean safeUrl(String u){try{Uri x=Uri.parse(u);return "https".equals(x.getScheme())&&x.getHost()!=null&&!"appassets.androidplatform.net".equals(x.getHost())&&x.getUserInfo()==null;}catch(Exception e){return false;}}
 String origin(String u){if(u==null)return "";Uri x=Uri.parse(u);return x.getScheme()+"://"+x.getAuthority();}
 void newTab(String url,boolean focus){if(tabs.size()>=8){status.setText("Открыто 8 вкладок. Закройте ненужную долгим нажатием.");return;}WebView w=makeWeb(false);tabs.add(w);surface.addView(w,new FrameLayout.LayoutParams(-1,-1));w.setVisibility(View.GONE);w.loadUrl(url);if(focus)show(w);renderTabs();}
 void show(WebView w){if(w==null)return;active=w;for(int i=0;i<surface.getChildCount();i++)surface.getChildAt(i).setVisibility(surface.getChildAt(i)==w?View.VISIBLE:View.GONE);address.setText(w==board?"":w.getUrl());address.setHint(w==board?"Открыть сайт или поиск":"Адрес сайта");renderTabs();}
 void renderTabs(){if(tabBar==null||board==null)return;tabBar.removeAllViews();Button home=button("◉ Стол",v->show(board));tabBar.addView(home);home.setAlpha(active==board?1f:.6f);for(WebView w:tabs){String title=w.getTitle();Button b=button(title==null?"Вкладка":title.substring(0,Math.min(18,title.length())),v->show(w));b.setAlpha(active==w?1f:.6f);b.setOnLongClickListener(v->{new AlertDialog.Builder(this).setTitle("Закрыть вкладку?").setPositiveButton("Закрыть",(d,i)->{if(chooserOwner==w)finishChooser(null);tabs.remove(w);surface.removeView(w);w.destroy();if(active==w)show(board);saveTabs();renderTabs();}).setNegativeButton("Отмена",null).show();return true;});tabBar.addView(b);}tabBar.addView(button("＋",v->newAddress()));}
 void saveTabs(){JSONArray a=new JSONArray();for(WebView w:tabs)if(safeUrl(w.getUrl()))a.put(w.getUrl());prefs.edit().putString("tabs",a.toString()).apply();}
 void navigate(String text){String u=text.trim();if(u.isEmpty())return;if(!u.contains("://"))u=u.contains(".")&&!u.contains(" ")?"https://"+u:"https://www.google.com/search?q="+Uri.encode(u);if(!safeUrl(u)){status.setText("Введите HTTPS-адрес сайта");return;}if(active==board)newTab(u,true);else active.loadUrl(u);}
 void newAddress(){EditText input=new EditText(this);input.setSingleLine();input.setHint("Сайт или поиск");new AlertDialog.Builder(this).setTitle("Новая вкладка").setView(input).setPositiveButton("Открыть",(d,i)->{show(board);navigate(input.getText().toString());}).setNegativeButton("Отмена",null).show();}
 void tabMenu(){new AlertDialog.Builder(this).setTitle("Вкладки").setMessage("Переключайте вкладки в верхней ленте. Долгое нажатие закрывает вкладку. Столы и файлы сохраняются на устройстве.").setPositiveButton("Новая вкладка",(d,i)->newAddress()).setNegativeButton("Готово",null).show();}
 void aiMenu(){String[] names={"ChatGPT","Gemini","Claude","DeepSeek"},urls={"https://chatgpt.com/","https://gemini.google.com/","https://claude.ai/","https://chat.deepseek.com/"};new AlertDialog.Builder(this).setTitle("Открыть сайт ИИ").setItems(names,(d,i)->{if(queuedFile!=null)queuedOrigin=origin(urls[i]);for(WebView w:tabs)if(origin(urls[i]).equals(origin(w.getUrl()))){show(w);return;}newTab(urls[i],true);}).setOnCancelListener(d->{queuedFile=null;queuedOrigin=null;}).show();}
 void back(){if(active!=board&&active.canGoBack())active.goBack();else if(active!=board)show(board);else super.onBackPressed();}
 @Override public void onBackPressed(){back();}
 void pick(int request){Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_ALLOW_MULTIPLE,request==PICK_BOARD);try{startActivityForResult(intent,request);}catch(Exception e){finishChooser(null);status.setText("На устройстве нет выбора файлов");}}
 @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(result!=RESULT_OK||data==null){if(request==PICK_CHAT)finishChooser(null);return;}ArrayList<Uri> uris=new ArrayList<>();if(data.getClipData()!=null)for(int i=0;i<data.getClipData().getItemCount();i++)uris.add(data.getClipData().getItemAt(i).getUri());else if(data.getData()!=null)uris.add(data.getData());if(request==PICK_CHAT){finishChooser(uris.toArray(new Uri[0]));return;}for(Uri uri:uris)importUri(uri);}
 void handleSharedIntent(){Intent intent=getIntent();if(intent==null)return;String action=intent.getAction();if(Intent.ACTION_SEND.equals(action)){Uri uri=intent.getParcelableExtra(Intent.EXTRA_STREAM);if(uri!=null)importUri(uri);}else if(Intent.ACTION_SEND_MULTIPLE.equals(action)){ArrayList<Uri> uris=intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);if(uris!=null)for(Uri uri:uris)importUri(uri);}setIntent(new Intent());}
 @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);if(boardReady)handleSharedIntent();}
 JSONArray files(){try{return new JSONArray(prefs.getString("files","[]"));}catch(Exception e){return new JSONArray();}}
 JSONObject file(String id)throws Exception{JSONArray a=files();for(int i=0;i<a.length();i++)if(id.equals(a.getJSONObject(i).getString("id")))return a.getJSONObject(i);throw new IOException("Файл не найден");}
 void importUri(Uri uri){if(!"content".equals(uri.getScheme())){status.setText("Выберите файл через системное меню");return;}status.setText("Добавляю файл на стол…");io.execute(()->{File out=null;try{
   String name="Файл";try(android.database.Cursor c=getContentResolver().query(uri,new String[]{OpenableColumns.DISPLAY_NAME},null,null,null)){if(c!=null&&c.moveToFirst())name=c.getString(0);}name=name.replaceAll("[\\\\/\\p{Cntrl}]","_");if(name.length()>150)name=name.substring(0,150);String id=UUID.randomUUID().toString();File dir=new File(getFilesDir(),"imports/"+id);if(!dir.mkdirs())throw new IOException("Не удалось создать папку");out=new File(dir,name);long size=0;
   try(InputStream in=getContentResolver().openInputStream(uri);OutputStream stream=new FileOutputStream(out)){if(in==null)throw new IOException("Нет данных");byte[] buffer=new byte[32768];int n;while((n=in.read(buffer))!=-1){size+=n;if(size>25L*1024*1024)throw new IOException("Максимум 25 МБ на файл в Preview");stream.write(buffer,0,n);}}
   JSONObject item=new JSONObject().put("id",id).put("name",name).put("path",id+"/"+name).put("mime",Objects.toString(getContentResolver().getType(uri),"application/octet-stream")).put("size",size);
   runOnUiThread(()->{JSONArray a=files();a.put(item);prefs.edit().putString("files",a.toString()).apply();show(board);refreshBoard();board.evaluateJavascript("window.addImported&&addImported("+item.toString()+")",null);status.setText("Файл сохранён на устройстве");});
  }catch(Exception e){if(out!=null)out.delete();runOnUiThread(()->status.setText("Не добавлено: "+e.getMessage()));}});}
 Uri fileUri(String id)throws Exception{JSONObject f=file(id);File base=new File(getFilesDir(),"imports");File path=new File(base,f.getString("path"));if(!path.getCanonicalPath().startsWith(base.getCanonicalPath()+File.separator)||!path.isFile())throw new IOException("Файл недоступен");return FileProvider.getUriForFile(this,getPackageName()+".files",path);}
 void finishChooser(Uri[] uris){if(fileCallback!=null){if(chooserOwner==null||!origin(chooserOwner.getUrl()).equals(chooserOrigin))uris=null;fileCallback.onReceiveValue(uris);}fileCallback=null;chooserOwner=null;chooserOrigin=null;}
 void deliverFile(String id){try{finishChooser(new Uri[]{fileUri(id)});}catch(Exception e){status.setText(e.getMessage());finishChooser(null);}}
 void chooseBoardFile(){JSONArray a=files();String[] labels=new String[a.length()];for(int i=0;i<a.length();i++)labels[i]=a.optJSONObject(i).optString("name");if(labels.length==0){status.setText("Сначала добавьте файл на стол");finishChooser(null);return;}new AlertDialog.Builder(this).setTitle("Файлы рабочего стола").setItems(labels,(d,i)->deliverFile(a.optJSONObject(i).optString("id"))).setOnCancelListener(d->finishChooser(null)).show();}
 void refreshBoard(){if(!boardReady)return;String raw=prefs.getString("layout","{}");board.evaluateJavascript("window.receiveNative&&receiveNative("+raw+","+files()+")",null);}
 void handleBoardMessage(JSONObject m)throws Exception{switch(m.getString("op")){
  case "ready":boardReady=true;refreshBoard();break;
  case "save":String value=m.getJSONObject("layout").toString();if(value.length()>500000)throw new IOException("Слишком большой стол");prefs.edit().putString("layout",value).apply();break;
  case "import":pick(PICK_BOARD);break;
  case "open":String id=m.getString("id");try{Intent i=new Intent(Intent.ACTION_VIEW).setDataAndType(fileUri(id),file(id).getString("mime")).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);startActivity(i);}catch(ActivityNotFoundException e){status.setText("Установите приложение для этого типа файла");}break;
  case "attach":queuedFile=m.getString("id");file(queuedFile);aiMenu();status.setText("Откройте чат и нажмите его кнопку прикрепления — файл со стола будет выбран");break;
  case "share":String fid=m.getString("id");Intent send=new Intent(Intent.ACTION_SEND).setType(file(fid).getString("mime")).putExtra(Intent.EXTRA_STREAM,fileUri(fid)).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);startActivity(Intent.createChooser(send,"Передать файл"));break;
  default:throw new IOException("Неизвестная команда");
 }}
 @Override protected void onDestroy(){finishChooser(null);io.shutdown();for(WebView w:tabs)w.destroy();if(board!=null)board.destroy();super.onDestroy();}
}
