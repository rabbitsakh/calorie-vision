package ru.calorievision.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.VibrationEffect;
import android.os.Vibrator;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/**
 * Отсчёт отдыха на экране блокировки. Хронометр идёт, пока экран выключен.
 * Кнопки «+30 с» и «Пропустить». В конце — звук и вибрация, даже если WebView уснул.
 */
public class CvRestTimerService extends Service {
  static final String ACTION_START = "cv.rest.START";
  static final String ACTION_ADD = "cv.rest.ADD";
  static final String ACTION_SKIP = "cv.rest.SKIP";
  static final String ACTION_DONE = "cv.rest.DONE";
  static final String EXTRA_ENDS = "endsAt";
  static final String EXTRA_TITLE = "title";

  private static final String CHANNEL = "cv-rest";
  private static final String PREFS = "cv_rest";
  private static final String KEY_ENDS = "endsAt";
  private static final int NOTIFICATION_ID = 8801;
  private static final int ALARM_REQUEST = 8802;

  static long readEndsAt(Context context) {
    return context.getSharedPreferences(PREFS, MODE_PRIVATE).getLong(KEY_ENDS, 0L);
  }

  static void start(Context context, long endsAt, String title) {
    Intent intent = new Intent(context, CvRestTimerService.class);
    intent.setAction(ACTION_START);
    intent.putExtra(EXTRA_ENDS, endsAt);
    intent.putExtra(EXTRA_TITLE, title == null ? "Отдых" : title);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(intent);
    } else {
      context.startService(intent);
    }
  }

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    ensureChannel();
    String action = intent != null ? intent.getAction() : ACTION_START;
    if (ACTION_SKIP.equals(action)) {
      finish(false);
      return START_NOT_STICKY;
    }
    if (ACTION_DONE.equals(action)) {
      finish(true);
      return START_NOT_STICKY;
    }
    long endsAt = readEndsAt(this);
    if (ACTION_ADD.equals(action)) {
      long base = Math.max(endsAt, System.currentTimeMillis());
      endsAt = base + 30_000L;
    } else if (intent != null && intent.hasExtra(EXTRA_ENDS)) {
      endsAt = intent.getLongExtra(EXTRA_ENDS, endsAt);
    }
    String title = "Отдых";
    if (intent != null && intent.getStringExtra(EXTRA_TITLE) != null) {
      title = intent.getStringExtra(EXTRA_TITLE);
    }
    if (endsAt <= System.currentTimeMillis()) {
      finish(true);
      return START_NOT_STICKY;
    }
    getSharedPreferences(PREFS, MODE_PRIVATE).edit().putLong(KEY_ENDS, endsAt).apply();
    Notification notification = buildRunning(title, endsAt);
    try {
      if (Build.VERSION.SDK_INT >= 34) {
        startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
      } else {
        startForeground(NOTIFICATION_ID, notification);
      }
    } catch (Exception error) {
      stopSelf();
      return START_NOT_STICKY;
    }
    scheduleDone(endsAt);
    return START_STICKY;
  }

  private void finish(boolean alert) {
    cancelAlarm();
    getSharedPreferences(PREFS, MODE_PRIVATE).edit().remove(KEY_ENDS).apply();
    if (alert) {
      playAlert();
      Notification done =
          baseBuilder("Отдых закончился", "Можно следующий подход")
              .setOngoing(false)
              .setAutoCancel(true)
              .setUsesChronometer(false)
              .build();
      NotificationManagerCompat.from(this).notify(NOTIFICATION_ID, done);
    } else {
      NotificationManagerCompat.from(this).cancel(NOTIFICATION_ID);
    }
    if (Build.VERSION.SDK_INT >= 24) {
      stopForeground(STOP_FOREGROUND_DETACH);
    } else {
      stopForeground(false);
    }
    stopSelf();
  }

  private Notification buildRunning(String title, long endsAt) {
    NotificationCompat.Builder builder =
        baseBuilder(title, "Отдых")
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setWhen(endsAt)
            .setUsesChronometer(true)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .addAction(0, "+30 с", servicePending(ACTION_ADD))
            .addAction(0, "Пропустить", servicePending(ACTION_SKIP));
    if (Build.VERSION.SDK_INT >= 24) {
      builder.setChronometerCountDown(true);
    }
    return builder.build();
  }

  private NotificationCompat.Builder baseBuilder(String title, String text) {
    return new NotificationCompat.Builder(this, CHANNEL)
        .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
        .setContentTitle(title)
        .setContentText(text)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setPriority(NotificationCompat.PRIORITY_HIGH);
  }

  private PendingIntent servicePending(String action) {
    Intent intent = new Intent(this, CvRestTimerService.class);
    intent.setAction(action);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
    if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
    return PendingIntent.getService(this, action.hashCode(), intent, flags);
  }

  private void scheduleDone(long endsAt) {
    AlarmManager alarms = (AlarmManager) getSystemService(ALARM_SERVICE);
    if (alarms == null) return;
    PendingIntent pending = donePending();
    if (Build.VERSION.SDK_INT >= 23) {
      alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, endsAt, pending);
    } else {
      alarms.setExact(AlarmManager.RTC_WAKEUP, endsAt, pending);
    }
  }

  private void cancelAlarm() {
    AlarmManager alarms = (AlarmManager) getSystemService(ALARM_SERVICE);
    if (alarms == null) return;
    alarms.cancel(donePending());
  }

  private PendingIntent donePending() {
    Intent intent = new Intent(this, CvRestTimerService.class);
    intent.setAction(ACTION_DONE);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
    if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
    return PendingIntent.getService(this, ALARM_REQUEST, intent, flags);
  }

  private void ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    NotificationManager manager = getSystemService(NotificationManager.class);
    if (manager == null) return;
    NotificationChannel channel =
        new NotificationChannel(CHANNEL, "Отдых между подходами", NotificationManager.IMPORTANCE_HIGH);
    channel.setDescription("Отсчёт на экране блокировки");
    channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
    channel.enableVibration(true);
    channel.setVibrationPattern(new long[] {0, 250, 120, 250});
    manager.createNotificationChannel(channel);
  }

  private void playAlert() {
    try {
      Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
      Ringtone ringtone = RingtoneManager.getRingtone(this, uri);
      if (ringtone != null) ringtone.play();
    } catch (Exception ignored) {
      // нет рингтона
    }
    try {
      Vibrator vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
      if (vibrator == null) return;
      long[] pattern = new long[] {0, 250, 120, 250};
      if (Build.VERSION.SDK_INT >= 26) {
        vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1));
      } else {
        vibrator.vibrate(pattern, -1);
      }
    } catch (Exception ignored) {
      // вибрация недоступна
    }
  }
}
