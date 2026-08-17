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
import android.widget.RemoteViews;

import java.util.Calendar;

public class RoutineListWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_UPDATE_LIST_WIDGET = "com.routine.app.ACTION_UPDATE_LIST_WIDGET";
    public static final String ACTION_SELECT_DAY         = "com.routine.app.ACTION_SELECT_DAY";
    public static final String ACTION_PREV_DAY           = "com.routine.app.ACTION_PREV_DAY";
    public static final String ACTION_NEXT_DAY           = "com.routine.app.ACTION_NEXT_DAY";

    // Day indices: Sat=6, Sun=0, Mon=1, Tue=2, Wed=3
    private static final int[] DAY_INDICES = {6, 0, 1, 2, 3};
    private static final String[] DAY_LABELS = {"Sat", "Sun", "Mon", "Tue", "Wed"};
    private static final int[] TAB_IDS = {R.id.tab_sat, R.id.tab_sun, R.id.tab_mon, R.id.tab_tue, R.id.tab_wed};

    @Override
    public void onUpdate(Context ctx, AppWidgetManager awm, int[] ids) {
        for (int id : ids) updateWidget(ctx, awm, id);
        scheduleNextUpdate(ctx);
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

        SharedPreferences prefs = ctx.getSharedPreferences("RoutineWidgetData", Context.MODE_PRIVATE);
        Calendar cal = Calendar.getInstance();
        int todayIdx = cal.get(Calendar.DAY_OF_WEEK) - 1;
        int currentSelected = prefs.getInt("widget_selected_day_idx", todayIdx);

        if (ACTION_SELECT_DAY.equals(a)) {
            int dayIdx = intent.getIntExtra("selected_day_idx", -1);
            if (dayIdx != -1) {
                prefs.edit().putInt("widget_selected_day_idx", dayIdx).apply();
                refreshWidgetList(ctx);
            }
        } else if (ACTION_PREV_DAY.equals(a)) {
            int currentPos = findDayPos(currentSelected);
            int prevPos = (currentPos - 1 + DAY_INDICES.length) % DAY_INDICES.length;
            prefs.edit().putInt("widget_selected_day_idx", DAY_INDICES[prevPos]).apply();
            refreshWidgetList(ctx);

        } else if (ACTION_NEXT_DAY.equals(a)) {
            int currentPos = findDayPos(currentSelected);
            int nextPos = (currentPos + 1) % DAY_INDICES.length;
            prefs.edit().putInt("widget_selected_day_idx", DAY_INDICES[nextPos]).apply();
            refreshWidgetList(ctx);

        } else if (ACTION_UPDATE_LIST_WIDGET.equals(a) ||
                   AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(a) ||
                   AppWidgetManager.ACTION_APPWIDGET_ENABLED.equals(a) ||
                   Intent.ACTION_BOOT_COMPLETED.equals(a) ||
                   Intent.ACTION_MY_PACKAGE_REPLACED.equals(a) ||
                   Intent.ACTION_TIME_CHANGED.equals(a) ||
                   Intent.ACTION_TIMEZONE_CHANGED.equals(a)) {

            refreshWidgetList(ctx);
        }
    }

    private void refreshWidgetList(Context ctx) {
        AppWidgetManager awm = AppWidgetManager.getInstance(ctx);
        ComponentName cn = new ComponentName(ctx, RoutineListWidgetProvider.class);
        int[] ids = awm.getAppWidgetIds(cn);

        awm.notifyAppWidgetViewDataChanged(ids, R.id.widget_list_view);
        onUpdate(ctx, awm, ids);
    }

    private int findDayPos(int dayIdx) {
        for (int i = 0; i < DAY_INDICES.length; i++) {
            if (DAY_INDICES[i] == dayIdx) return i;
        }
        return 0;
    }

    private void updateWidget(Context ctx, AppWidgetManager awm, int id) {
        RemoteViews views = new RemoteViews(ctx.getPackageName(), R.layout.widget_list_layout);

        SharedPreferences prefs = ctx.getSharedPreferences("RoutineWidgetData", Context.MODE_PRIVATE);
        Calendar cal = Calendar.getInstance();
        int todayIdx = cal.get(Calendar.DAY_OF_WEEK) - 1;

        int selectedDayIdx = prefs.getInt("widget_selected_day_idx", todayIdx);

        // Prev Arrow [ ‹ ] PendingIntent
        Intent prevIntent = new Intent(ctx, RoutineListWidgetProvider.class);
        prevIntent.setAction(ACTION_PREV_DAY);
        PendingIntent prevPi = PendingIntent.getBroadcast(
            ctx, 990, prevIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.tab_prev, prevPi);

        // Next Arrow [ › ] PendingIntent
        Intent nextIntent = new Intent(ctx, RoutineListWidgetProvider.class);
        nextIntent.setAction(ACTION_NEXT_DAY);
        PendingIntent nextPi = PendingIntent.getBroadcast(
            ctx, 991, nextIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.tab_next, nextPi);

        // Update day switcher tab button styles & click PendingIntents
        for (int i = 0; i < DAY_INDICES.length; i++) {
            int dayIdx = DAY_INDICES[i];
            int tabViewId = TAB_IDS[i];
            boolean isSelected = (dayIdx == selectedDayIdx);
            boolean isToday = (dayIdx == todayIdx);

            String label = DAY_LABELS[i] + (isToday ? " •" : "");
            views.setTextViewText(tabViewId, label);

            if (isSelected) {
                views.setInt(tabViewId, "setBackgroundResource", R.drawable.widget_tab_btn_active_bg);
                views.setTextColor(tabViewId, 0xFF38bdf8);
            } else {
                views.setInt(tabViewId, "setBackgroundResource", R.drawable.widget_tab_btn_bg);
                views.setTextColor(tabViewId, isToday ? 0xFF38bdf8 : 0xFF94a3b8);
            }

            Intent clickIntent = new Intent(ctx, RoutineListWidgetProvider.class);
            clickIntent.setAction(ACTION_SELECT_DAY);
            clickIntent.putExtra("selected_day_idx", dayIdx);
            PendingIntent pi = PendingIntent.getBroadcast(
                ctx, 100 + dayIdx, clickIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(tabViewId, pi);
        }

        // Bind RemoteViewsService to the ListView
        Intent svcIntent = new Intent(ctx, RoutineListRemoteViewsService.class);
        svcIntent.setData(Uri.fromParts("content", String.valueOf(id), null));
        views.setRemoteAdapter(R.id.widget_list_view, svcIntent);
        views.setEmptyView(R.id.widget_list_view, android.R.id.empty);

        // Reload button click → trigger update broadcast
        Intent reloadIntent = new Intent(ctx, RoutineListWidgetProvider.class);
        reloadIntent.setAction(ACTION_UPDATE_LIST_WIDGET);
        PendingIntent reloadPi = PendingIntent.getBroadcast(ctx, 997, reloadIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_list_reload, reloadPi);

        // Header title tap → open app
        Intent launchIntent = new Intent(ctx, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent launchPi = PendingIntent.getActivity(ctx, 3, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_list_title, launchPi);

        awm.updateAppWidget(id, views);
    }

    public static void scheduleNextUpdate(Context ctx) {
        try {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            Intent intent = new Intent(ctx, RoutineListWidgetProvider.class);
            intent.setAction(ACTION_UPDATE_LIST_WIDGET);

            int flags = PendingIntent.FLAG_UPDATE_CURRENT |
                (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0);
            PendingIntent pi = PendingIntent.getBroadcast(ctx, 997, intent, flags);

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
