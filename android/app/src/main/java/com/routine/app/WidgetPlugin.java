package com.routine.app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WidgetPlugin")
public class WidgetPlugin extends Plugin {

    private static final String PREFS_NAME = "RoutineWidgetData";

    @PluginMethod
    public void updateWidgetData(PluginCall call) {
        try {
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit();

            editor.putString("current_label", call.getString("current_label", "● NO CLASS ACTIVE"));
            editor.putString("current_time", call.getString("current_time", "--:-- – --:--"));
            editor.putString("current_title", call.getString("current_title", "No Active Class"));
            editor.putString("current_room", call.getString("current_room", "No Room"));
            editor.putString("current_elapsed", call.getString("current_elapsed", "00:00 elapsed"));
            editor.putInt("current_progress", call.getInt("current_progress", 0));
            editor.putString("current_remaining", call.getString("current_remaining", "Tap to open schedule"));

            editor.putString("next_label", call.getString("next_label", "NEXT"));
            editor.putString("next_title", call.getString("next_title", "No Class"));
            editor.putString("next_eta", call.getString("next_eta", "in --m"));
            editor.putString("next_info", call.getString("next_info", "Room: -- · --:--"));
            editor.putBoolean("show_next", call.getBoolean("show_next", true));

            editor.apply();

            // Broadcast to trigger Widget update
            Intent intent = new Intent(context, RoutineWidgetProvider.class);
            intent.setAction(RoutineWidgetProvider.ACTION_UPDATE_WIDGET);
            context.sendBroadcast(intent);

            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to update widget data: " + e.getMessage(), e);
        }
    }
}
