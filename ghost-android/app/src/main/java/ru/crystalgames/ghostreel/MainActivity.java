package ru.crystalgames.ghostreel;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/** Ghost Reel: native camera permission, Android file chooser and gallery export. */
public final class MainActivity extends Activity {
    private static final String HOME = "https://appassets.androidplatform.net/assets/index.html";
    private static final int FILE_PICKER = 501, CAMERA_PERMISSION = 502;
    private WebView web;
    private android.webkit.ValueCallback<Uri[]> chooser;
    private PermissionRequest pendingCamera;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final Object outputLock = new Object();
    private OutputStream output;
    private Uri outputUri, lastSavedUri;
    private File outputFile, lastSavedFile;
    private boolean mediaPending;

    @Override @android.annotation.SuppressLint("SetJavaScriptEnabled")
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(0xFF070C16);
        getWindow().setNavigationBarColor(0xFF070C16);
        web = new WebView(this);
        setContentView(web);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();
        web.setWebViewClient(new WebViewClientCompat() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("appassets.androidplatform.net".equals(uri.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
                catch (Exception e) { toast("Не удалось открыть ссылку"); }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView v, android.webkit.ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (chooser != null) chooser.onReceiveValue(null);
                chooser = callback;
                try { startActivityForResult(params.createIntent(), FILE_PICKER); return true; }
                catch (ActivityNotFoundException e) {
                    chooser.onReceiveValue(null); chooser = null;
                    toast("Файловый менеджер не найден"); return false;
                }
            }
            @Override public void onPermissionRequest(PermissionRequest request) {
                ui.post(() -> {
                    if (!String.valueOf(request.getOrigin()).startsWith("https://appassets.androidplatform.net")) {
                        request.deny(); return;
                    }
                    boolean video = false;
                    for (String resource: request.getResources())
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) video = true;
                    if (!video) { request.deny(); return; }
                    if (Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                        pendingCamera = request;
                        requestPermissions(new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION);
                    } else request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                });
            }
        });
        web.addJavascriptInterface(new NativeBridge(), "AndroidBridge");
        web.loadUrl(HOME);
    }

    private void toast(String message) {
        ui.post(() -> Toast.makeText(this, message, Toast.LENGTH_SHORT).show());
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request,result,data);
        if (request != FILE_PICKER || chooser == null) return;
        chooser.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
        chooser = null;
    }

    @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] grantResults) {
        super.onRequestPermissionsResult(requestCode,permissions,grantResults);
        if (requestCode != CAMERA_PERMISSION || pendingCamera == null) return;
        PermissionRequest p=pendingCamera;pendingCamera=null;
        if (grantResults.length>0 && grantResults[0]==PackageManager.PERMISSION_GRANTED)
            p.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
        else {p.deny();toast("Разреши доступ к камере в настройках");}
    }

    private void cancelOutput() {
        synchronized(outputLock) {
            try { if (output != null) output.close(); } catch(Exception ignored) {}
            output=null;
            if (outputUri != null && mediaPending) {
                try { getContentResolver().delete(outputUri,null,null); } catch(Exception ignored) {}
            }
            if (outputFile != null && outputFile.exists()) outputFile.delete();
            outputUri=null;outputFile=null;mediaPending=false;
        }
    }

    private class NativeBridge {
        @JavascriptInterface public boolean beginSave(String rawName, String mime) {
            synchronized(outputLock) {
                cancelOutput();
                try {
                    boolean image = mime!=null && mime.startsWith("image/");
                    boolean video = mime!=null && mime.startsWith("video/");
                    if (!image && !video) return false;
                    String suffix=image?".jpg":".webm";
                    String filename=rawName==null?"ghost-reel"+suffix:rawName.replaceAll("[^A-Za-z0-9._-]","_");
                    if (filename.length()<3)filename="ghost-reel"+suffix;
                    if (Build.VERSION.SDK_INT>=29) {
                        ContentValues values = new ContentValues();
                        values.put(MediaStore.MediaColumns.DISPLAY_NAME,filename);
                        values.put(MediaStore.MediaColumns.MIME_TYPE,mime);
                        values.put(MediaStore.MediaColumns.RELATIVE_PATH,
                            (image?Environment.DIRECTORY_PICTURES:Environment.DIRECTORY_MOVIES)+"/GhostReel");
                        values.put(MediaStore.MediaColumns.IS_PENDING,1);
                        Uri collection=image?MediaStore.Images.Media.EXTERNAL_CONTENT_URI:MediaStore.Video.Media.EXTERNAL_CONTENT_URI;
                        outputUri=getContentResolver().insert(collection, values);
                        if (outputUri == null) return false;
                        mediaPending=true;
                        output=getContentResolver().openOutputStream(outputUri);
                    } else {
                        File base = getExternalFilesDir(image?Environment.DIRECTORY_PICTURES:Environment.DIRECTORY_MOVIES);
                        if (base==null)base=getFilesDir();
                        File dir=new File(base,"GhostReel");
                        if(!dir.exists()&&!dir.mkdirs())return false;
                        outputFile=new File(dir,filename);
                        output=new FileOutputStream(outputFile);
                        outputUri=FileProvider.getUriForFile(MainActivity.this,
                                  getPackageName()+".fileprovider",outputFile);
                    }
                    return output!=null;
                }catch(Exception e){cancelOutput();toast("Не удалось начать сохранение");return false;}
            }
        }
        @JavascriptInterface public boolean appendChunk(String base64) {
            synchronized(outputLock) {
                if(output==null)return false;
                try { output.write(Base64.decode(base64,Base64.DEFAULT));return true; }
                catch(Exception e){return false;}
            }
        }
        @JavascriptInterface public boolean finishSave() {
            synchronized(outputLock) {
                if(output==null)return false;
                try{
                    output.flush();output.close();output=null;
                    if(mediaPending && outputUri!=null) {
                        ContentValues values=new ContentValues();
                        values.put(MediaStore.MediaColumns.IS_PENDING,0);
                        getContentResolver().update(outputUri,values,null,null);
                    }
                    lastSavedUri=outputUri;lastSavedFile=outputFile;
                    outputUri=null;outputFile=null;mediaPending=false;
                    toast("Сохранено в галерею");
                    return true;
                }catch(Exception e){cancelOutput();toast("Не удалось сохранить файл");return false;}
            }
        }
        @JavascriptInterface public void cancelSave(){cancelOutput();}
        @JavascriptInterface public void shareLast(){
            ui.post(()->{
                if(lastSavedUri==null){toast("Сначала сохрани результат");return;}
                try{
                    Intent send=new Intent(Intent.ACTION_SEND);
                    String type=String.valueOf(getContentResolver().getType(lastSavedUri));
                    if(!type.startsWith("image/")&&!type.startsWith("video/"))
                        type=lastSavedFile!=null&&lastSavedFile.getName().endsWith(".jpg")
                             ?"image/jpeg":"video/webm";
                    send.setType(type);
                    send.putExtra(Intent.EXTRA_STREAM,lastSavedUri);
                    send.putExtra(Intent.EXTRA_TEXT,"Снято в «Призрак REEL»");
                    send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    startActivity(Intent.createChooser(send,"Поделиться"));
                }catch(Exception e){toast("Не удалось поделиться");}
            });
        }
    }

    @Override public void onBackPressed() {
        if (web!=null) web.evaluateJavascript("window.GhostUI&&window.GhostUI.back()", null);
        else super.onBackPressed();
    }
    @Override protected void onPause(){if(web!=null)web.onPause();super.onPause();}
    @Override protected void onResume(){super.onResume();if(web!=null)web.onResume();}
    @Override protected void onDestroy() {
        cancelOutput();if(web!=null){web.destroy();web=null;}super.onDestroy();
    }
}
