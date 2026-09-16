package com.ideashelf.partnerhub;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** Home-screen widget: today's tasks, department pulse, next renewal, quick "add task" and "agent" actions. */
public class PartnerHubWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) mgr.updateAppWidget(id, build(context));
        ReminderWorker.ensureScheduled(context);
    }

    public static void updateAll(Context c) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(c);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(c, PartnerHubWidget.class));
        if (ids.length > 0) mgr.updateAppWidget(ids, build(c));
    }

    private static PendingIntent open(Context c, String action, int req) {
        Intent i = new Intent(c, MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        i.putExtra("ph_action", action);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        return PendingIntent.getActivity(c, req, i, flags);
    }

    static RemoteViews build(Context c) {
        JSONObject s = Store.snapshot(c);
        boolean ar = !"en".equals(s.optString("lang", "ar"));
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_partnerhub);
        int dir = ar ? View.LAYOUT_DIRECTION_RTL : View.LAYOUT_DIRECTION_LTR;
        v.setInt(R.id.widget_root, "setLayoutDirection", dir);

        String date = new SimpleDateFormat("EEEE d MMM", ar ? new Locale("ar", "AE") : Locale.UK).format(new Date());
        v.setTextViewText(R.id.w_date, date);
        v.setTextViewText(R.id.w_title, ar ? "مهام اليوم" : "Day tasks");
        int todayCount = s.optInt("todayCount", 0), urgent = s.optInt("urgentCount", 0), overdue = s.optInt("overdueCount", 0);
        v.setTextViewText(R.id.w_count, String.valueOf(todayCount));
        v.setTextViewText(R.id.w_sub, ar ? ("عاجل " + urgent + (overdue > 0 ? " · متأخرة " + overdue : "")) : (urgent + " urgent" + (overdue > 0 ? " · " + overdue + " overdue" : "")));

        int[] rows = { R.id.w_t1, R.id.w_t2, R.id.w_t3 };
        int[] dots = { R.id.w_d1, R.id.w_d2, R.id.w_d3 };
        JSONArray tasks = s.optJSONArray("todayTasks");
        for (int i = 0; i < rows.length; i++) {
            JSONObject t = tasks != null && i < tasks.length() ? tasks.optJSONObject(i) : null;
            if (t == null) { v.setViewVisibility(rows[i], View.GONE); v.setViewVisibility(dots[i], View.GONE); continue; }
            v.setViewVisibility(rows[i], View.VISIBLE); v.setViewVisibility(dots[i], View.VISIBLE);
            String time = t.optString("time", "");
            v.setTextViewText(rows[i], (time.isEmpty() ? "" : time + "  ") + t.optString("title"));
            String pr = t.optString("priority", "normal");
            v.setInt(dots[i], "setColorFilter", "urgent".equals(pr) ? 0xFFF26B2B : "medium".equals(pr) ? 0xFFC4901D : 0xFF8E9484);
        }
        if (tasks == null || tasks.length() == 0) { v.setViewVisibility(R.id.w_t1, View.VISIBLE); v.setViewVisibility(R.id.w_d1, View.GONE); v.setTextViewText(R.id.w_t1, ar ? "لا مهام اليوم ✓" : "No tasks today ✓"); }

        String pipeline = s.optString("pipeline", "");
        JSONObject renewal = s.optJSONObject("nextRenewal");
        String foot = (ar ? "المسار: " : "Pipeline: ") + pipeline + (renewal != null ? "  ·  " + (ar ? "تجديد خلال " : "renewal in ") + renewal.optInt("days") + (ar ? " يوم" : "d") : "");
        v.setTextViewText(R.id.w_foot, foot);
        v.setTextViewText(R.id.w_add, ar ? "+ مهمة" : "+ Task");
        v.setTextViewText(R.id.w_agent, ar ? "✦ الوكيل" : "✦ Agent");

        v.setOnClickPendingIntent(R.id.widget_root, open(c, "home", 10));
        v.setOnClickPendingIntent(R.id.w_add, open(c, "addTask", 11));
        v.setOnClickPendingIntent(R.id.w_agent, open(c, "agent", 12));
        return v;
    }
}
