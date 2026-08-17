package com.routine.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.widget.RemoteViews;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class RoutineRotatedWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_UPDATE_ROTATED_WIDGET = "com.routine.app.ACTION_UPDATE_ROTATED_WIDGET";

    @Override
    public void onUpdate(Context ctx, AppWidgetManager awm, int[] ids) {
        for (int id : ids) updateWidget(ctx, awm, id);
        scheduleNextUpdate(ctx);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context ctx, AppWidgetManager awm, int appWidgetId, Bundle newOptions) {
        super.onAppWidgetOptionsChanged(ctx, awm, appWidgetId, newOptions);

        if (newOptions != null) {
            int minW = newOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
            int maxW = newOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 0);
            int currentW = Math.max(minW, maxW);

            if (currentW > 0) {
                // Clamp width between min 220dp and max 550dp to prevent layout breakage
                int clampedW = Math.min(Math.max(currentW, 220), 550);
                SharedPreferences prefs = ctx.getSharedPreferences("RoutineWidgetData", Context.MODE_PRIVATE);
                prefs.edit().putInt("widget_rotated_width_dp", clampedW).apply();
            }
        }

        awm.notifyAppWidgetViewDataChanged(appWidgetId, R.id.widget_rotated_list);
        updateWidget(ctx, awm, appWidgetId);
    }

    @Override
    public void onEnabled(Context ctx) {
        super.onEnabled(ctx);
        scheduleNextUpdate(ctx);
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        super.onReceive(ctx, intent);
        if (intent == null) return;
        String a = intent.getAction();

        if (ACTION_UPDATE_ROTATED_WIDGET.equals(a) ||
            AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(a) ||
            AppWidgetManager.ACTION_APPWIDGET_ENABLED.equals(a) ||
            AppWidgetManager.ACTION_APPWIDGET_OPTIONS_CHANGED.equals(a) ||
            Intent.ACTION_BOOT_COMPLETED.equals(a) ||
            Intent.ACTION_MY_PACKAGE_REPLACED.equals(a) ||
            Intent.ACTION_TIME_CHANGED.equals(a) ||
            Intent.ACTION_TIMEZONE_CHANGED.equals(a)) {

            AppWidgetManager awm = AppWidgetManager.getInstance(ctx);
            ComponentName cn = new ComponentName(ctx, RoutineRotatedWidgetProvider.class);
            int[] ids = awm.getAppWidgetIds(cn);

            awm.notifyAppWidgetViewDataChanged(ids, R.id.widget_rotated_list);
            onUpdate(ctx, awm, ids);
        }
    }

    private void updateWidget(Context ctx, AppWidgetManager awm, int id) {
        RemoteViews views = new RemoteViews(ctx.getPackageName(), R.layout.widget_rotated_layout);

        String timeStr = new SimpleDateFormat("hh:mm a", Locale.US).format(new Date());
        views.setTextViewText(R.id.widget_rotated_time, timeStr);

        // Bind RemoteViewsService to the ListView
        Intent svcIntent = new Intent(ctx, RoutineRotatedRemoteViewsService.class);
        svcIntent.setData(Uri.fromParts("content", String.valueOf(id), null));
        views.setRemoteAdapter(R.id.widget_rotated_list, svcIntent);
        views.setEmptyView(R.id.widget_rotated_list, android.R.id.empty);

        // Reload button click → trigger update broadcast
        Intent reloadIntent = new Intent(ctx, RoutineRotatedWidgetProvider.class);
        reloadIntent.setAction(ACTION_UPDATE_ROTATED_WIDGET);
        PendingIntent reloadPi = PendingIntent.getBroadcast(ctx, 996, reloadIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_rotated_reload, reloadPi);

        // Header title tap → open app
        Intent launchIntent = new Intent(ctx, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent launchPi = PendingIntent.getActivity(ctx, 4, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_rotated_title, launchPi);

        awm.updateAppWidget(id, views);
    }

    public static void scheduleNextUpdate(Context ctx) {
        try {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            Intent intent = new Intent(ctx, RoutineRotatedWidgetProvider.class);
            intent.setAction(ACTION_UPDATE_ROTATED_WIDGET);

            int flags = PendingIntent.FLAG_UPDATE_CURRENT |
                (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0);
            PendingIntent pi = PendingIntent.getBroadcast(ctx, 996, intent, flags);

            long trigger = System.currentTimeMillis() + 60_000L;
            if (am != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pi);
                else
                    am.set(AlarmManager.RTC_WAKEUP, trigger, pi);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
