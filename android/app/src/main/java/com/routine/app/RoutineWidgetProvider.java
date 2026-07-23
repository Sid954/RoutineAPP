package com.routine.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;

public class RoutineWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_UPDATE_WIDGET = "com.routine.app.ACTION_UPDATE_WIDGET";
    private static final String PREFS_NAME = "RoutineWidgetData";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (ACTION_UPDATE_WIDGET.equals(intent.getAction()) || AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(intent.getAction())) {
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            ComponentName thisWidget = new ComponentName(context, RoutineWidgetProvider.class);
            int[] appWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget);
            onUpdate(context, appWidgetManager, appWidgetIds);
        }
    }

    public static void updateWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        String currentLabel = prefs.getString("current_label", "● NO CLASS ACTIVE");
        String currentTime = prefs.getString("current_time", "--:-- – --:--");
        String currentTitle = prefs.getString("current_title", "No Active Class");
        String currentRoom = prefs.getString("current_room", "No Room");
        String currentElapsed = prefs.getString("current_elapsed", "00:00 elapsed");
        int currentProgress = prefs.getInt("current_progress", 0);
        String currentRemaining = prefs.getString("current_remaining", "Tap to open schedule");

        String nextLabel = prefs.getString("next_label", "NEXT");
        String nextTitle = prefs.getString("next_title", "No Class");
        String nextEta = prefs.getString("next_eta", "in --m");
        String nextInfo = prefs.getString("next_info", "Room: -- · --:--");
        boolean showNext = prefs.getBoolean("show_next", true);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_layout);

        // Top Card Mapping
        views.setTextViewText(R.id.widget_current_label, currentLabel);
        views.setTextViewText(R.id.widget_current_time, currentTime);
        views.setTextViewText(R.id.widget_current_title, currentTitle);
        views.setTextViewText(R.id.widget_current_room, currentRoom);
        views.setTextViewText(R.id.widget_current_elapsed, currentElapsed);
        views.setProgressBar(R.id.widget_current_progress, 100, currentProgress, false);
        views.setTextViewText(R.id.widget_current_remaining, currentRemaining);

        // Bottom Card Mapping
        if (showNext) {
            views.setViewVisibility(R.id.widget_card_next, View.VISIBLE);
            views.setTextViewText(R.id.widget_next_label, nextLabel);
            views.setTextViewText(R.id.widget_next_title, nextTitle);
            views.setTextViewText(R.id.widget_next_eta, nextEta);
            views.setTextViewText(R.id.widget_next_info, nextInfo);
        } else {
            views.setViewVisibility(R.id.widget_card_next, View.GONE);
        }

        // Click main card to open MainActivity
        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent launchPendingIntent = PendingIntent.getActivity(
                context, 0, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_card_current, launchPendingIntent);
        views.setOnClickPendingIntent(R.id.widget_card_next, launchPendingIntent);

        // Click reload button to update widget
        Intent reloadIntent = new Intent(context, RoutineWidgetProvider.class);
        reloadIntent.setAction(ACTION_UPDATE_WIDGET);
        PendingIntent reloadPendingIntent = PendingIntent.getBroadcast(
                context, 1, reloadIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_reload_btn, reloadPendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
