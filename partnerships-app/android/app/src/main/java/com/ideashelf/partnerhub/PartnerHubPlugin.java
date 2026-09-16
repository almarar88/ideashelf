package com.ideashelf.partnerhub;

import android.content.Intent;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Bridge between the web app and native background/widget/notification features. */
@CapacitorPlugin(name = "PartnerHub")
public class PartnerHubPlugin extends Plugin {

    /** Web layer pushes a compact JSON snapshot; native stores it, refreshes widgets and (re)schedules the worker. */
    @PluginMethod
    public void syncSnapshot(PluginCall call) {
        String json = call.getString("json", "{}");
        Store.saveSnapshot(getContext(), json);
        Notif.ensureChannels(getContext());
        PartnerHubWidget.updateAll(getContext());
        ReminderWorker.ensureScheduled(getContext());
        call.resolve();
    }

    @PluginMethod
    public void notify(PluginCall call) {
        String channel = "agent".equals(call.getString("channel", "reminders")) ? Notif.CH_AGENT : Notif.CH_REMINDERS;
        Notif.show(getContext(), channel, call.getInt("id", (int) (System.currentTimeMillis() & 0xffff)), call.getString("title", "PartnerHub"), call.getString("text", ""), call.getString("action", "home"));
        call.resolve();
    }

    @PluginMethod
    public void startForeground(PluginCall call) {
        Intent i = new Intent(getContext(), AgentForegroundService.class);
        i.putExtra(AgentForegroundService.EXTRA_TITLE, call.getString("title", "PartnerHub"));
        i.putExtra(AgentForegroundService.EXTRA_TEXT, call.getString("text", ""));
        try {
            if (Build.VERSION.SDK_INT >= 26) getContext().startForegroundService(i); else getContext().startService(i);
            call.resolve();
        } catch (Exception e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void stopForeground(PluginCall call) {
        getContext().stopService(new Intent(getContext(), AgentForegroundService.class));
        call.resolve();
    }

    /** Returns and clears the action a widget / notification tap asked for (e.g. "addTask", "agent", "tasks"). */
    @PluginMethod
    public void consumePendingAction(PluginCall call) {
        JSObject r = new JSObject();
        Intent intent = getActivity() != null ? getActivity().getIntent() : null;
        String a = intent != null ? intent.getStringExtra("ph_action") : null;
        if (intent != null) intent.removeExtra("ph_action");
        r.put("action", a == null ? "" : a);
        call.resolve(r);
    }

    @PluginMethod
    public void notificationsAllowed(PluginCall call) {
        JSObject r = new JSObject();
        r.put("allowed", Notif.allowed(getContext()));
        call.resolve(r);
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (intent != null && intent.hasExtra("ph_action")) {
            getActivity().setIntent(intent);
            JSObject data = new JSObject();
            data.put("action", intent.getStringExtra("ph_action"));
            notifyListeners("action", data);
        }
    }
}
