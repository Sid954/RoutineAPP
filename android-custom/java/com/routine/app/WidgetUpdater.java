package com.routine.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

import java.util.Calendar;

/**
 * Single entry point for all three widgets: render everything from WidgetData + WidgetNow
 * (no app needed), then arm ONE alarm for the next moment the content changes.
 * Triggered by: WidgetPlugin (app sync), the providers, WidgetUpdateReceiver (alarm,
 * boot, app update, time/timezone change) and the refresh buttons.
 */
public final class WidgetUpdater {

    public static final String ACTION_TICK = "com.routine.app.WIDGET_TICK";
    private static final int ALARM_RC = 4242;

    // Palette (dark widget surfaces)
    static final int C_ACCENT = Color.parseColor("#38BDF8");
    static final int C_LIVE = Color.parseColor("#34D399");
    static final int C_WARN = Color.parseColor("#F59E0B");
    static final int C_MUTED = Color.parseColor("#94A3B8");
    static final int C_DANGER = Color.parseColor("#FB7185");

    // Class days shown in the day tabs / week rows (Sat → Wed)
    static final int[] CLASS_DAYS = {6, 0, 1, 2, 3};

    private WidgetUpdater() {}

    /** Re-render every widget and re-arm the alarm. Safe to call often. */
    public static void updateAll(Context ctx) {
        Context app = ctx.getApplicationContext();
        AppWidgetManager awm = AppWidgetManager.getInstance(app);
        WidgetData data = WidgetData.load(app);
        Calendar now = Calendar.getInstance();

        int[] live = ids(app, awm, RoutineWidgetProvider.class);
        for (int id : live) renderLive(app, awm, id, data, now);

        int[] list = ids(app, awm, RoutineListWidgetProvider.class);
        for (int id : list) RoutineListWidgetProvider.render(app, awm, id, now);
        if (list.length > 0) awm.notifyAppWidgetViewDataChanged(list, R.id.widget_list_view);

        int[] week = ids(app, awm, RoutineRotatedWidgetProvider.class);
        for (int id : week) RoutineRotatedWidgetProvider.render(app, awm, id, now);
        if (week.length > 0) awm.notifyAppWidgetViewDataChanged(week, R.id.widget_rotated_list);

        if (live.length + list.length + week.length > 0) schedule(app, WidgetNow.nextRefreshAt(data, now));
        else cancel(app);
    }

    static int[] ids(Context ctx, AppWidgetManager awm, Class<?> cls) {
        int[] r = awm.getAppWidgetIds(new ComponentName(ctx, cls));
        return r == null ? new int[0] : r;
    }

    /* ── Alarm ─────────────────────────────────────────────────────────── */
    private static PendingIntent tickIntent(Context ctx) {
        Intent i = new Intent(ctx, WidgetUpdateReceiver.class).setAction(ACTION_TICK);
        return PendingIntent.getBroadcast(ctx, ALARM_RC, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void schedule(Context ctx, long atMillis) {
        try {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            PendingIntent pi = tickIntent(ctx);
            boolean exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms();
            if (exact && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC, atMillis, pi);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setAndAllowWhileIdle(AlarmManager.RTC, atMillis, pi);
            } else {
                am.setExact(AlarmManager.RTC, atMillis, pi);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    static void cancel(Context ctx) {
        try {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            if (am != null) am.cancel(tickIntent(ctx));
        } catch (Exception ignored) {}
    }

    /* ── Shared click intents ──────────────────────────────────────────── */
    static PendingIntent openApp(Context ctx, int rc) {
        Intent i = new Intent(ctx, MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(ctx, rc, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static PendingIntent refresh(Context ctx, int rc) {
        Intent i = new Intent(ctx, WidgetUpdateReceiver.class).setAction(ACTION_TICK);
        return PendingIntent.getBroadcast(ctx, rc, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /* ── Live class widget ─────────────────────────────────────────────── */
    static String roomText(WidgetNow.Cls c) {
        if (c.isOnline()) return "ONLINE";
        String r = c.room == null ? "" : c.room.replaceFirst("(?i)^room\\s*", "").trim();
        return r.isEmpty() || "TBA".equalsIgnoreCase(r) ? "TBA" : r;
    }

    static String withTeacher(WidgetNow.Cls c) {
        return c.instructor == null || c.instructor.isEmpty() ? c.title : c.title + " (" + c.instructor + ")";
    }

    static String range(WidgetNow.Cls c) {
        return WidgetNow.t12(c.start) + " – " + WidgetNow.t12(c.end);
    }

    static String infoLine(WidgetNow.Cls c) {
        String room = roomText(c);
        return ("ONLINE".equals(room) ? "Online" : "Room " + room) + " · " + range(c);
    }

    static void renderLive(Context ctx, AppWidgetManager awm, int id, WidgetData data, Calendar now) {
        try {
            RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_routine_adaptive);
            WidgetNow.Snapshot s = WidgetNow.compute(data, now);

            String status, time, title, room, elapsed, remaining;
            int statusColor = C_ACCENT, progress = 0;
            boolean showProgress = false;

            switch (s.kind) {
                case LIVE: {
                    WidgetNow.Cls c = s.current;
                    status = "● IN CLASS" + (s.heldToday > 1 ? " · " + s.indexToday + " OF " + s.heldToday : "");
                    statusColor = C_LIVE;
                    time = range(c);
                    title = withTeacher(c) + (c.exam ? " · TEST" : "");
                    room = roomText(c);
                    elapsed = WidgetNow.dur(s.elapsedMins) + " in";
                    remaining = WidgetNow.dur(s.leftMins) + " left";
                    progress = s.progress;
                    showProgress = true;
                    break;
                }
                case BREAK:
                case BEFORE: {
                    WidgetNow.Cls c = s.next;
                    boolean soon = s.inMins <= 15;
                    status = soon ? "● STARTS IN " + WidgetNow.dur(s.inMins).toUpperCase()
                            : (s.kind == WidgetNow.Kind.BEFORE ? "● FIRST CLASS" : "● FREE NOW · NEXT");
                    statusColor = soon ? C_WARN : C_ACCENT;
                    time = range(c);
                    title = withTeacher(c) + (c.exam ? " · TEST" : "");
                    room = roomText(c);
                    elapsed = "Starts " + WidgetNow.t12(c.start);
                    remaining = "in " + WidgetNow.dur(s.inMins);
                    break;
                }
                case DONE:
                    status = "● DONE FOR TODAY";
                    statusColor = C_LIVE;
                    time = s.heldToday + (s.heldToday == 1 ? " class" : " classes");
                    title = "All classes done";
                    room = "DONE";
                    elapsed = "";
                    remaining = "";
                    break;
                case HOLIDAY:
                    status = "● HOLIDAY";
                    statusColor = C_WARN;
                    time = "No classes";
                    title = s.holiday;
                    room = "OFF";
                    elapsed = "";
                    remaining = "";
                    break;
                case OFF:
                    status = "● OFF DAY";
                    statusColor = C_MUTED;
                    time = "No classes";
                    title = "No classes today";
                    room = "OFF";
                    elapsed = "";
                    remaining = "";
                    break;
                default:
                    status = "● ROUTINE";
                    statusColor = C_MUTED;
                    time = "";
                    title = "Open the app to sync";
                    room = "—";
                    elapsed = "";
                    remaining = "Your routine appears here after the first sync";
            }

            v.setTextViewText(R.id.widget_status_label, status);
            v.setTextColor(R.id.widget_status_label, statusColor);
            v.setTextViewText(R.id.widget_time_range, time);
            v.setTextViewText(R.id.widget_course_title, title);
            v.setTextViewText(R.id.widget_room_chip, room);
            v.setTextViewText(R.id.widget_elapsed_text, elapsed);
            v.setTextViewText(R.id.widget_remaining_text, remaining);
            v.setProgressBar(R.id.widget_progress_bar, 100, progress, false);
            v.setViewVisibility(R.id.widget_progress_bar, showProgress ? View.VISIBLE : View.GONE);
            v.setViewVisibility(R.id.widget_progress_container,
                    (elapsed.isEmpty() && remaining.isEmpty() && !showProgress) ? View.GONE : View.VISIBLE);

            // Second card: what comes after the main card
            WidgetNow.Cls second = null;
            String label = "NEXT", eta = "";
            if (s.kind == WidgetNow.Kind.LIVE) {
                if (s.next != null) {
                    second = s.next;
                    if (s.nextDaysAhead == 0) {
                        label = "NEXT";
                        eta = s.inMins <= 60 ? "in " + WidgetNow.dur(s.inMins) : "at " + WidgetNow.t12(second.start);
                    } else {
                        label = WidgetNow.relDay(s.nextDate, s.nextDaysAhead).toUpperCase();
                        eta = WidgetNow.t12(second.start);
                    }
                }
            } else if (s.kind == WidgetNow.Kind.BREAK || s.kind == WidgetNow.Kind.BEFORE) {
                if (s.afterNext != null) {
                    second = s.afterNext;
                    label = "THEN";
                    eta = "at " + WidgetNow.t12(second.start);
                }
            } else if (s.next != null) {
                second = s.next;
                label = WidgetNow.relDay(s.nextDate, s.nextDaysAhead).toUpperCase();
                eta = WidgetNow.t12(second.start);
            }

            int minHeight = 200;
            Bundle options = awm.getAppWidgetOptions(id);
            if (options != null) minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 200);
            if (second != null && minHeight >= 110) {
                v.setViewVisibility(R.id.widget_next_card, View.VISIBLE);
                v.setTextViewText(R.id.widget_next_label, label);
                v.setTextViewText(R.id.widget_next_title, withTeacher(second));
                v.setTextViewText(R.id.widget_next_eta, eta);
                v.setTextViewText(R.id.widget_next_info, infoLine(second));
            } else {
                v.setViewVisibility(R.id.widget_next_card, View.GONE);
            }

            v.setOnClickPendingIntent(R.id.widget_current_card, openApp(ctx, 10));
            v.setOnClickPendingIntent(R.id.widget_next_card, openApp(ctx, 10));
            v.setOnClickPendingIntent(R.id.widget_refresh_btn, refresh(ctx, 11));
            awm.updateAppWidget(id, v);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /* ── Day selection for the day-list widget ─────────────────────────── */
    private static final String SEL_DOW = "list_sel_dow", SEL_DATE = "list_sel_date";

    static boolean isClassDay(int dow) {
        for (int d : CLASS_DAYS) if (d == dow) return true;
        return false;
    }

    /** Selected weekday; resets to today (or Saturday on Thu/Fri) when the date changes. */
    static int selectedDow(Context ctx, Calendar now) {
        SharedPreferences p = ctx.getSharedPreferences(WidgetData.PREFS, Context.MODE_PRIVATE);
        String today = WidgetData.ymd(now);
        if (today.equals(p.getString(SEL_DATE, ""))) {
            int d = p.getInt(SEL_DOW, -1);
            if (d >= 0) return d;
        }
        int todayDow = now.get(Calendar.DAY_OF_WEEK) - 1;
        return isClassDay(todayDow) ? todayDow : 6;
    }

    static void selectDow(Context ctx, int dow) {
        ctx.getSharedPreferences(WidgetData.PREFS, Context.MODE_PRIVATE).edit()
                .putInt(SEL_DOW, dow).putString(SEL_DATE, WidgetData.ymd(Calendar.getInstance())).apply();
    }

    /** The date the selected weekday stands for (next one, if it already passed this week). */
    static Calendar dateForDow(Calendar now, int dow) {
        Calendar d = WidgetData.academicDate(now, dow);
        if (d.before(WidgetNow.dayStart(now, 0))) d.add(Calendar.DAY_OF_MONTH, 7);
        return d;
    }
}
