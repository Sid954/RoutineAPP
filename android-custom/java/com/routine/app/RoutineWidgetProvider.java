package com.routine.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

public class RoutineWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_REFRESH_WIDGET = "com.routine.app.ACTION_REFRESH_WIDGET";
    public static final String PREFS_NAME = "RoutineWidgetPrefs";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            Bundle options = appWidgetManager.getAppWidgetOptions(appWidgetId);
            updateAppWidget(context, appWidgetManager, appWidgetId, options);
        }
        scheduleNextUpdate(context);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager appWidgetManager, int appWidgetId, Bundle newOptions) {
        super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions);
        updateAppWidget(context, appWidgetManager, appWidgetId, newOptions);
    }

    @Override
    public void onEnabled(Context context) {
        super.onEnabled(context);
        scheduleNextUpdate(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (intent == null) return;
        String action = intent.getAction();

        if (ACTION_REFRESH_WIDGET.equals(action) ||
            AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(action) ||
            AppWidgetManager.ACTION_APPWIDGET_ENABLED.equals(action) ||
            AppWidgetManager.ACTION_APPWIDGET_OPTIONS_CHANGED.equals(action) ||
            Intent.ACTION_BOOT_COMPLETED.equals(action) ||
            Intent.ACTION_MY_PACKAGE_REPLACED.equals(action) ||
            Intent.ACTION_TIME_CHANGED.equals(action) ||
            Intent.ACTION_TIMEZONE_CHANGED.equals(action)) {

            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            ComponentName thisWidget = new ComponentName(context, RoutineWidgetProvider.class);
            int[] appWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget);
            for (int appWidgetId : appWidgetIds) {
                Bundle options = appWidgetManager.getAppWidgetOptions(appWidgetId);
                updateAppWidget(context, appWidgetManager, appWidgetId, options);
            }
            scheduleNextUpdate(context);
        }
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId, Bundle options) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

            String currentLabel = prefs.getString("current_label", "● ROUTINE");
            String currentTime = prefs.getString("current_time", "No Active Class");
            String currentTitle = prefs.getString("current_title", "Free Time");
            String currentRoom = prefs.getString("current_room", "FREE");
            String currentElapsed = prefs.getString("current_elapsed", "No active lecture");
            int currentProgress = prefs.getInt("current_progress", 0);
            String currentRemaining = prefs.getString("current_remaining", "Enjoy your break!");

            String nextLabel = prefs.getString("next_label", "FOLLOWING");
            String nextTitle = prefs.getString("next_title", "None");
            String nextEta = prefs.getString("next_eta", "");
            String nextInfo = prefs.getString("next_info", "");
            boolean showNext = prefs.getBoolean("show_next", true);

            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_routine_adaptive);

            // Dynamic Status Label & Color
            views.setTextViewText(R.id.widget_status_label, currentLabel);
            if (currentLabel.contains("STARTING SOON") || currentLabel.contains("⏰")) {
                views.setTextColor(R.id.widget_status_label, Color.parseColor("#38BDF8"));
            } else if (currentLabel.contains("CURRENT") || currentLabel.contains("LIVE")) {
                views.setTextColor(R.id.widget_status_label, Color.parseColor("#38BDF8"));
            } else if (currentLabel.contains("CANCELLED")) {
                views.setTextColor(R.id.widget_status_label, Color.parseColor("#F43F5E"));
            } else if (currentLabel.contains("ONLINE")) {
                views.setTextColor(R.id.widget_status_label, Color.parseColor("#34D399"));
            } else if (currentLabel.contains("HOLIDAY")) {
                views.setTextColor(R.id.widget_status_label, Color.parseColor("#F59E0B"));
            } else {
                views.setTextColor(R.id.widget_status_label, Color.parseColor("#10B981"));
            }

            views.setTextViewText(R.id.widget_time_range, currentTime);
            views.setTextViewText(R.id.widget_course_title, currentTitle);
            views.setTextViewText(R.id.widget_room_chip, currentRoom);
            views.setTextViewText(R.id.widget_elapsed_text, currentElapsed);
            views.setTextViewText(R.id.widget_remaining_text, currentRemaining);
            views.setProgressBar(R.id.widget_progress_bar, 100, Math.max(0, Math.min(100, currentProgress)), false);

            // Determine if height accommodates the second (Following/Next) card
            int minHeight = 200;
            if (options != null) {
                minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 200);
            }

            boolean hasNext = showNext && !nextTitle.isEmpty() && !nextTitle.equals("None");

            if (hasNext && minHeight >= 110) {
                views.setViewVisibility(R.id.widget_next_card, View.VISIBLE);
                views.setTextViewText(R.id.widget_next_label, nextLabel.trim().toUpperCase());
                views.setTextViewText(R.id.widget_next_title, nextTitle);
                views.setTextViewText(R.id.widget_next_eta, nextEta);
                views.setTextViewText(R.id.widget_next_info, nextInfo);
            } else {
                views.setViewVisibility(R.id.widget_next_card, View.GONE);
            }

            // Click top card opens app
            Intent openAppIntent = new Intent(context, MainActivity.class);
            openAppIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent openAppPendingIntent = PendingIntent.getActivity(
                    context,
                    0,
                    openAppIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.widget_current_card, openAppPendingIntent);
            views.setOnClickPendingIntent(R.id.widget_next_card, openAppPendingIntent);

            // Click refresh button updates widget
            Intent refreshIntent = new Intent(context, RoutineWidgetProvider.class);
            refreshIntent.setAction(ACTION_REFRESH_WIDGET);
            PendingIntent refreshPendingIntent = PendingIntent.getBroadcast(
                    context,
                    1,
                    refreshIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.widget_refresh_btn, refreshPendingIntent);

            appWidgetManager.updateAppWidget(appWidgetId, views);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static void scheduleNextUpdate(Context ctx) {
        try {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            Intent intent = new Intent(ctx, RoutineWidgetProvider.class);
            intent.setAction(ACTION_REFRESH_WIDGET);

            int flags = PendingIntent.FLAG_UPDATE_CURRENT |
                (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0);
            PendingIntent pi = PendingIntent.getBroadcast(ctx, 995, intent, flags);

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
