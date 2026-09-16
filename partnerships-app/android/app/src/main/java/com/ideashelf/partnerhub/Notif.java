package com.ideashelf.partnerhub;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

public final class Notif {
    public static final String CH_REMINDERS = "reminders";
    public static final String CH_AGENT = "agent";
    public static final String CH_SERVICE = "service";
    private Notif() {}

    public static void ensureChannels(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        boolean ar = Store.isArabic(c);
        nm.createNotificationChannel(new NotificationChannel(CH_REMINDERS, ar ? "التذكيرات والملخص اليومي" : "Reminders & daily digest", NotificationManager.IMPORTANCE_HIGH));
        nm.createNotificationChannel(new NotificationChannel(CH_AGENT, ar ? "الوكيل الذكي" : "AI agent", NotificationManager.IMPORTANCE_DEFAULT));
        NotificationChannel svc = new NotificationChannel(CH_SERVICE, ar ? "العمل في الخلفية" : "Background work", NotificationManager.IMPORTANCE_LOW);
        svc.setShowBadge(false);
        nm.createNotificationChannel(svc);
    }

    public static boolean allowed(Context c) {
        return Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(c, android.Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    public static PendingIntent openApp(Context c, String action) {
        Intent i = new Intent(c, MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (action != null) i.putExtra("ph_action", action);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        return PendingIntent.getActivity(c, action == null ? 0 : action.hashCode(), i, flags);
    }

    public static void show(Context c, String channel, int id, String title, String text, String action) {
        if (!allowed(c)) return;
        ensureChannels(c);
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, channel)
            .setSmallIcon(R.drawable.ic_stat_partnerhub)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
            .setColor(0xFF4B5343)
            .setAutoCancel(true)
            .setContentIntent(openApp(c, action))
            .setPriority(CH_REMINDERS.equals(channel) ? NotificationCompat.PRIORITY_HIGH : NotificationCompat.PRIORITY_DEFAULT);
        try { NotificationManagerCompat.from(c).notify(id, b.build()); } catch (SecurityException ignored) {}
    }

    public static Notification serviceNotification(Context c, String title, String text) {
        ensureChannels(c);
        return new NotificationCompat.Builder(c, CH_SERVICE)
            .setSmallIcon(R.drawable.ic_stat_partnerhub)
            .setContentTitle(title)
            .setContentText(text)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setColor(0xFF4B5343)
            .setContentIntent(openApp(c, "agent"))
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }
}
