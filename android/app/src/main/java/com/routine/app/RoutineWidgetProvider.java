package com.routine.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;

/** Live class widget. All rendering and scheduling lives in WidgetUpdater. */
public class RoutineWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context ctx, AppWidgetManager awm, int[] ids) {
        WidgetUpdater.updateAll(ctx);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context ctx, AppWidgetManager awm, int id, Bundle options) {
        super.onAppWidgetOptionsChanged(ctx, awm, id, options);
        WidgetUpdater.renderLive(ctx, awm, id, WidgetData.load(ctx), java.util.Calendar.getInstance());
    }

    @Override
    public void onEnabled(Context ctx) {
        WidgetUpdater.updateAll(ctx);
    }

    @Override
    public void onDisabled(Context ctx) {
        // Last live widget removed: updateAll cancels the alarm if no widget of any kind is left
        WidgetUpdater.updateAll(ctx);
    }
}
