package com.routine.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WidgetPlugin")
public class WidgetPlugin extends Plugin {

    public static final String PREFS_NAME = "RoutineWidgetPrefs";
    public static final String DATA_PREFS_NAME = "RoutineWidgetData";

    @PluginMethod
    public void updateWidgetData(PluginCall call) {
        try {
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit();

            editor.putString("current_label", call.getString("current_label", "● ROUTINE"));
            editor.putString("current_time", call.getString("current_time", ""));
            editor.putString("current_title", call.getString("current_title", "Free Time"));
            editor.putString("current_room", call.getString("current_room", "FREE"));
            editor.putString("current_elapsed", call.getString("current_elapsed", ""));
            editor.putInt("current_progress", call.getInt("current_progress", 0));
            editor.putString("current_remaining", call.getString("current_remaining", ""));

            editor.putString("next_label", call.getString("next_label", "FOLLOWING"));
            editor.putString("next_title", call.getString("next_title", ""));
            editor.putString("next_eta", call.getString("next_eta", ""));
            editor.putString("next_info", call.getString("next_info", ""));
            editor.putBoolean("show_next", call.getBoolean("show_next", true));
            editor.putString("theme_color", call.getString("theme_color", "dark"));
            editor.apply();

            // Save full schedule JSON to RoutineWidgetData for Matrix & List widgets
            String fullSchedule = call.getString("full_schedule_json", "");
            if (!fullSchedule.isEmpty()) {
                SharedPreferences dataPrefs = context.getSharedPreferences(DATA_PREFS_NAME, Context.MODE_PRIVATE);
                dataPrefs.edit().putString("full_schedule_json", fullSchedule).apply();
            }

            AppWidgetManager manager = AppWidgetManager.getInstance(context);

            // 1. Broadcast to Live Class Widget
            Intent liveIntent = new Intent(context, RoutineWidgetProvider.class);
            liveIntent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
            int[] liveIds = manager.getAppWidgetIds(new ComponentName(context, RoutineWidgetProvider.class));
            liveIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, liveIds);
            context.sendBroadcast(liveIntent);

            // 2. Broadcast to Landscape Matrix Widget
            Intent rotatedIntent = new Intent(context, RoutineRotatedWidgetProvider.class);
            rotatedIntent.setAction(RoutineRotatedWidgetProvider.ACTION_UPDATE_ROTATED_WIDGET);
            context.sendBroadcast(rotatedIntent);

            // 3. Broadcast to Portrait Routine Widget
            Intent listIntent = new Intent(context, RoutineListWidgetProvider.class);
            listIntent.setAction(RoutineListWidgetProvider.ACTION_UPDATE_LIST_WIDGET);
            context.sendBroadcast(listIntent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to update widget data: " + e.getMessage());
        }
    }

    @PluginMethod
    public void pinWidget(PluginCall call) {
        try {
            Context context = getContext();
            String type = call.getString("type", "live");

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                AppWidgetManager appWidgetManager = context.getSystemService(AppWidgetManager.class);
                if (appWidgetManager != null && appWidgetManager.isRequestPinAppWidgetSupported()) {
                    Class<?> providerClass = RoutineWidgetProvider.class;
                    if ("landscape".equalsIgnoreCase(type)) {
                        providerClass = RoutineRotatedWidgetProvider.class;
                    } else if ("portrait".equalsIgnoreCase(type)) {
                        providerClass = RoutineListWidgetProvider.class;
                    }

                    ComponentName myProvider = new ComponentName(context, providerClass);
                    Intent callbackIntent = new Intent(context, MainActivity.class);
                    PendingIntent successCallback = PendingIntent.getActivity(
                            context,
                            0,
                            callbackIntent,
                            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                    );

                    boolean requested = appWidgetManager.requestPinAppWidget(myProvider, null, successCallback);
                    JSObject ret = new JSObject();
                    ret.put("requested", requested);
                    call.resolve(ret);
                    return;
                }
            }

            JSObject ret = new JSObject();
            ret.put("requested", false);
            ret.put("reason", "Pinning not supported on this Android version/launcher");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not pin widget: " + e.getMessage());
        }
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        try {
            Context context = getContext();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
                if (pm != null && !pm.isIgnoringBatteryOptimizations(context.getPackageName())) {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + context.getPackageName()));
                    intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(intent);
                }
            }
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.resolve();
        }
    }
}
