package com.routine.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.widget.RemoteViews;

import java.util.Calendar;

/** Week widget: one row per class day (Sat–Wed) with that date's classes. */
public class RoutineRotatedWidgetProvider extends AppWidgetProvider {

    // Kept so older code paths that broadcast it still refresh this widget
    public static final String ACTION_UPDATE_ROTATED_WIDGET = "com.routine.app.ACTION_UPDATE_ROTATED_WIDGET";

    @Override
    public void onUpdate(Context ctx, AppWidgetManager awm, int[] ids) {
        WidgetUpdater.updateAll(ctx);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context ctx, AppWidgetManager awm, int id, Bundle opts) {
        super.onAppWidgetOptionsChanged(ctx, awm, id, opts);
        if (opts != null) {
            int w = Math.max(opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0), opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 0));
            if (w > 0) {
                ctx.getSharedPreferences(WidgetData.PREFS, Context.MODE_PRIVATE).edit()
                        .putInt("widget_rotated_width_dp", Math.min(Math.max(w, 220), 550)).apply();
            }
        }
        render(ctx, awm, id, Calendar.getInstance());
        awm.notifyAppWidgetViewDataChanged(id, R.id.widget_rotated_list);
    }

    @Override
    public void onEnabled(Context ctx) { WidgetUpdater.updateAll(ctx); }

    @Override
    public void onDisabled(Context ctx) { WidgetUpdater.updateAll(ctx); }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        super.onReceive(ctx, intent);
        if (intent != null && ACTION_UPDATE_ROTATED_WIDGET.equals(intent.getAction())) WidgetUpdater.updateAll(ctx);
    }

    static void render(Context ctx, AppWidgetManager awm, int id, Calendar now) {
        try {
            RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_rotated_layout);
            v.setTextViewText(R.id.widget_rotated_time, WidgetNow.t12(WidgetNow.minutesOf(now)));
            Intent svc = new Intent(ctx, RoutineRotatedRemoteViewsService.class);
            svc.setData(Uri.fromParts("content", String.valueOf(id), null));
            v.setRemoteAdapter(R.id.widget_rotated_list, svc);
            v.setOnClickPendingIntent(R.id.widget_rotated_reload, WidgetUpdater.refresh(ctx, 14));
            v.setOnClickPendingIntent(R.id.widget_rotated_title, WidgetUpdater.openApp(ctx, 15));
            awm.updateAppWidget(id, v);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
