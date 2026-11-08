package com.osminog.vision;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import java.util.ArrayList;

/** One user-requested dictation. System service fallback always requires explicit consent. */
final class VoiceInput {
 interface Host { void event(String type,Object... values); }
 interface Engine { void start(Intent intent); void finish(); void close(); }
 interface Factory { boolean local(); boolean system(); Engine create(boolean local,RecognitionListener listener); }
 static Factory androidFactory(Context context){return new Factory(){
  public boolean local(){return Build.VERSION.SDK_INT>=31&&SpeechRecognizer.isOnDeviceRecognitionAvailable(context);}
  public boolean system(){return SpeechRecognizer.isRecognitionAvailable(context);}
  public Engine create(boolean local,RecognitionListener listener){
   SpeechRecognizer r;
   if(local){if(Build.VERSION.SDK_INT<31)throw new IllegalStateException("On-device service requires API 31");r=SpeechRecognizer.createOnDeviceSpeechRecognizer(context);}else r=SpeechRecognizer.createSpeechRecognizer(context);
   r.setRecognitionListener(listener);
   return new Engine(){public void start(Intent i){r.startListening(i);}public void finish(){r.stopListening();}public void close(){r.cancel();r.destroy();}};
  }
 };}
 final Host host;final Factory factory;final Handler handler;
 Engine engine;int generation;String session="",language="ru";boolean active,waitingChoice,localMode,finishing;
 Runnable timeout;
 VoiceInput(Host host,Factory factory,Handler handler){this.host=host;this.factory=factory;this.handler=handler;}
 void start(String id,String lang){cancel();session=id;language=lang;active=true;boolean local=false;try{local=factory.local();}catch(RuntimeException ignored){}if(local)launch(true);else offerSystem();}
 void offerSystem(){dispose();boolean available=false;try{available=factory.system();}catch(RuntimeException ignored){}if(!available){fail("На телефоне нет доступного сервиса распознавания речи. Включи его в настройках Android или используй микрофон клавиатуры.");return;}waitingChoice=true;event("voiceChoice");}
 void chooseSystem(String id){if(active&&waitingChoice&&session.equals(id)){waitingChoice=false;launch(false);}}
 void launch(boolean local){
  localMode=local;finishing=false;final int token=++generation;
  event("voice","on",true,"state","starting");
  try{
   engine=factory.create(local,new RecognitionListener(){
    boolean current(){return active&&token==generation;}
    public void onReadyForSpeech(Bundle b){if(current()){event("voice","on",true,"state","listening");armTimeout(60000,token);}}
    public void onBeginningOfSpeech(){}
    public void onRmsChanged(float f){}
    public void onBufferReceived(byte[] b){}
    public void onEndOfSpeech(){if(current()){finishing=true;event("voice","on",true,"state","processing");armTimeout(15000,token);}}
    public void onError(int error){if(!current())return;if(localMode&&(error==SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED||error==SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE||error==SpeechRecognizer.ERROR_CLIENT||error==SpeechRecognizer.ERROR_SERVER_DISCONNECTED)){offerSystem();}else fail(errorText(error));}
    public void onResults(Bundle b){if(!current())return;ArrayList<String> lines=b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);if(lines!=null&&!lines.isEmpty()&&!lines.get(0).trim().isEmpty())event("transcript","text",lines.get(0));else event("notice","message","Речь не распознана. Попробуй ещё раз.");cancel();}
    public void onPartialResults(Bundle b){}
    public void onEvent(int e,Bundle b){}
   });
   armTimeout(15000,token);
   engine.start(new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM).putExtra(RecognizerIntent.EXTRA_LANGUAGE,language).putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE,local).putExtra(RecognizerIntent.EXTRA_MAX_RESULTS,1));
  }catch(RuntimeException e){if(local)offerSystem();else fail("Не удалось запустить системный голосовой ввод. Проверь сервис распознавания и разрешение микрофона в Android.");}
 }
 void finish(String id){if(!active||!session.equals(id)||engine==null||finishing)return;finishing=true;event("voice","on",true,"state","processing");armTimeout(15000,generation);try{engine.finish();}catch(RuntimeException e){fail("Не удалось завершить распознавание. Текст в поле сохранён.");}}
 void armTimeout(long delay,int token){if(timeout!=null)handler.removeCallbacks(timeout);timeout=()->{if(active&&token==generation)fail("Сервис распознавания не ответил. Попробуй ещё раз.");};handler.postDelayed(timeout,delay);}
 void dispose(){generation++;if(timeout!=null)handler.removeCallbacks(timeout);timeout=null;Engine old=engine;engine=null;if(old!=null)try{old.close();}catch(RuntimeException ignored){}}
 void cancel(){dispose();if(active)event("voice","on",false,"state","idle");active=false;waitingChoice=false;finishing=false;}
 void fail(String message){event("notice","message",message);cancel();}
 void event(String type,Object... fields){Object[] values=new Object[fields.length+2];values[0]="session";values[1]=session;System.arraycopy(fields,0,values,2,fields.length);host.event(type,values);}
 static String errorText(int code){switch(code){
  case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:return "Нет доступа к микрофону. Разреши его для OSMINOG в настройках Android.";
  case SpeechRecognizer.ERROR_AUDIO:return "Не удалось записать звук. Проверь микрофон и другие приложения, которые его используют.";
  case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:return "Сервис распознавания занят. Подожди немного и повтори.";
  case SpeechRecognizer.ERROR_NO_MATCH:case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:return "Речь не распознана. Попробуй говорить ближе к микрофону.";
  case SpeechRecognizer.ERROR_NETWORK:case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:return "Системный сервис не смог подключиться. Проверь сеть или установи офлайн-язык распознавания.";
  case SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED:case SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE:return "Выбранный язык распознавания недоступен. Установи его в настройках голосового ввода Android.";
  default:return "Сервис распознавания завершился с ошибкой ("+code+"). Можно повторить; черновик сохранён.";
 }}
}
