package com.osminog.vision;

import android.os.Bundle;
import org.json.JSONObject;

/** Foreground transport integration. The exported MainActivity component is
 * retained as an activity alias, so installed launcher shortcuts keep working. */
public final class ReliableActivity extends MainActivity {
 ForegroundTransport foregroundTransport;
 @Override public void onCreate(Bundle state){super.onCreate(state);foregroundTransport=new ForegroundTransport(this);}
 @Override void ask(JSONObject message){foregroundTransport.ask(message);}
 void legacyAsk(JSONObject message){super.ask(message);}
 @Override String providerScript(){return super.providerScript().replace("{origin:","{nativeInput:true,nativeTap:true,origin:");}
 @Override void emit(String type,Object... values){if(foregroundTransport!=null)foregroundTransport.event(type,values);super.emit(type,values);}
 @Override void command(JSONObject message)throws Exception{
  if("ready".equals(message.optString("type"))){shell.evaluateJavascript(asset("foreground-shell.js"),ignored->{try{super.command(message);}catch(Exception error){notice("Не удалось инициализировать оболочку");}});return;}
  if("diagnostics".equals(message.optString("type"))){if(foreground&&foregroundTransport!=null)foregroundTransport.shareReport();return;}
  super.command(message);
 }
 @Override void returnToShell(){if(foregroundTransport!=null)foregroundTransport.userReturn();super.returnToShell();}
 @Override void cancelRequest(){if(foregroundTransport!=null)foregroundTransport.cancel();super.cancelRequest();}
 @Override void stopSession(){if(foregroundTransport!=null)foregroundTransport.cancel();super.stopSession();}
}
