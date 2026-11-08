package com.osminog.vision;
import static org.junit.Assert.*;
import android.Manifest;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
public class CameraCaptureTest {
 @Test public void realFrameAttachesLocallyAndStopsOnPause()throws Exception{
  IntentUiTest fixture=new IntentUiTest();
  try{fixture.start();ReliableActivity a=fixture.a;InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission("com.osminog.vision",Manifest.permission.CAMERA);
   fixture.ui(a::startCamera);fixture.until(()->a.eye.capture!=null&&a.camera);
   fixture.js("document.getElementById('capture').click()");fixture.until(()->"true".equals(fixture.js("!!attachmentDraft&&attachmentDraft.type==='image/jpeg'")));
   assertEquals("0",fixture.js("data.messages.length"));
   fixture.scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED);fixture.until(()->!a.camera&&!a.eye.running);assertNull(a.eye.device);
  }finally{fixture.close();}
 }
}
