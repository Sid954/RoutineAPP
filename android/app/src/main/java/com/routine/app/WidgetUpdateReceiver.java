package com.routine.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Wakes the widgets without the app: the refresh alarm (WidgetUpdater.ACTION_TICK),
 * refresh buttons, phone restart, app update, and clock/timezone/locale changes.
 */
public class WidgetUpdateReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        WidgetUpdater.updateAll(context);
    }
}
