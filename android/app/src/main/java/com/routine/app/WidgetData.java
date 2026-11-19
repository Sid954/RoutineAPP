package com.routine.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.Collections;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Widget data store. The web app sends (WidgetPlugin.updateWidgetData) a dated schedule:
 *
 *   { "v": 2, "generatedAt": ms,
 *     "days": { "2026-11-17": { "holiday": "", "classes": [ {t,r,i,ty,s,e,st,x,n} ] }, ... 14 days },
 *     "week": { "0": [ ... ], ..., "6": [ ... ] } }      // base routine, no announcements
 *
 *   t title, r room, i instructor, ty type, s/e start/end minutes, st status
 *   (normal|cancelled|moved_away|moved_in|extra|online), x exam (bool), n note
 *
 * Dates inside the 14-day window use announcements as of the last sync; later dates fall back
 * to the plain weekly routine. Old builds stored a weekday-keyed "full_schedule_json"; that is
 * still read until the app sends v2.
 */
public final class WidgetData implements WidgetNow.Source {

    public static final String PREFS = "RoutineWidgetData";
    public static final String KEY_V2 = "schedule_v2";
    public static final String KEY_LEGACY = "full_schedule_json";

    private final Map<String, WidgetNow.Day> days = new HashMap<>();
    private final Map<Integer, WidgetNow.Day> week = new HashMap<>();
    private boolean has = false;
    public long generatedAt = 0;

    private WidgetData() {}

    public static WidgetData load(Context ctx) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        WidgetData d = new WidgetData();
        String v2 = p.getString(KEY_V2, "");
        try {
            if (!v2.isEmpty()) d.parseV2(new JSONObject(v2));
            else {
                String legacy = p.getString(KEY_LEGACY, "");
                if (!legacy.isEmpty()) d.parseLegacy(new JSONObject(legacy));
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return d;
    }

    public static void save(Context ctx, String v2Json) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_V2, v2Json).apply();
    }

    @Override public boolean hasData() { return has; }

    @Override
    public WidgetNow.Day dayFor(Calendar date) {
        WidgetNow.Day d = days.get(ymd(date));
        if (d != null) return d;
        d = week.get(date.get(Calendar.DAY_OF_WEEK) - 1);
        return d != null ? d : new WidgetNow.Day();
    }

    public static String ymd(Calendar c) {
        return String.format(Locale.US, "%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    private void parseV2(JSONObject root) {
        generatedAt = root.optLong("generatedAt", 0);
        JSONObject ds = root.optJSONObject("days");
        if (ds != null) {
            JSONArray names = ds.names();
            if (names != null) for (int i = 0; i < names.length(); i++) {
                String key = names.optString(i);
                JSONObject o = ds.optJSONObject(key);
                if (o == null) continue;
                WidgetNow.Day day = new WidgetNow.Day();
                day.holiday = o.optString("holiday", "");
                readClasses(o.optJSONArray("classes"), day);
                days.put(key, day);
            }
        }
        JSONObject wk = root.optJSONObject("week");
        if (wk != null) for (int dow = 0; dow < 7; dow++) {
            WidgetNow.Day day = new WidgetNow.Day();
            readClasses(wk.optJSONArray(String.valueOf(dow)), day);
            week.put(dow, day);
        }
        has = !days.isEmpty() || !week.isEmpty();
    }

    private void readClasses(JSONArray arr, WidgetNow.Day day) {
        if (arr == null) return;
        for (int i = 0; i < arr.length(); i++) {
            JSONObject o = arr.optJSONObject(i);
            if (o == null) continue;
            WidgetNow.Cls c = new WidgetNow.Cls();
            c.title = o.optString("t", "Class");
            c.room = o.optString("r", "");
            c.instructor = o.optString("i", "");
            c.type = o.optString("ty", "Theory");
            c.start = o.optInt("s", -1);
            c.end = o.optInt("e", -1);
            if (c.end <= c.start && c.start >= 0) c.end = c.start + 75;
            c.status = o.optString("st", "normal");
            c.exam = o.optBoolean("x", false);
            c.note = o.optString("n", "");
            if (c.start >= 0) day.classes.add(c);
        }
        Collections.sort(day.classes, (a, b) -> Integer.compare(a.start, b.start));
    }

    private void parseLegacy(JSONObject root) {
        for (int dow = 0; dow < 7; dow++) {
            JSONArray arr = root.optJSONArray(String.valueOf(dow));
            WidgetNow.Day day = new WidgetNow.Day();
            if (arr != null) for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.optJSONObject(i);
                if (o == null) continue;
                WidgetNow.Cls c = new WidgetNow.Cls();
                c.title = o.optString("title", "Class");
                c.room = o.optString("room", "");
                c.instructor = o.optString("instructor", "");
                c.type = o.optString("type", "Theory");
                c.start = WidgetNow.parseTime(o.optString("start", ""));
                c.end = WidgetNow.parseTime(o.optString("end", ""));
                if (c.end <= c.start && c.start >= 0) c.end = c.start + 75;
                if ("ONLINE".equalsIgnoreCase(c.room)) c.status = "online";
                if (c.start >= 0) day.classes.add(c);
            }
            Collections.sort(day.classes, (a, b) -> Integer.compare(a.start, b.start));
            week.put(dow, day);
            if (!day.classes.isEmpty()) has = true;
        }
        if (!has) has = root.length() > 0;
    }

    /**
     * Date of weekday `dow` in the academic week (Thu → Wed) that contains `today`,
     * the same rule the app uses (overrides.js getDateForDayIndex).
     */
    public static Calendar academicDate(Calendar today, int dow) {
        Calendar base = WidgetNow.dayStart(today, 0);
        int todayDow = base.get(Calendar.DAY_OF_WEEK) - 1;
        int thuOffset = (todayDow - 4 + 7) % 7;
        int targetOffset = (dow - 4 + 7) % 7;
        base.add(Calendar.DAY_OF_MONTH, targetOffset - thuOffset);
        return base;
    }
}
