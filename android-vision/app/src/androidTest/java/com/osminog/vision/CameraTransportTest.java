package com.osminog.vision;

import static org.junit.Assert.*;
import android.Manifest;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;

/** The existing WebView fixture confirms an actual Camera2 frame before sending
 * through the foreground native transport. No external service is contacted. */
public class CameraTransportTest {
 @Test public void enabledCameraSurvivesForegroundQuestion()throws Exception{
  VisionTest fixture=new VisionTest();
  try{
   fixture.setup();fixture.loadFixture();ReliableActivity a=fixture.a;
   InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission("com.osminog.vision",Manifest.permission.CAMERA);
   fixture.ui(()->a.cameraOn());fixture.until(()->a.eye.capture!=null);
   fixture.until(()->"true".equals(fixture.eval(a.shell,"!document.getElementById('cameraArea').hidden")));
   fixture.eval(a.shell,"document.getElementById('text').value='Проверь кадр';document.getElementById('composer').requestSubmit()");
   fixture.until(()->a.transportVerified&&a.frameSent&&a.requestSent);
   assertEquals("true",fixture.eval(a.provider,"document.querySelectorAll('[data-message-author-role=user]').length===1"));
   assertEquals("true",fixture.eval(a.shell,"document.querySelector('.message.assistant')?.textContent.includes('Тестовый ответ')||false"));
   assertTrue(a.camera);assertTrue(a.eye.running);assertNotNull(a.eye.device);
   fixture.scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED);
   fixture.until(()->!a.camera&&!a.eye.running);assertNull(a.eye.device);
  }finally{fixture.tearDown();}
 }
}
