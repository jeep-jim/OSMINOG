package com.osminog.vision;
import static org.junit.Assert.*;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
public class OceanTest {
 @Test public void localShellLoadsWithoutThirdPartyProvider()throws Exception{
  try(ActivityScenario<MainActivity> s=ActivityScenario.launch(MainActivity.class)){
   AtomicReference<MainActivity> a=new AtomicReference<>();s.onActivity(a::set);long until=System.currentTimeMillis()+15000;String result="";
   while(System.currentTimeMillis()<until){CountDownLatch done=new CountDownLatch(1);AtomicReference<String> value=new AtomicReference<>();InstrumentationRegistry.getInstrumentation().runOnMainSync(()->a.get().shell.evaluateJavascript("JSON.stringify({composer:!!document.getElementById('composer'),attach:!!document.getElementById('attach'),provider:!!window.OSMINOGMobileBridge})",v->{value.set(v);done.countDown();}));assertTrue(done.await(3,TimeUnit.SECONDS));result=value.get();if(result!=null&&result.contains("composer\\\":true"))break;Thread.sleep(200);}
   assertTrue(result,result.contains("composer\\\":true"));assertTrue(result,result.contains("attach\\\":true"));assertTrue(result,result.contains("provider\\\":false"));
  }
 }
 @Test public void trustedOriginAndAssetBoundaries(){assertTrue(MainActivity.owned("https://osminog.red/api/session"));assertFalse(MainActivity.owned("https://osminog.red.evil.example/"));assertFalse(MainActivity.owned("http://osminog.red/"));assertFalse(MainActivity.owned("https://user@osminog.red/"));assertNull(MainActivity.localAsset("/api/session"));assertNull(MainActivity.localAsset("/design/../../secret.svg"));assertEquals("index.html",MainActivity.localAsset("/"));}
 @Test public void updateUrlBoundaries(){assertTrue(Updater.assetUrl("https://github.com/jeep-jim/OSMINOG-Releases/releases/download/vision-android-v0.3.0/OSMINOG.apk"));assertFalse(Updater.assetUrl("https://evil.example/app.apk"));}
}
