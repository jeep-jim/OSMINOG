package com.osminog.mobile;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import android.webkit.WebView;
import org.junit.*;
import org.junit.runner.RunWith;
import org.json.JSONObject;
import java.util.concurrent.*;
import static org.junit.Assert.*;
@RunWith(AndroidJUnit4.class)
public class WorkspaceTest {
 @Test public void localBoardPersistsAndRemoteTabsHaveNoBridge()throws Exception{
  try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
   String result="";
   for(int i=0;i<60;i++){CountDownLatch latch=new CountDownLatch(1);String[] value={""};scenario.onActivity(a->a.board.evaluateJavascript("typeof receiveNative",s->{value[0]=s;latch.countDown();}));assertTrue(latch.await(5,TimeUnit.SECONDS));result=value[0];if(result.contains("function"))break;Thread.sleep(250);}
   assertEquals("\"function\"",result);
   scenario.onActivity(a->{try{a.handleBoardMessage(new JSONObject("{\"op\":\"save\",\"layout\":{\"active\":\"main\",\"desks\":[{\"id\":\"main\",\"name\":\"Проверка\"}],\"items\":{}}}"));assertTrue(a.prefs.getString("layout","").contains("Проверка"));assertFalse(a.safeUrl("file:///etc/passwd"));assertFalse(a.safeUrl(MainActivity.ORIGIN+"/assets/mobile.html"));assertTrue(a.safeUrl("https://example.com/"));}catch(Exception e){throw new AssertionError(e);}});
   CountDownLatch latch=new CountDownLatch(1);String[] remote={""};scenario.onActivity(a->{WebView w=a.makeWeb(false);w.evaluateJavascript("typeof Osminog",s->{remote[0]=s;latch.countDown();w.destroy();});});assertTrue(latch.await(5,TimeUnit.SECONDS));assertEquals("\"undefined\"",remote[0]);
  }
 }
}
