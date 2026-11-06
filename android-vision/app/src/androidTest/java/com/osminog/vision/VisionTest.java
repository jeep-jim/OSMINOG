package com.osminog.vision;
import android.Manifest;import android.content.*;import android.graphics.Bitmap;import android.os.*;import android.webkit.*;
import androidx.test.core.app.ActivityScenario;import androidx.test.platform.app.InstrumentationRegistry;import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.*;import org.junit.runner.RunWith;import org.json.*;import java.io.*;import java.util.concurrent.*;import java.util.concurrent.atomic.*;
import static org.junit.Assert.*;
@RunWith(AndroidJUnit4.class)
public class VisionTest {
 MainActivity a;ActivityScenario<MainActivity> scenario;
 void ui(Runnable r){InstrumentationRegistry.getInstrumentation().runOnMainSync(r);}
 String eval(WebView w,String js)throws Exception{CountDownLatch l=new CountDownLatch(1);AtomicReference<String> out=new AtomicReference<>("");ui(()->w.evaluateJavascript(js,s->{out.set(s);l.countDown();}));assertTrue("JS callback timeout",l.await(8,TimeUnit.SECONDS));return out.get();}
 void until(Callable<Boolean> condition)throws Exception{long end=System.currentTimeMillis()+20000;while(System.currentTimeMillis()<end){if(condition.call())return;Thread.sleep(200);}fail("Condition timed out");}
 @Before public void setup()throws Exception{InstrumentationRegistry.getInstrumentation().getTargetContext().getSharedPreferences("vision",0).edit().clear().commit();scenario=ActivityScenario.launch(MainActivity.class);scenario.onActivity(x->a=x);until(()->"true".equals(eval(a.shell,"!!window.OSMINOG && document.getElementById('privacy').textContent.includes('0.1.0')")));eval(a.shell,"localStorage.clear();document.getElementById('messages').replaceChildren()");}
 @After public void tearDown(){if(scenario!=null)scenario.close();}
 @Test public void shellAndSafeUpdateMetadata()throws Exception{
  assertEquals("true",eval(a.shell,"document.getElementById('camera').getAttribute('aria-label')==='Показать мир' && document.getElementById('voice').getAttribute('aria-label')==='Включить разговор'"));
  assertEquals("true",eval(a.shell,"document.querySelectorAll('textarea').length===1 && !!document.getElementById('ocean') && !!window.OSMINOG_FIGMA_ASSETS?.jellyfish && document.querySelector('.brand-mark rect[fill=\"#ff2929\"]')!==null"));
  assertEquals("true",eval(a.shell,"getComputedStyle(document.getElementById('ocean')).backgroundImage.includes('radial-gradient')"));
  assertFalse(Updater.assetUrl("http://github.com/jeep-jim/OSMINOG-Releases/releases/download/vision-android-v0.1/a.apk"));
  assertFalse(Updater.assetUrl("https://github.com.evil.invalid/jeep-jim/OSMINOG-Releases/releases/download/vision-android-v0.1/a.apk"));
  assertFalse(Updater.assetUrl("https://github.com/evil/app/releases/download/vision-android-v0.1/a.apk"));
  assertTrue(Updater.assetUrl("https://github.com/jeep-jim/OSMINOG-Releases/releases/download/vision-android-v0.1.0/OSMINOG.apk"));
  JSONObject meta=new JSONObject().put("schema","osminog-android-update/v1").put("applicationId","evil.app");boolean rejected=false;try{Updater.validate(meta,1);}catch(Exception e){rejected=true;}assertTrue(rejected);
  assertEquals("\"undefined\"",eval(a.provider,"typeof Osminog"));
 }
 String fixture(){return "<!doctype html><meta name='viewport' content='width=device-width, initial-scale=1'><main id='messages'></main><form style='position:fixed;bottom:0;left:0;width:100%;height:150px'><div id='preview'></div><input type='file' accept='image/*'><textarea style='width:90%;height:60px' id='prompt-textarea'></textarea><button type='submit' data-testid='send-button'>Send</button></form><script>document.querySelector('input').onchange=e=>{const img=document.createElement('img');img.src=URL.createObjectURL(e.target.files[0]);img.width=30;img.height=30;document.getElementById('preview').append(img)};document.querySelector('form').onsubmit=e=>{e.preventDefault();const t=document.querySelector('textarea');const u=document.createElement('div');u.dataset.messageAuthorRole='user';u.textContent=t.value;document.getElementById('messages').append(u);t.value='';const a=document.createElement('div');a.dataset.messageAuthorRole='assistant';a.textContent='Тестовый ответ из веб-чата';document.getElementById('messages').append(a);document.getElementById('preview').replaceChildren()};</script>";}
 void loadFixture()throws Exception{ui(()->{a.selected=0;WebViewClient client=a.provider.getWebViewClient();a.provider.setWebViewClient(new WebViewClient(){
   @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest request){String path=request.getUrl().getPath();String html="/".equals(path)?fixture():"";return new WebResourceResponse("text/html","UTF-8",new ByteArrayInputStream(html.getBytes(java.nio.charset.StandardCharsets.UTF_8)));}
   @Override public void onPageFinished(WebView v,String url){client.onPageFinished(v,url);}
  });a.provider.loadUrl("https://chatgpt.com/");});
  until(()->"true".equals(eval(a.provider,"!!document.getElementById('prompt-textarea')")));ui(()->a.returnToShell());
  try{until(()->"true".equals(eval(a.provider,"!!window.OSMINOGMobileBridge?.probe().ready")));}catch(AssertionError error){throw new AssertionError("Fixture connection: "+eval(a.provider,"JSON.stringify({url:location.href,ready:document.readyState,bridge:typeof OSMINOGMobileBridge,probe:window.OSMINOGMobileBridge?.probe(),box:document.getElementById('prompt-textarea')?.getBoundingClientRect().toJSON()})"),error);}
  ui(()->{a.connected=true;a.emit("connected","ok",true,"provider","Fixture");});Thread.sleep(300);}
 @Test public void realWebViewTransportWithFrameAndConversation()throws Exception{loadFixture();
  eval(a.shell,"document.getElementById('text').value='Привет';document.getElementById('composer').requestSubmit()");
  until(()->"true".equals(eval(a.shell,"JSON.parse(localStorage.getItem('osminogVisionHistory')||'[]').some(x=>x.role==='assistant')")));
  assertEquals("true",eval(a.shell,"JSON.parse(localStorage.getItem('osminogVisionHistory')).some(x=>x.role==='assistant')"));
  ByteArrayOutputStream jpeg=new ByteArrayOutputStream();Bitmap bitmap=Bitmap.createBitmap(16,16,Bitmap.Config.ARGB_8888);bitmap.eraseColor(0xffcc8833);bitmap.compress(Bitmap.CompressFormat.JPEG,75,jpeg);bitmap.recycle();String frame="data:image/jpeg;base64,"+android.util.Base64.encodeToString(jpeg.toByteArray(),android.util.Base64.NO_WRAP);
  JSONObject req=new JSONObject().put("id","test-frame").put("text","Кадр теста").put("image",frame);
  assertEquals("true",eval(a.provider,"window.OSMINOGMobileBridge.start("+req+")"));
  until(()->"true".equals(eval(a.provider,"window.OSMINOGMobileBridge.snapshot().state==='done'")));
  assertEquals("true",eval(a.provider,"window.OSMINOGMobileBridge.snapshot().frameAccepted"));
  assertEquals("\"Тестовый ответ из веб-чата\"",eval(a.provider,"window.OSMINOGMobileBridge.snapshot().text"));
  eval(a.provider,"document.getElementById('prompt-textarea').value='неотправленный черновик'");
  eval(a.provider,"window.OSMINOGMobileBridge.start({id:'draft',text:'Не стирать'})");
  until(()->"true".equals(eval(a.provider,"window.OSMINOGMobileBridge.snapshot().state==='error'")));
  assertEquals("\"неотправленный черновик\"",eval(a.provider,"document.getElementById('prompt-textarea').value"));
 }
 @Test public void nativeCameraFrameAndLifecycleStop()throws Exception{
  InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission("com.osminog.vision",Manifest.permission.CAMERA);
  ui(()->{a.connected=true;a.cameraOn();});until(()->a.eye.capture!=null);
  CountDownLatch latch=new CountDownLatch(1);AtomicReference<String> image=new AtomicReference<>(),error=new AtomicReference<>();ui(()->a.eye.frame((d,e)->{image.set(d);error.set(e);latch.countDown();}));assertTrue(latch.await(8,TimeUnit.SECONDS));assertNull(error.get());assertTrue(image.get().startsWith("data:image/jpeg;base64,"));assertTrue(image.get().length()>100);
  scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED);until(()->!a.eye.running&&!a.camera&&!a.voice);assertNull(a.eye.device);assertNull(a.eye.reader);
 }
}
