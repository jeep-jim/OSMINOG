package com.osminog.vision;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.os.Build;
import android.os.SystemClock;
import android.view.View;
import android.webkit.WebView;
import android.widget.TextView;
import org.json.JSONObject;
import java.util.ArrayDeque;

/** One explicit question, one visible provider, one submission. No account or
 * message data is placed in diagnostics. Readiness is checked at send time. */
final class ForegroundTransport {
 private final ReliableActivity a;
 private final TextView status;
 private final ArrayDeque<String> events=new ArrayDeque<>();
 private String activeId="",lastStage="idle";
 private int generation=0;
 private boolean waiting=false;
 ForegroundTransport(ReliableActivity activity){
  a=activity;status=new TextView(a);status.setTextColor(0xffd9efff);status.setTextSize(14);
  status.setPadding(a.dp(16),a.dp(4),a.dp(16),a.dp(10));status.setVisibility(View.GONE);
  a.providerPanel.addView(status,1);
 }
 private void stage(String code,String label){
  if(!code.equals(lastStage)){lastStage=code;events.addLast(SystemClock.elapsedRealtime()+" "+code);while(events.size()>24)events.removeFirst();}
  status.setText(label);a.emit("transportStage","message",label);
 }
 void ask(JSONObject message){
  String id=message.optString("id"),text=message.optString("text").trim();
  if(!id.matches("m-[0-9]+")||text.isEmpty()||text.length()>12000)return;
  if(waiting||!activeId.isEmpty()||!a.currentRequest.isEmpty()){
   a.emit("error","id",id,"message","Предыдущий вопрос ещё обрабатывается. Повторная отправка остановлена.");return;
  }
  activeId=id;waiting=true;final int token=++generation;final int epoch=a.epoch;
  // The real chat stays active until the reply completes. Do not pretend the
  // hidden site's field is a live connection or dispatch a second question.
  a.providerPanel.setVisibility(View.VISIBLE);a.provider.setVisibility(View.VISIBLE);
  a.shell.setVisibility(View.INVISIBLE);status.setVisibility(View.VISIBLE);
  // Do not hide/destroy an enabled camera TextureView before eye.frame():
  // SurfaceTexture destruction closes the camera and aborts the pending frame.
  a.provider.onResume();a.provider.resumeTimers();a.provider.requestFocus();
  stage("loading","Проверяю чат. Вопрос ещё не отправлен.");a.ensureProviderLoaded();
  a.handler.postDelayed(()->{if(valid(token,epoch))fail(id,"renderer_timeout","Страница чата не ответила. Вопрос не отправлен. Открой диагностику подключения в звезде.");},32000);
  prepare(message,token,epoch,SystemClock.elapsedRealtime());
 }
 private boolean valid(int token,int epoch){return waiting&&token==generation&&epoch==a.epoch&&a.foreground&&!a.isDestroyed();}
 private void prepare(JSONObject message,int token,int epoch,long started){
  if(!valid(token,epoch))return;
  if(SystemClock.elapsedRealtime()-started>30000){
   fail(message.optString("id"),"ready_timeout","Чат не предоставил поле ввода. Открой сервис и заверши вход или проверку сайта. Вопрос не отправлен; диагностика доступна в звезде.");return;
  }
  if(!a.chatOrigin(a.provider.getUrl())){
   stage("awaiting_site","Открывается сайт или страница входа. Вопрос не отправлен.");
   a.handler.postDelayed(()->prepare(message,token,epoch,started),500);return;
  }
  String script="(()=>{try{"+a.providerScript()+";return JSON.stringify(window.OSMINOGMobileBridge?.probe()||{missing:true});}catch(e){return JSON.stringify({bridgeError:e.name||'Error'});}})()";
  a.provider.evaluateJavascript(script,raw->{
   if(!valid(token,epoch))return;JSONObject probe=MainActivity.decode(raw);
   if(probe.has("bridgeError")){fail(message.optString("id"),"adapter_script_error","Не запустился адаптер чата. Вопрос не отправлен. Открой диагностику подключения в звезде.");return;}
   if(probe.optBoolean("ready")){
    waiting=false;a.connected=true;a.connection();stage("editor_ready","Передаю вопрос через редактор сайта…");
    a.legacyAsk(message);
    a.handler.postDelayed(()->{if(token==generation&&activeId.equals(message.optString("id"))&&!a.isDestroyed())a.error("Страница не завершила ответ. Запрос повторно не отправлялся; проверь чат сервиса.");},180000);
    return;
   }
   stage(probe.optBoolean("missing")?"adapter_missing":"awaiting_editor","Ожидаю редактор сайта. Вопрос ещё не отправлен.");
   a.handler.postDelayed(()->prepare(message,token,epoch,started),500);
  });
 }
 private void fail(String id,String code,String message){
  stage(code,message);waiting=false;activeId="";generation++;showShell();
  a.emit("error","id",id,"message",message);
 }
 private void showShell(){status.setVisibility(View.GONE);a.shell.setVisibility(View.VISIBLE);a.restoreShellFocus();}
 void event(String type,Object... values){
  // Only explicit transport event categories are stored, never error text,
  // prompt/reply contents, URLs, cookies or account identifiers.
  if(activeId.isEmpty())return;
  String id="";for(int i=0;i+1<values.length;i+=2)if("id".equals(values[i]))id=String.valueOf(values[i+1]);
  if(!id.equals(activeId))return;
  if("sent".equals(type))stage("sent","Вопрос отправлен. Ответ появится в OSMINOG.");
  else if("partial".equals(type))stage("answering","Получаю ответ…");
  else if("answer".equals(type)||"error".equals(type)){
   stage("answer".equals(type)?"completed":"transport_error","answer".equals(type)?"Ответ получен":"Не удалось завершить обмен");
   activeId="";waiting=false;generation++;showShell();
  }
 }
 void userReturn(){
  if(activeId.isEmpty())return;String id=activeId;cancel();a.cancelRequest();
  a.emit("error","id",id,"message","Ожидание остановлено. Проверь чат перед повторной отправкой: вопрос мог быть отправлен.");
 }
 void cancel(){if(!activeId.isEmpty()){stage("cancelled","Ожидание остановлено");activeId="";waiting=false;generation++;status.setVisibility(View.GONE);}}
 String report(){
  PackageInfo web=WebView.getCurrentWebViewPackage();StringBuilder out=new StringBuilder("OSMINOG Vision · локальная диагностика\n");
  out.append("app=").append(a.version()).append(" android=").append(Build.VERSION.SDK_INT).append('\n');
  out.append("webview=").append(web==null?"unknown":web.packageName+" "+web.versionName).append('\n');
  out.append("provider=").append(MainActivity.NAMES[a.selected]).append(" sameOrigin=").append(a.chatOrigin(a.provider.getUrl())).append('\n');
  out.append("editorReady=").append(a.connected).append(" exchangeVerified=").append(a.transportVerified).append(" stage=").append(lastStage).append('\n');
  for(String event:events)out.append(event).append('\n');
  out.append("Без текста переписки, паролей, cookies и адреса разговора.");return out.toString();
 }
 void shareReport(){
  Intent share=new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT,report());
  a.startActivity(Intent.createChooser(share,"Поделиться диагностикой OSMINOG"));
 }
}
