package com.osminog.vision;
import static org.junit.Assert.*;
import android.content.Intent;
import android.os.*;
import android.speech.*;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.*;
import java.util.*;

/** Deterministic speech-service contract, not an acoustic recognition test. */
public class VoiceInputTest {
 VoiceInput voice;Fake factory;List<String> events;
 static class Fake implements VoiceInput.Factory {
  boolean local=true,system=true;int created,finished,closed;boolean chosenLocal;RecognitionListener listener;Intent intent;
  public boolean local(){return local;}public boolean system(){return system;}
  public VoiceInput.Engine create(boolean l,RecognitionListener cb){created++;chosenLocal=l;listener=cb;return new VoiceInput.Engine(){public void start(Intent i){intent=i;}public void finish(){finished++;}public void close(){closed++;}};}
 }
 void main(Runnable r){InstrumentationRegistry.getInstrumentation().runOnMainSync(r);}
 @Before public void setup(){events=new ArrayList<>();factory=new Fake();main(()->voice=new VoiceInput((type,values)->events.add(type+Arrays.toString(values)),factory,new Handler(Looper.getMainLooper())));}
 @After public void close(){main(()->voice.cancel());}
 @Test public void prefersLocalEngine(){main(()->{voice.start("one","ru-RU");assertTrue(factory.chosenLocal);assertEquals("ru-RU",factory.intent.getStringExtra(RecognizerIntent.EXTRA_LANGUAGE));assertTrue(factory.intent.getBooleanExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE,false));});}
 @Test public void fallbackRequiresExplicitCurrentConsent(){main(()->{factory.local=false;voice.start("one","ru");assertEquals(0,factory.created);assertTrue(events.get(0).startsWith("voiceChoice"));voice.chooseSystem("stale");assertEquals(0,factory.created);voice.chooseSystem("one");assertEquals(1,factory.created);assertFalse(factory.chosenLocal);assertFalse(factory.intent.getBooleanExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE,true));});}
 @Test public void unsupportedLocalLanguageOffersFallbackWithoutRecording(){main(()->{voice.start("one","ru");factory.listener.onError(SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE);assertEquals(1,factory.created);assertEquals(1,factory.closed);assertTrue(voice.waitingChoice);assertTrue(events.get(events.size()-1).startsWith("voiceChoice"));});}
 @Test public void finishWaitsForFinalResultAndDoesNotCancel(){main(()->{voice.start("one","ru");voice.finish("one");voice.finish("one");assertEquals(1,factory.finished);assertEquals(0,factory.closed);Bundle result=new Bundle();result.putStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION,new ArrayList<>(Arrays.asList("Моя мысль")));factory.listener.onResults(result);assertTrue(events.stream().anyMatch(e->e.startsWith("transcript")&&e.contains("Моя мысль")));assertFalse(voice.active);assertEquals(1,factory.closed);});}
 @Test public void canceledCallbacksCannotInsertOrRestart(){main(()->{voice.start("one","ru");RecognitionListener old=factory.listener;voice.cancel();int count=events.size();Bundle b=new Bundle();b.putStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION,new ArrayList<>(Arrays.asList("Поздно")));old.onResults(b);old.onError(SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE);assertEquals(count,events.size());assertFalse(voice.waitingChoice);});}
 @Test public void absentServiceReportsActionableError(){main(()->{factory.local=false;factory.system=false;voice.start("one","ru");assertFalse(voice.active);assertEquals(0,factory.created);assertTrue(events.stream().anyMatch(e->e.contains("нет доступного сервиса")));});}
 @Test public void unresponsiveServiceTimesOutAndReleases(){main(()->{voice.start("one","ru");voice.timeout.run();assertFalse(voice.active);assertEquals(1,factory.closed);assertTrue(events.stream().anyMatch(e->e.contains("не ответил")));});}
 @Test public void permissionErrorDoesNotEnableNetworkFallback(){main(()->{voice.start("one","ru");factory.listener.onError(SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS);assertFalse(voice.active);assertFalse(voice.waitingChoice);assertTrue(events.stream().anyMatch(e->e.contains("Нет доступа к микрофону")));});}
}
