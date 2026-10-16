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
   scenario.onActivity(a->{try{java.io.File dir=new java.io.File(a.getFilesDir(),"imports/source");dir.mkdirs();java.io.File f=new java.io.File(dir,"Документ.txt");try(java.io.FileOutputStream out=new java.io.FileOutputStream(f)){out.write("Проверка файла".getBytes(java.nio.charset.StandardCharsets.UTF_8));}a.importUri(androidx.core.content.FileProvider.getUriForFile(a,a.getPackageName()+".files",f));}catch(Exception e){throw new AssertionError(e);}});
   final int[] count={0};for(int i=0;i<60;i++){scenario.onActivity(a->count[0]=a.files().length());if(count[0]>0)break;Thread.sleep(100);}assertTrue(count[0]>0);
   CountDownLatch upload=new CountDownLatch(1);scenario.onActivity(a->{try{String id=a.files().getJSONObject(0).getString("id");a.chooserOwner=a.board;a.chooserOrigin=a.origin(a.board.getUrl());a.fileCallback=uris->{assertNotNull(uris);assertEquals(1,uris.length);try(java.io.InputStream in=a.getContentResolver().openInputStream(uris[0])){assertNotNull(in);assertTrue(in.read()!=-1);}catch(Exception e){throw new AssertionError(e);}upload.countDown();};a.deliverFile(id);}catch(Exception e){throw new AssertionError(e);}});assertTrue(upload.await(5,TimeUnit.SECONDS));
   CountDownLatch latch=new CountDownLatch(1);String[] remote={""};scenario.onActivity(a->{WebView w=a.makeWeb(false);w.evaluateJavascript("typeof Osminog",s->{remote[0]=s;latch.countDown();w.destroy();});});assertTrue(latch.await(5,TimeUnit.SECONDS));assertEquals("\"undefined\"",remote[0]);
  }
 }
}
