package com.osminog.vision;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.os.SystemClock;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputConnection;
import android.view.inputmethod.InputMethodManager;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import org.json.JSONObject;

/** Native editor input for a covered WebView, never a bridge exposed to websites.
 * Called only for an explicit pending user question on the selected HTTPS origin.
 * The DOM adapter owns draft checks, selection and one-shot submit correlation. */
final class NativeComposer {
 static void execute(MainActivity a,String id,String action,int epoch,Consumer<Boolean> done) {
  BooleanSupplier valid=()->a.foreground&&!a.isDestroyed()&&a.epoch==epoch&&id.equals(a.currentRequest)&&a.chatOrigin(a.provider.getUrl());
  if(!valid.getAsBoolean()){done.accept(false);return;}
  a.provider.setFocusableInTouchMode(true);a.provider.requestFocus();
  String call="JSON.stringify(window.OSMINOGMobileBridge?.prepareNative("+JSONObject.quote(id)+","+JSONObject.quote(action)+")||{})";
  a.provider.evaluateJavascript(call,raw->{
   JSONObject request=MainActivity.decode(raw);
   if(!valid.getAsBoolean()||!request.optBoolean("ok")){done.accept(false);return;}
   if(request.optBoolean("tap")){tap(a,request,valid,done);return;}
   // Let Chromium install the focused editor's InputConnection before committing.
   InputMethodManager ime=(InputMethodManager)a.getSystemService(Context.INPUT_METHOD_SERVICE);
   if(ime!=null)ime.restartInput(a.provider);
   a.handler.postDelayed(()->connect(a,id,epoch,action,request.optString("text"),valid,done,0),120);
  });
 }
 private static void connect(MainActivity a,String id,int epoch,String action,String text,BooleanSupplier valid,Consumer<Boolean> done,int attempt) {
  if(!valid.getAsBoolean()){done.accept(false);return;}
  EditorInfo info=new EditorInfo();InputConnection input=a.provider.onCreateInputConnection(info);
  if(input==null){if(attempt<3)a.handler.postDelayed(()->connect(a,id,epoch,action,text,valid,done,attempt+1),150);else done.accept(false);return;}
  Handler target=input.getHandler();if(target==null)target=new Handler(Looper.getMainLooper());
  target.post(()->{
   boolean ok=false;
   try {
    if(a.foreground&&a.epoch==epoch&&id.equals(a.currentRequest)){
     if("insertText".equals(action)){input.beginBatchEdit();try{input.finishComposingText();ok=input.commitText(text,1);}finally{input.endBatchEdit();}}
     else if("enter".equals(action)){boolean down=input.sendKeyEvent(new KeyEvent(KeyEvent.ACTION_DOWN,KeyEvent.KEYCODE_ENTER));boolean up=input.sendKeyEvent(new KeyEvent(KeyEvent.ACTION_UP,KeyEvent.KEYCODE_ENTER));ok=down&&up;}
    }
   } catch(RuntimeException ignored) { ok=false; }
   final boolean accepted=ok;
   a.handler.post(()->{InputMethodManager ime=(InputMethodManager)a.getSystemService(Context.INPUT_METHOD_SERVICE);if(ime!=null)ime.hideSoftInputFromWindow(a.provider.getWindowToken(),0);done.accept(accepted&&valid.getAsBoolean());});
  });
 }
 private static void tap(MainActivity a,JSONObject request,BooleanSupplier valid,Consumer<Boolean> done){
  if(!valid.getAsBoolean()||!a.provider.isShown()){done.accept(false);return;}
  double width=request.optDouble("viewportWidth",0),height=request.optDouble("viewportHeight",0);
  double x=request.optDouble("x",-1),y=request.optDouble("y",-1);
  if(!Double.isFinite(width)||!Double.isFinite(height)||!Double.isFinite(x)||!Double.isFinite(y)||width<=0||height<=0||x<0||y<0||x>=width||y>=height){done.accept(false);return;}
  float px=(float)(x*a.provider.getWidth()/width),py=(float)(y*a.provider.getHeight()/height);
  if(a.provider.getWidth()<=0||a.provider.getHeight()<=0){done.accept(false);return;}
  long time=SystemClock.uptimeMillis();
  MotionEvent down=MotionEvent.obtain(time,time,MotionEvent.ACTION_DOWN,px,py,0);
  MotionEvent up=MotionEvent.obtain(time,time+40,MotionEvent.ACTION_UP,px,py,0);
  try{boolean accepted=a.provider.dispatchTouchEvent(down);accepted=a.provider.dispatchTouchEvent(up)&&accepted;done.accept(accepted);}
  finally{down.recycle();up.recycle();}
 }

}
