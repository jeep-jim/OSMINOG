package com.osminog.vision;

import static org.junit.Assert.*;
import android.content.Context;
import android.content.SharedPreferences;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import org.json.*;
import org.junit.*;

public class CharacterClientTest {
 Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
 @Test public void sessionRefreshAndContentNeverStored()throws Exception{
  SharedPreferences prefs=context.getSharedPreferences("character-fixture",Context.MODE_PRIVATE);prefs.edit().clear().putString("token","a".repeat(43)).commit();
  List<String> calls=new CopyOnWriteArrayList<>();CountDownLatch done=new CountDownLatch(1);AtomicReference<String> event=new AtomicReference<>();
  CharacterClient client=new CharacterClient(prefs,(type,values)->{event.set(type);done.countDown();},(path,body,token)->{
   calls.add(path);
   if(path.equals("/v1/session"))return new JSONObject().put("token","b".repeat(43));
   if(token.equals("a".repeat(43)))throw new CharacterClient.Rejected("unauthorized");
   return new JSONObject().put("id","fixture-id").put("reply","Fixture reply");
  });
  try{client.ask(new JSONObject().put("id","fixture-id").put("consent",true).put("text","private-fixture-text"));assertTrue(done.await(5,TimeUnit.SECONDS));assertEquals("characterReply",event.get());assertEquals(Arrays.asList("/v1/chat","/v1/session","/v1/chat"),calls);assertEquals(1,prefs.getAll().size());assertFalse(prefs.getAll().toString().contains("private-fixture-text"));}finally{client.close();prefs.edit().clear().commit();}
 }
 @Test public void missingConsentNeverUsesTransport()throws Exception{
  CharacterClient client=new CharacterClient(context.getSharedPreferences("character-fixture",0),(type,values)->assertEquals("characterError",type),(p,b,t)->{fail("Transport must not run without consent");return null;});
  try{client.ask(new JSONObject().put("id","fixture-id").put("consent",false));}finally{client.close();}
 }
 @Test public void realDedicatedTlsAndSyntheticChat()throws Exception{
  // Only this explicitly synthetic prompt reaches the live gateway. No UI history,
  // camera, user identifier or real account is used by this test.
  CountDownLatch health=new CountDownLatch(1),reply=new CountDownLatch(1);AtomicReference<Boolean> available=new AtomicReference<>(false);AtomicReference<String> result=new AtomicReference<>();
  CharacterClient client=new CharacterClient(context,(type,values)->{
   Map<String,Object> data=new HashMap<>();for(int i=0;i+1<values.length;i+=2)data.put((String)values[i],values[i+1]);
   if(type.equals("characterReady")){available.set(Boolean.TRUE.equals(data.get("ready")));health.countDown();}
   if(type.equals("characterReply")||type.equals("characterError")){result.set(type);reply.countDown();}
  });
  try{client.check();assertTrue("Dedicated TLS health timeout",health.await(30,TimeUnit.SECONDS));assertTrue("Dedicated TLS trust/health failed",available.get());client.ask(new JSONObject().put("id","android-synthetic-"+UUID.randomUUID()).put("consent",true).put("text","Synthetic Android integration test. Reply with OK.").put("history",new JSONArray()).put("thoughts",new JSONArray()));assertTrue(reply.await(65,TimeUnit.SECONDS));assertEquals("characterReply",result.get());}finally{client.close();}
 }
}
