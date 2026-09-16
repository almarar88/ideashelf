package com.ideashelf.partnerhub;

import android.content.Context;
import android.content.SharedPreferences;
import androidx.annotation.NonNull;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

/**
 * Runs periodically in the background (no WebView needed): posts the morning digest, reminds about
 * tasks starting within the next hour and agreements ending soon, and refreshes the home-screen widget.
 */
public class ReminderWorker extends Worker {
    public static final String NAME = "partnerhub-reminders";

    public ReminderWorker(@NonNull Context context, @NonNull WorkerParameters params) { super(context, params); }

    public static void ensureScheduled(Context c) {
        PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(ReminderWorker.class, 30, TimeUnit.MINUTES).build();
        WorkManager.getInstance(c).enqueueUniquePeriodicWork(NAME, ExistingPeriodicWorkPolicy.KEEP, req);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context c = getApplicationContext();
        JSONObject s = Store.snapshot(c);
        if (s.length() == 0) return Result.success();
        boolean ar = !"en".equals(s.optString("lang", "ar"));
        boolean notifications = s.optBoolean("notifications", false);
        SharedPreferences p = Store.prefs(c);
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        Calendar now = Calendar.getInstance();
        int hour = now.get(Calendar.HOUR_OF_DAY);
        int minute = now.get(Calendar.MINUTE);

        if (notifications) {
            // 1) morning digest once per day at/after digestHour
            int digestHour = s.optInt("digestHour", 8);
            if (hour >= digestHour && !today.equals(p.getString("digestDay", ""))) {
                int open = s.optInt("todayCount", 0), overdue = s.optInt("overdueCount", 0), urgent = s.optInt("urgentCount", 0);
                JSONObject renewal = s.optJSONObject("nextRenewal");
                String text = ar
                    ? "مهام اليوم: " + open + " (عاجل " + urgent + ")" + (overdue > 0 ? " · متأخرة: " + overdue : "") + (renewal != null ? " · تجديد: " + renewal.optString("title") + " خلال " + renewal.optInt("days") + " يوم" : "")
                    : "Today: " + open + " tasks (" + urgent + " urgent)" + (overdue > 0 ? " · overdue: " + overdue : "") + (renewal != null ? " · renewal: " + renewal.optString("title") + " in " + renewal.optInt("days") + " days" : "");
                Notif.show(c, Notif.CH_REMINDERS, 1001, ar ? "☀️ ملخص قسم الشراكات" : "☀️ Partnerships digest", text, "home");
                p.edit().putString("digestDay", today).apply();
            }
            // 2) tasks starting within the next 60 minutes (once each)
            JSONArray tasks = s.optJSONArray("todayTasks");
            if (tasks != null) {
                for (int i = 0; i < tasks.length(); i++) {
                    JSONObject t = tasks.optJSONObject(i);
                    if (t == null) continue;
                    String time = t.optString("time", "");
                    if (time.length() < 5) continue;
                    int th = Integer.parseInt(time.substring(0, 2)), tm = Integer.parseInt(time.substring(3, 5));
                    int delta = (th * 60 + tm) - (hour * 60 + minute);
                    String key = "task-" + today + "-" + t.optString("id");
                    if (delta >= 0 && delta <= 60 && !p.getBoolean(key, false)) {
                        Notif.show(c, Notif.CH_REMINDERS, 2000 + (t.optString("id").hashCode() & 0xffff), (ar ? "⏰ خلال " : "⏰ In ") + delta + (ar ? " دقيقة: " : " min: ") + t.optString("title"), t.optString("partner", ""), "tasks");
                        p.edit().putBoolean(key, true).apply();
                    }
                }
            }
            // 3) agreements ending in 30 / 7 / 1 days (once each)
            JSONArray ags = s.optJSONArray("renewals");
            if (ags != null) {
                for (int i = 0; i < ags.length(); i++) {
                    JSONObject a = ags.optJSONObject(i);
                    if (a == null) continue;
                    int days = a.optInt("days", 999);
                    if (days == 30 || days == 7 || days == 1) {
                        String key = "ag-" + a.optString("id") + "-" + days;
                        if (!p.getBoolean(key, false)) {
                            Notif.show(c, Notif.CH_REMINDERS, 3000 + (a.optString("id").hashCode() & 0xffff), ar ? "📄 اتفاقية تنتهي خلال " + days + " يوم" : "📄 Agreement ends in " + days + " days", a.optString("title") + " · " + a.optString("partner", ""), "agreements");
                            p.edit().putBoolean(key, true).apply();
                        }
                    }
                }
            }
        }
        PartnerHubWidget.updateAll(c);
        return Result.success();
    }
}
