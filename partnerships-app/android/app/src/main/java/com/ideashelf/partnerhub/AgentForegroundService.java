package com.ideashelf.partnerhub;

import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

/** Keeps the process alive (with an ongoing low-priority notification) while the AI agent or a study generation runs. */
public class AgentForegroundService extends Service {
    public static final int ID = 7001;
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_TEXT = "text";

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String title = intent != null && intent.hasExtra(EXTRA_TITLE) ? intent.getStringExtra(EXTRA_TITLE) : "PartnerHub";
        String text = intent != null && intent.hasExtra(EXTRA_TEXT) ? intent.getStringExtra(EXTRA_TEXT) : "";
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(ID, Notif.serviceNotification(this, title, text), ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            startForeground(ID, Notif.serviceNotification(this, title, text));
        }
        return START_NOT_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
