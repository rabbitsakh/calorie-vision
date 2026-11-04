package ru.calorievision.app;

import android.app.Activity;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * Экспорт CSV/PDF/ZIP из дневника.
 *
 * <p>Два входа с одним действием:
 *
 * <ul>
 *   <li>{@code Capacitor.Plugins.CvFiles} — только локальный shell ({@code rustore/cap-www}),
 *       туда Capacitor встраивает свой JS.
 *   <li>{@code window.CvFiles.shareBase64(name, mime, base64) → boolean} — JavascriptInterface
 *       на том же WebView. Он живёт и после перехода на calorievision.ru, где моста Capacitor нет.
 * </ul>
 *
 * Файл пишется в «Загрузки» через MediaStore (Android 10+, без разрешений) и открывается
 * в меню «Поделиться» через FileProvider.
 */
@CapacitorPlugin(name = "CvFiles")
public class CvFilesPlugin extends Plugin {

  @PluginMethod
  public void shareBase64(PluginCall call) {
    Activity activity = getActivity();
    if (activity == null) {
      call.reject("Нет экрана");
      return;
    }
    String filename = call.getString("filename");
    String mime = call.getString("mime");
    String base64 = call.getString("base64");
    activity.runOnUiThread(
        () -> {
          boolean ok = shareNow(activity, filename, mime, base64);
          if (!ok) {
            call.reject("Не удалось сохранить файл");
            return;
          }
          JSObject result = new JSObject();
          result.put("ok", true);
          call.resolve(result);
        });
  }

  /**
   * Контракт веб-клиента из экспорта настроек: синхронный boolean, три строковых аргумента.
   * Вызов приходит с фонового потока WebView, {@code startActivity} — только с UI-потока.
   */
  public static final class JsBridge {
    private final Activity activity;

    public JsBridge(Activity activity) {
      this.activity = activity;
    }

    @JavascriptInterface
    public boolean shareBase64(String filename, String mime, String base64) {
      boolean[] ok = new boolean[] {false};
      CountDownLatch latch = new CountDownLatch(1);
      activity.runOnUiThread(
          () -> {
            ok[0] = shareNow(activity, filename, mime, base64);
            latch.countDown();
          });
      try {
        if (!latch.await(8, TimeUnit.SECONDS)) return false;
      } catch (InterruptedException interrupted) {
        Thread.currentThread().interrupt();
        return false;
      }
      return ok[0];
    }
  }

  /** Сохранить в «Загрузки» и открыть ACTION_SEND. true, если удалось хотя бы одно. */
  static boolean shareNow(Activity activity, String filename, String mime, String base64) {
    try {
      byte[] bytes = Base64.decode(base64 == null ? "" : base64, Base64.DEFAULT);
      if (bytes.length == 0) return false;
      String safeName = sanitizeExportName(filename);
      String safeMime =
          mime == null || mime.trim().isEmpty() ? "application/octet-stream" : mime.trim();
      boolean saved = saveToDownloads(activity, safeName, safeMime, bytes);
      boolean shared = shareWithProvider(activity, safeName, safeMime, bytes);
      return saved || shared;
    } catch (Exception ignored) {
      return false;
    }
  }

  /** MediaStore Downloads, API 29+. Своя вставка не требует WRITE_EXTERNAL_STORAGE. */
  static boolean saveToDownloads(Activity activity, String name, String mime, byte[] bytes) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return false;
    ContentResolver resolver = activity.getContentResolver();
    Uri item = null;
    try {
      ContentValues values = new ContentValues();
      values.put(MediaStore.Downloads.DISPLAY_NAME, name);
      values.put(MediaStore.Downloads.MIME_TYPE, mime);
      values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
      values.put(MediaStore.Downloads.IS_PENDING, 1);
      item = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
      if (item == null) return false;
      try (OutputStream out = resolver.openOutputStream(item)) {
        if (out == null) {
          resolver.delete(item, null, null);
          return false;
        }
        out.write(bytes);
      }
      ContentValues ready = new ContentValues();
      ready.put(MediaStore.Downloads.IS_PENDING, 0);
      resolver.update(item, ready, null, null);
      return true;
    } catch (Exception ignored) {
      if (item != null) {
        try {
          resolver.delete(item, null, null);
        } catch (Exception ignoredDelete) {
          // pending row is harmless
        }
      }
      return false;
    }
  }

  static boolean shareWithProvider(Activity activity, String name, String mime, byte[] bytes) {
    File file = null;
    try {
      File dir = new File(activity.getCacheDir(), "exports");
      if (!dir.exists() && !dir.mkdirs()) return false;
      file = new File(dir, name);
      try (FileOutputStream out = new FileOutputStream(file)) {
        out.write(bytes);
      }
      Uri uri =
          FileProvider.getUriForFile(activity, activity.getPackageName() + ".fileprovider", file);
      Intent send = new Intent(Intent.ACTION_SEND);
      send.setType(mime);
      send.putExtra(Intent.EXTRA_STREAM, uri);
      send.putExtra(Intent.EXTRA_TITLE, name);
      send.setClipData(ClipData.newRawUri(name, uri));
      send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
      Intent chooser = Intent.createChooser(send, "Сохранить или отправить");
      chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
      activity.startActivity(chooser);
      return true;
    } catch (Exception ignored) {
      if (file != null) {
        // Cache copy is only for the share sheet.
        file.delete();
      }
      return false;
    }
  }

  static String sanitizeExportName(String filename) {
    String name = filename == null ? "" : filename.trim();
    name = name.replaceAll("[\\\\/\\u0000-\\u001F:*?\"<>|]", "_");
    if (name.length() > 120) name = name.substring(name.length() - 120);
    if (name.isEmpty() || ".".equals(name) || "..".equals(name)) return "calorie-vision-export";
    return name;
  }
}
