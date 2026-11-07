package com.osminog.vision;

import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.test.runner.AndroidJUnitRunner;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/** Test APK only: prepare the existing motion preference before any Activity is
 * launched. ActivityScenario's idle barrier must not race perpetual animation.
 * The release APK does not contain this runner; clean-launch verification clears
 * app data and exercises the ordinary animated startup afterward. */
public final class VisionTestRunner extends AndroidJUnitRunner {
 @Override public void onStart() {
  Handler main = new Handler(Looper.getMainLooper());
  CountDownLatch done = new CountDownLatch(1);
  AtomicReference<Throwable> failure = new AtomicReference<>();
  main.post(() -> {
   try {
    WebView seed = new WebView(getTargetContext());
    seed.getSettings().setJavaScriptEnabled(true);
    seed.getSettings().setDomStorageEnabled(true);
    seed.setWebViewClient(new WebViewClient() {
     private boolean finished;
     @Override public void onPageFinished(WebView view, String url) {
      if (finished) return;
      finished = true;
      view.evaluateJavascript("localStorage.setItem('osminogMotion','off');localStorage.getItem('osminogMotion')", value -> {
       if (!"\"off\"".equals(value)) failure.set(new AssertionError("Cannot initialize test motion preference"));
       view.destroy();
       done.countDown();
      });
     }
    });
    seed.loadDataWithBaseURL("https://appassets.androidplatform.net/assets/index.html", "<!doctype html><html><head><meta charset='utf-8'></head><body></body></html>", "text/html", "UTF-8", null);
   } catch (Throwable error) {
    failure.set(error);
    done.countDown();
   }
  });
  try {
   if (!done.await(30, TimeUnit.SECONDS)) throw new AssertionError("Test WebView bootstrap timed out");
  } catch (InterruptedException error) {
   Thread.currentThread().interrupt();
   throw new AssertionError(error);
  }
  if (failure.get() != null) throw new AssertionError("Test setup failed", failure.get());
  super.onStart();
 }
}
