package com.osminog.vision;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.graphics.*;
import android.hardware.camera2.*;
import android.media.Image;
import android.media.ImageReader;
import android.os.*;
import android.util.Size;
import android.view.*;
import java.nio.ByteBuffer;
import java.util.*;

final class EyeCamera {
 interface Listener { void ready(); void error(String message); }
 interface Frame { void done(String data, String error); }
 final Activity activity; final TextureView preview; final Listener listener;
 final Handler main=new Handler(Looper.getMainLooper());
 HandlerThread thread; Handler worker; CameraDevice device; CameraCaptureSession capture;
 ImageReader reader; Surface surface; Frame pending; boolean running=false,front=false,opening=false; int generation=0,orientation=0;
 EyeCamera(Activity a,TextureView t,Listener l){activity=a;preview=t;listener=l;}
 void start(boolean facing){close();front=facing;running=true;final int gen=++generation;thread=new HandlerThread("osminog-camera");thread.start();worker=new Handler(thread.getLooper());
  preview.setSurfaceTextureListener(new TextureView.SurfaceTextureListener(){public void onSurfaceTextureAvailable(SurfaceTexture s,int w,int h){open(gen);}public void onSurfaceTextureSizeChanged(SurfaceTexture s,int w,int h){}public boolean onSurfaceTextureDestroyed(SurfaceTexture s){close();return true;}public void onSurfaceTextureUpdated(SurfaceTexture s){}});
  if(preview.isAvailable())open(gen);
 }
 void open(int gen){if(!running||gen!=generation||opening||device!=null)return;opening=true;try{
  if(activity.checkSelfPermission(Manifest.permission.CAMERA)!=PackageManager.PERMISSION_GRANTED)throw new SecurityException("Нет разрешения на камеру");
  CameraManager manager=(CameraManager)activity.getSystemService(Context.CAMERA_SERVICE);String chosen=null;
  for(String id:manager.getCameraIdList()){Integer f=manager.getCameraCharacteristics(id).get(CameraCharacteristics.LENS_FACING);if(f!=null&&f==(front?CameraCharacteristics.LENS_FACING_FRONT:CameraCharacteristics.LENS_FACING_BACK)){chosen=id;break;}}
  if(chosen==null)throw new Exception("Нужная камера не найдена");CameraCharacteristics c=manager.getCameraCharacteristics(chosen);
  Size[] sizes=c.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP).getOutputSizes(ImageFormat.JPEG);Size selected=null;
  for(Size s:sizes)if(s.getWidth()<=1280&&s.getHeight()<=1280&&(selected==null||s.getWidth()*s.getHeight()>selected.getWidth()*selected.getHeight()))selected=s;
  if(selected==null)selected=sizes[sizes.length-1];
  final Size imageSize=selected;Integer sensor=c.get(CameraCharacteristics.SENSOR_ORIENTATION);int rotation=activity.getWindowManager().getDefaultDisplay().getRotation()*90;
  orientation=((sensor==null?90:sensor)+(front?rotation:-rotation)+360)%360;
  reader=ImageReader.newInstance(imageSize.getWidth(),imageSize.getHeight(),ImageFormat.JPEG,2);
  reader.setOnImageAvailableListener(r->{try(Image image=r.acquireLatestImage()){if(image==null)return;ByteBuffer buffer=image.getPlanes()[0].getBuffer();byte[] bytes=new byte[buffer.remaining()];buffer.get(bytes);String data="data:image/jpeg;base64,"+android.util.Base64.encodeToString(bytes,android.util.Base64.NO_WRAP);main.post(()->{if(gen!=generation)return;Frame cb=pending;pending=null;if(cb!=null)cb.done(data,null);});}catch(Exception e){failFrame("Не удалось получить кадр");}},worker);
  preview.getSurfaceTexture().setDefaultBufferSize(640,480);surface=new Surface(preview.getSurfaceTexture());
  manager.openCamera(chosen,new CameraDevice.StateCallback(){public void onOpened(CameraDevice d){if(!running||gen!=generation){opening=false;d.close();return;}opening=false;device=d;try{d.createCaptureSession(Arrays.asList(surface,reader.getSurface()),new CameraCaptureSession.StateCallback(){public void onConfigured(CameraCaptureSession s){if(!running||gen!=generation){s.close();return;}capture=s;try{CaptureRequest.Builder b=d.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW);b.addTarget(surface);b.set(CaptureRequest.CONTROL_AF_MODE,CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE);s.setRepeatingRequest(b.build(),null,worker);main.post(()->{if(gen==generation)listener.ready();});}catch(Exception e){fail("Камера не запустилась",gen);}}public void onConfigureFailed(CameraCaptureSession s){fail("Не удалось настроить камеру",gen);}},worker);}catch(Exception e){fail("Не удалось открыть изображение",gen);}}public void onDisconnected(CameraDevice d){d.close();fail("Камера отключена",gen);}public void onError(CameraDevice d,int e){d.close();fail("Камера занята другим приложением",gen);}},worker);
 }catch(Exception e){fail(e.getMessage()==null?"Камера недоступна":e.getMessage(),gen);}}
 void fail(String text,int gen){main.post(()->{if(gen!=generation)return;close();listener.error(text);});}
 void failFrame(String text){main.post(()->{Frame cb=pending;pending=null;if(cb!=null)cb.done(null,text);});}
 void frame(Frame cb){if(!running||capture==null||device==null||reader==null){cb.done(null,"Камера ещё не готова");return;}if(pending!=null){cb.done(null,"Предыдущий кадр ещё обрабатывается");return;}pending=cb;int gen=generation;try{CaptureRequest.Builder b=device.createCaptureRequest(CameraDevice.TEMPLATE_STILL_CAPTURE);b.addTarget(reader.getSurface());b.set(CaptureRequest.JPEG_ORIENTATION,orientation);b.set(CaptureRequest.JPEG_QUALITY,(byte)68);capture.capture(b.build(),new CameraCaptureSession.CaptureCallback(){@Override public void onCaptureFailed(CameraCaptureSession s,CaptureRequest r,CaptureFailure f){failFrame("Не удалось снять кадр");}},worker);main.postDelayed(()->{if(gen==generation&&pending==cb)failFrame("Камера не вернула кадр. Повтори вопрос.");},5000);}catch(Exception e){failFrame("Ошибка съёмки кадра");}}
 void close(){running=false;opening=false;generation++;Frame cb=pending;pending=null;if(capture!=null){try{capture.stopRepeating();}catch(Exception ignored){}capture.close();capture=null;}if(device!=null){device.close();device=null;}if(reader!=null){reader.close();reader=null;}if(surface!=null){surface.release();surface=null;}if(thread!=null){thread.quitSafely();thread=null;}worker=null;if(cb!=null)cb.done(null,"Сеанс камеры закрыт");}
}
