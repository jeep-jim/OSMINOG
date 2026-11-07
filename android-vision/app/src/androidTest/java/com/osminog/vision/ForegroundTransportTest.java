package com.osminog.vision;

import static org.junit.Assert.*;
import android.os.SystemClock;
import android.view.View;
import android.webkit.*;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.ByteArrayInputStream;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.junit.*;

/** Regressions for stale readiness and trusted click, plus an explicitly
 * read-only public-page diagnostic. Fixtures are NOT personal-account tests. */
public class ForegroundTransportTest {
 ActivityScenario<ReliableActivity> scenario;ReliableActivity a;
 void ui(Runnable r){InstrumentationRegistry.getInstrumentation().runOnMainSync(r);}
 String eval(WebView w,String script)throws Exception{CountDownLatch done=new CountDownLatch(1);AtomicReference<String> value=new AtomicReference<>();ui(()->w.evaluateJavascript(script,x->{value.set(x);done.countDown();}));assertTrue(done.await(8,TimeUnit.SECONDS));return value.get();}
 void until(Callable<Boolean> check)throws Exception{long end=SystemClock.uptimeMillis()+25000;while(SystemClock.uptimeMillis()<end){if(check.call())return;Thread.sleep(200);}fail("Condition timed out");}
 @Before public void setup()throws Exception{
  InstrumentationRegistry.getInstrumentation().getTargetContext().getSharedPreferences("vision",0).edit().clear().putBoolean("disableProviderWarmupForTest",true).commit();
  scenario=ActivityScenario.launch(ReliableActivity.class);scenario.onActivity(x->a=x);
  until(()->"true".equals(eval(a.shell,"!!window.OSMINOG?.nativeReady")));
  eval(a.shell,"OSMINOG.receive({type:'clear'})");
 }
 @After public void close(){if(scenario!=null)scenario.close();}
 String fixture(boolean editor){return "<!doctype html><meta name='viewport' content='width=device-width, initial-scale=1'><main id='messages'></main>"+(editor?"<form style='position:fixed;bottom:0;width:90%;height:150px'><div contenteditable='true' id='prompt-textarea' role='textbox' style='height:70px;background:#ddd;white-space:pre-wrap'></div><button type='submit' data-testid='send-button' style='width:180px;height:60px'>Send</button></form>":"")+"<script>window.sent=0;window.trustedInput=0;window.trustedClick=0;window.model='';document.execCommand=()=>false;const field=document.getElementById('prompt-textarea');if(field){field.oninput=e=>{if(e.isTrusted){model=field.innerText;trustedInput++}};document.querySelector('button').onclick=e=>{if(e.isTrusted)trustedClick++};document.querySelector('form').onsubmit=e=>{e.preventDefault();if(!model.trim()||!trustedClick)return;sent++;const u=document.createElement('div');u.dataset.messageAuthorRole='user';u.textContent=model;messages.append(u);const answer=document.createElement('div');answer.dataset.messageAuthorRole='assistant';answer.textContent='Ответ на '+model;messages.append(answer);field.textContent='';model=''}};</script>";}
 void load(boolean editor)throws Exception{
  ui(()->{WebViewClient client=a.provider.getWebViewClient();a.provider.setWebViewClient(new WebViewClient(){
   @Override public WebResourceResponse shouldInterceptRequest(WebView w,WebResourceRequest r){return new WebResourceResponse("text/html","UTF-8",new ByteArrayInputStream(fixture(editor).getBytes(java.nio.charset.StandardCharsets.UTF_8)));}
   @Override public void onPageFinished(WebView w,String url){client.onPageFinished(w,url);}
  });a.provider.loadUrl("https://chatgpt.com/");});
  until(()->"true".equals(eval(a.provider,"!!window.OSMINOGMobileBridge")));
 }
 @Test public void staleDisconnectedStateDoesNotBlockTrustedForegroundExchange()throws Exception{
  load(true);ui(()->{a.connected=false;a.emit("connected","ok",false,"providerId","0");});
  eval(a.shell,"document.getElementById('text').value='Тут?\\nПроверка'.replace('\\\\n','\\n');document.getElementById('composer').requestSubmit()");
  until(()->"true".equals(eval(a.provider,"sent===1")));
  assertEquals(View.INVISIBLE,a.shell.getVisibility());
  assertEquals("true",eval(a.provider,"trustedInput>0&&trustedClick===1"));
  until(()->a.transportVerified&&a.shell.getVisibility()==View.VISIBLE);
  assertEquals("true",eval(a.shell,"document.querySelector('.message.assistant').textContent.includes('Ответ на')"));
  assertFalse(a.foregroundTransport.report().contains("Тут?"));
  assertFalse(a.foregroundTransport.report().contains("Проверка"));
  Thread.sleep(700);assertEquals("1",eval(a.provider,"sent"));
 }
 @Test public void cancelBeforeEditorDoesNotSubmitLater()throws Exception{
  load(false);
  eval(a.shell,"document.getElementById('text').value='Сохранить мой вопрос';document.getElementById('composer').requestSubmit()");
  until(()->a.shell.getVisibility()==View.INVISIBLE);
  ui(()->a.returnToShell());
  until(()->"true".equals(eval(a.shell,"document.getElementById('text').value==='Сохранить мой вопрос'")));
  Thread.sleep(800);assertEquals("0",eval(a.provider,"sent"));assertTrue(a.currentRequest.isEmpty());
 }
 @Test public void existingDraftRemainsUntouchedInForeground()throws Exception{
  load(true);eval(a.provider,"document.getElementById('prompt-textarea').textContent='Личный черновик'");
  eval(a.shell,"document.getElementById('text').value='Новый вопрос';document.getElementById('composer').requestSubmit()");
  until(()->"true".equals(eval(a.shell,"document.getElementById('text').value==='Новый вопрос'&&!document.getElementById('notice').hidden")));
  assertEquals("\"Личный черновик\"",eval(a.provider,"document.getElementById('prompt-textarea').textContent"));assertEquals("0",eval(a.provider,"sent"));
 }
 @Test public void livePublicPageReadOnlyDiagnostic()throws Exception{
  // Fresh CI emulator; no owner credentials, no prompt or image is sent.
  ui(()->{a.openProvider();a.provider.loadUrl("https://chatgpt.com/");});
  long deadline=SystemClock.uptimeMillis()+25000;String raw="{}";
  while(SystemClock.uptimeMillis()<deadline){
   raw=eval(a.provider,"JSON.stringify({documentState:document.readyState,bridge:!!window.OSMINOGMobileBridge,ready:!!window.OSMINOGMobileBridge?.probe().ready})");
   if(MainActivity.decode(raw).optBoolean("ready"))break;Thread.sleep(800);
  }
  System.out.println("LIVE_PUBLIC_PAGE_READ_ONLY_NOT_ACCOUNT_VERIFICATION "+raw);
  System.out.println(a.foregroundTransport.report());
  try(java.io.FileOutputStream out=new java.io.FileOutputStream(new java.io.File(a.getExternalFilesDir(null),"live-public-probe.json"))){out.write(raw.getBytes(java.nio.charset.StandardCharsets.UTF_8));}
  assertFalse(a.requestSent);assertTrue(a.currentRequest.isEmpty());
 }
}
