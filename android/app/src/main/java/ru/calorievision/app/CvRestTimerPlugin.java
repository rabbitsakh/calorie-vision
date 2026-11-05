package ru.calorievision.app;

import android.app.Activity;
import android.webkit.JavascriptInterface;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Таймер отдыха для локального shell и для сайта внутри WebView.
 *
 * <ul>
 *   <li>{@code Capacitor.Plugins.CvRest} — локальный shell
 *   <li>{@code window.CvRest} — тот же контракт после перехода на calorievision.ru
 * </ul>
 */
@CapacitorPlugin(name = "CvRest")
public class CvRestTimerPlugin extends Plugin {

  @PluginMethod
  public void start(PluginCall call) {
    Activity activity = getActivity();
    if (activity == null) {
      call.reject("Нет экрана");
      return;
    }
    Long endsAt = call.getLong("endsAt");
    String title = call.getString("title", "Отдых");
    if (endsAt == null || endsAt <= 0) {
      call.reject("Нет времени окончания");
      return;
    }
    CvRestTimerService.start(activity, endsAt, title);
    JSObject result = new JSObject();
    result.put("ok", true);
    call.resolve(result);
  }

  @PluginMethod
  public void add(PluginCall call) {
    Activity activity = getActivity();
    if (activity == null) {
      call.reject("Нет экрана");
      return;
    }
    CvRestTimerService.start(activity, CvRestTimerService.readEndsAt(activity) + 30_000L, "Отдых");
    call.resolve();
  }

  @PluginMethod
  public void skip(PluginCall call) {
    Activity activity = getActivity();
    if (activity == null) {
      call.reject("Нет экрана");
      return;
    }
    activity.startService(
        new android.content.Intent(activity, CvRestTimerService.class)
            .setAction(CvRestTimerService.ACTION_SKIP));
    call.resolve();
  }

  /** Синхронный мост для страницы, где нет Capacitor JS. */
  public static final class JsBridge {
    private final Activity activity;

    public JsBridge(Activity activity) {
      this.activity = activity;
    }

    @JavascriptInterface
    public boolean start(double endsAt, String title) {
      if (endsAt <= 0) return false;
      try {
        CvRestTimerService.start(activity, (long) endsAt, title);
        return true;
      } catch (Exception error) {
        return false;
      }
    }

    @JavascriptInterface
    public boolean add(double ms) {
      try {
        long ends = CvRestTimerService.readEndsAt(activity);
        long base = Math.max(ends, System.currentTimeMillis());
        long extra = ms > 0 ? (long) ms : 30_000L;
        CvRestTimerService.start(activity, base + extra, "Отдых");
        return true;
      } catch (Exception error) {
        return false;
      }
    }

    @JavascriptInterface
    public boolean skip() {
      try {
        activity.startService(
            new android.content.Intent(activity, CvRestTimerService.class)
                .setAction(CvRestTimerService.ACTION_SKIP));
        return true;
      } catch (Exception error) {
        return false;
      }
    }

    @JavascriptInterface
    public double endsAt() {
      return CvRestTimerService.readEndsAt(activity);
    }
  }
}
