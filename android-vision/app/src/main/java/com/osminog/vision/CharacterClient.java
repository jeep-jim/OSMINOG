package com.osminog.vision;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONObject;
import java.io.*;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.cert.CertificateFactory;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.net.ssl.*;

/** Native-only credentials, fixed endpoint and dedicated certificate trust. */
final class CharacterClient implements AutoCloseable {
 interface Sink { void emit(String type,Object... values); }
 interface Transport { JSONObject request(String path,JSONObject body,String token) throws Exception; }
 static class Rejected extends IOException {
  final String code;
  Rejected(String value){super(value);code=value;}
 }
 private final Sink sink;
 private final SharedPreferences prefs;
 private final Transport transport;
 private final ExecutorService worker=Executors.newSingleThreadExecutor();
 private final AtomicBoolean busy=new AtomicBoolean(false);
 private volatile boolean closed=false;
 private volatile HttpsURLConnection current;
 CharacterClient(Context context,Sink sink){
  this.sink=sink;this.prefs=context.getSharedPreferences("character-session",Context.MODE_PRIVATE);
  this.transport=(path,body,token)->network(context,path,body,token);
 }
 CharacterClient(SharedPreferences prefs,Sink sink,Transport transport){this.prefs=prefs;this.sink=sink;this.transport=transport;}
 private JSONObject network(Context context,String path,JSONObject body,String token)throws Exception{
  if(!path.equals("/health")&&!path.equals("/v1/session")&&!path.equals("/v1/chat"))throw new Rejected("invalid_request");
  KeyStore trust=KeyStore.getInstance(KeyStore.getDefaultType());trust.load(null);
  try(InputStream in=context.getResources().openRawResource(R.raw.character_server)){
   trust.setCertificateEntry("osminog-character",CertificateFactory.getInstance("X.509").generateCertificate(in));
  }
  TrustManagerFactory factory=TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());factory.init(trust);
  SSLContext tls=SSLContext.getInstance("TLS");tls.init(null,factory.getTrustManagers(),null);
  HttpsURLConnection connection=(HttpsURLConnection)new URL("https://osminog.red:3081"+path).openConnection();current=connection;
  connection.setSSLSocketFactory(tls.getSocketFactory());
  // Keep Android's default hostname verification; do not accept arbitrary certificates.
  connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(12000);connection.setReadTimeout(55000);
  connection.setRequestProperty("Accept","application/json");
  if(token!=null)connection.setRequestProperty("Authorization","Bearer "+token);
  try{
   if(body!=null){byte[] bytes=body.toString().getBytes(StandardCharsets.UTF_8);if(bytes.length>450000)throw new Rejected("body_too_large");connection.setRequestMethod("POST");connection.setRequestProperty("Content-Type","application/json");connection.setDoOutput(true);connection.setFixedLengthStreamingMode(bytes.length);try(OutputStream out=connection.getOutputStream()){out.write(bytes);}}
   int status=connection.getResponseCode();
   if(status>=300&&status<400)throw new Rejected("connection_failed");
   InputStream source=status>=400?connection.getErrorStream():connection.getInputStream();
   if(source==null)throw new Rejected("connection_failed");
   ByteArrayOutputStream result=new ByteArrayOutputStream();
   try(InputStream in=source){byte[] buffer=new byte[2048];int n;while((n=in.read(buffer))!=-1){if(result.size()+n>24000)throw new Rejected("invalid_reply");result.write(buffer,0,n);}}
   JSONObject json=new JSONObject(result.toString("UTF-8"));
   if(status<200||status>=300)throw new Rejected(json.optString("error","connection_failed"));
   return json;
  }finally{connection.disconnect();if(current==connection)current=null;}
 }
 void check(){if(closed||busy.get())return;worker.execute(()->{try{JSONObject health=transport.request("/health",null,null);if(!closed)sink.emit("characterReady","ready",health.optBoolean("ok"),"vision",health.optBoolean("vision"));}catch(Exception e){if(!closed)sink.emit("characterReady","ready",false,"vision",false);}});}
 void ask(JSONObject request){
  String id=request.optString("id");
  if(closed||!id.matches("[A-Za-z0-9_-]{1,80}")||!request.optBoolean("consent")){sink.emit("characterError","id",id,"code","consent_required");return;}
  if(!busy.compareAndSet(false,true)){sink.emit("characterError","id",id,"code","busy");return;}
  worker.execute(()->{try{
   String token=prefs.getString("token","");
   JSONObject reply=null;
   for(int attempt=0;attempt<2;attempt++){
    if(token.isEmpty()){token=transport.request("/v1/session",new JSONObject().put("protocol",1),null).getString("token");if(!token.matches("[A-Za-z0-9_-]{43}"))throw new Rejected("invalid_reply");prefs.edit().putString("token",token).apply();}
    try{reply=transport.request("/v1/chat",request,token);break;}
    catch(Rejected e){if(!e.code.equals("unauthorized")||attempt!=0)throw e;token="";prefs.edit().remove("token").apply();}
   }
   if(reply==null||!id.equals(reply.optString("id"))||reply.optString("reply").trim().isEmpty())throw new Rejected("invalid_reply");
   if(!closed)sink.emit("characterReply","id",id,"reply",reply.getString("reply"),"targetId",reply.opt("targetId"),"visionUsed",reply.optBoolean("visionUsed"));
  }catch(Rejected e){if(!closed)sink.emit("characterError","id",id,"code",e.code);}
   catch(Exception e){if(!closed)sink.emit("characterError","id",id,"code","connection_failed");}
   finally{busy.set(false);}
  });
 }
 @Override public void close(){closed=true;HttpsURLConnection c=current;if(c!=null)c.disconnect();worker.shutdownNow();}
}
