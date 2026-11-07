package com.osminog.vision;

import static org.junit.Assert.*;
import android.os.SystemClock;
import android.webkit.*;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.ByteArrayInputStream;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.junit.*;

/** Regression for the owner's 0.2.2 composer failure, not a live account test. */
public class LauncherTest {
 ActivityScenario<ReliableActivity> scenario;ReliableActivity a;
 void ui(Runnable r){InstrumentationRegistry.getInstrumentation().runOnMainSync(r);}
 String eval(WebView w,String script)throws Exception{CountDownLatch done=new CountDownLatch(1);AtomicReference<String> value=new AtomicReference<>();ui(()->w.evaluateJavascript(script,x->{value.set(x);done.countDown();}));assertTrue(done.await(8,TimeUnit.SECONDS));return value.get();}
 void until(Callable<Boolean> check)throws Exception{long end=SystemClock.uptimeMillis()+25000;while(SystemClock.uptimeMillis()<end){if(check.call())return;Thread.sleep(200);}fail("Condition timed out");}
 @Before public void setup()throws Exception{
  InstrumentationRegistry.getInstrumentation().getTargetContext().getSharedPreferences("vision",0).edit().clear().putBoolean("disableProviderWarmupForTest",true).commit();
  scenario=ActivityScenario.launch(ReliableActivity.class);scenario.onActivity(x->a=x);
  until(()->"true".equals(eval(a.shell,"!!window.OSMINOG?.nativeReady")));
  eval(a.shell,"localStorage.setItem('osminogMotion','off');document.body.classList.add('motion-off');OSMINOG.receive({type:'clear'})");
 }
 @After public void close(){if(scenario!=null)scenario.close();}
 String fixture(boolean nativeOnly){return "<!doctype html><meta name='viewport' content='width=device-width, initial-scale=1'><main id='messages'></main><form style='position:fixed;bottom:0;width:100%;height:140px'><textarea id='mirror' style='width:90%;height:0;opacity:0'></textarea><div id='prompt-textarea' contenteditable='true' role='textbox' style='width:90%;height:70px;white-space:pre-wrap'></div><button type='submit' data-testid='send-button'>Send</button></form><script>let model='';window.sent=0;window.trusted=0;const field=document.getElementById('prompt-textarea');field.oninput=e=>{model=field.innerText;if(e.isTrusted)trusted++};document.querySelector('form').onsubmit=e=>{e.preventDefault();if(!model.trim())return;sent++;let u=document.createElement('div');u.dataset.messageAuthorRole='user';u.textContent=model;document.getElementById('messages').append(u);let a=document.createElement('div');a.dataset.messageAuthorRole='assistant';a.textContent='Ответ на: '+model;document.getElementById('messages').append(a);field.textContent='';model=''};"+(nativeOnly?"document.execCommand=()=>true;":"")+"</script>";}
 void load(boolean nativeOnly)throws Exception{
  ui(()->{WebViewClient client=a.provider.getWebViewClient();a.provider.setWebViewClient(new WebViewClient(){
   @Override public WebResourceResponse shouldInterceptRequest(WebView w,WebResourceRequest r){return new WebResourceResponse("text/html","UTF-8",new ByteArrayInputStream(fixture(nativeOnly).getBytes(java.nio.charset.StandardCharsets.UTF_8)));}
   @Override public void onPageFinished(WebView w,String url){client.onPageFinished(w,url);}
  });a.provider.loadUrl("https://chatgpt.com/");});
  until(()->"true".equals(eval(a.provider,"!!window.OSMINOGMobileBridge?.probe().ready")));ui(()->a.returnToShell());
  until(()->"true".equals(eval(a.shell,"document.getElementById('connectionStatus').textContent.includes('отправка ещё не проверена')")));
 }
 @Test public void nativeInputReachesRichEditorModelBehindShell()throws Exception{
  load(true);
  eval(a.shell,"document.getElementById('text').value='Ну как ты?\\nТут?';document.getElementById('composer').requestSubmit()");
  try{until(()->"true".equals(eval(a.shell,"document.querySelector('.message.assistant')?.textContent.includes('Ответ на:')||false")));}
  catch(AssertionError e){throw new AssertionError("Native input state: "+eval(a.provider,"JSON.stringify({state:OSMINOGMobileBridge.snapshot(),draft:document.getElementById('prompt-textarea').innerText,model,trusted,sent,focused:document.activeElement?.id})"),e);}
  assertEquals("1",eval(a.provider,"sent"));assertEquals("true",eval(a.provider,"trusted>0"));
  assertEquals("true",eval(a.provider,"document.querySelector('[data-message-author-role=user]').textContent==='Ну как ты?\\nТут?'"));
  // A partial answer is not a verified completed exchange; wait for completion.
  until(()->"true".equals(eval(a.shell,"document.getElementById('connectionStatus').textContent.includes('обмен сообщениями проверен')&&document.querySelector('.message.assistant')?.dataset.streaming!=='true'")));
  assertTrue(a.transportVerified);
  assertEquals(android.view.View.VISIBLE,a.shell.getVisibility());
 }
 @Test public void externalDraftIsNotOverwrittenAndLocalQuestionIsRestored()throws Exception{
  load(false);eval(a.provider,"document.getElementById('prompt-textarea').textContent='Мой личный черновик'");
  eval(a.shell,"document.getElementById('text').value='Мой новый вопрос';document.getElementById('composer').requestSubmit()");
  until(()->"true".equals(eval(a.shell,"document.getElementById('text').value==='Мой новый вопрос'&&!document.getElementById('notice').hidden")));
  assertEquals("\"Мой личный черновик\"",eval(a.provider,"document.getElementById('prompt-textarea').textContent"));assertEquals("0",eval(a.provider,"sent"));assertFalse(a.transportVerified);
 }
 @Test public void launcherPickerAndCustomOriginAreBounded()throws Exception{
  eval(a.shell,"OSMINOG.receive({type:'providerPicker'})");
  assertEquals("true",eval(a.shell,"JSON.stringify(Array.from(document.querySelectorAll('#providerOptions button')).map(b=>b.firstChild.textContent))===JSON.stringify(['ChatGPT','Grok','DeepSeek'])"));
  assertEquals("true",eval(a.shell,"(()=>{const r=document.querySelector('.provider-sheet-card').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()"));
  assertEquals("https://example.com/chat",MainActivity.normalizeProviderUrl("example.com/chat?token=secret#fragment"));
  assertEquals("",MainActivity.normalizeProviderUrl("javascript:alert(1)"));assertEquals("",MainActivity.normalizeProviderUrl("https://user:pass@example.com"));assertEquals("",MainActivity.normalizeProviderUrl("http://example.com"));
  ui(()->{a.prefs.edit().putString("customProviderUrl","https://example.com/chat").commit();a.selected=6;assertTrue(a.chatOrigin("https://example.com/chat/one"));assertFalse(a.chatOrigin("https://example.com.evil.invalid"));assertFalse(a.chatOrigin("https://other.example"));assertTrue(a.providerId().startsWith("custom:"));assertEquals(android.graphics.Color.TRANSPARENT,a.getWindow().getNavigationBarColor());if(android.os.Build.VERSION.SDK_INT>=29)assertFalse(a.getWindow().isNavigationBarContrastEnforced());});
 }
}
