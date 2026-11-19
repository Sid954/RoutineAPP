package com.routine.app;

import android.content.Context;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;

/** Rows of the day-list widget: the selected day's classes with live/done/cancelled states. */
public class RoutineListRemoteViewsFactory implements RemoteViewsService.RemoteViewsFactory {

    private final Context ctx;
    private final List<Row> rows = new ArrayList<>();

    // Subject colours (dark surfaces) matching the app's palettes; labs always crimson
    static final int[] PALETTE = {0xFF252859, 0xFF0B4D45, 0xFF0F4C5C, 0xFF4C249F, 0xFF6E1273, 0xFF09524A, 0xFF0C4A6E, 0xFF581C87, 0xFF78350F};
    static final int LAB = 0xFF701235, MUTED_BG = 0xFF1F2937, EMPTY_BG = 0xFF111827;

    static final class Row {
        String time, title, sub, badge;
        int bg, timeColor;
    }

    public RoutineListRemoteViewsFactory(Context ctx) { this.ctx = ctx; }

    @Override public void onCreate() { load(); }
    @Override public void onDataSetChanged() { load(); }
    @Override public void onDestroy() { rows.clear(); }

    static int colorFor(WidgetNow.Cls c) {
        if (c.isLab()) return LAB;
        return PALETTE[Math.abs(c.title.hashCode()) % PALETTE.length];
    }

    static String badgeFor(WidgetNow.Cls c) {
        if ("cancelled".equals(c.status)) return "CANCELLED";
        if ("moved_away".equals(c.status)) return "MOVED";
        if (c.exam) return "TEST";
        if ("online".equals(c.status)) return "ONLINE";
        if ("extra".equals(c.status)) return "EXTRA";
        if ("moved_in".equals(c.status)) return "RESCHEDULED";
        return c.isLab() ? "LAB" : "THEORY";
    }

    private void load() {
        rows.clear();
        WidgetData data = WidgetData.load(ctx);
        Calendar now = Calendar.getInstance();
        if (!data.hasData()) {
            rows.add(empty("Open the app to sync", "Your routine appears here after the first sync"));
            return;
        }
        int sel = WidgetUpdater.selectedDow(ctx, now);
        Calendar date = WidgetUpdater.dateForDow(now, sel);
        boolean isToday = WidgetData.ymd(date).equals(WidgetData.ymd(now));
        int nowMins = WidgetNow.minutesOf(now);
        WidgetNow.Day day = data.dayFor(date);

        if (day.classes.isEmpty()) {
            rows.add(empty(day.holiday.isEmpty() ? "No classes" : day.holiday, day.holiday.isEmpty() ? "Nothing in the routine for this day" : "Holiday"));
            return;
        }
        if (!day.holiday.isEmpty()) rows.add(empty(day.holiday, "Holiday: classes are off unless moved online"));

        for (WidgetNow.Cls c : day.classes) {
            Row r = new Row();
            boolean held = c.isHeld();
            boolean live = isToday && held && nowMins >= c.start && nowMins < c.end;
            boolean past = isToday && nowMins >= c.end;
            r.title = c.title;
            String room = WidgetUpdater.roomText(c);
            String sub = ("ONLINE".equals(room) ? "Online" : "Room " + room) + (c.instructor.isEmpty() ? "" : " · " + c.instructor);
            if (!c.note.isEmpty() && !held) sub = c.note;
            r.sub = sub;
            r.badge = badgeFor(c);
            r.bg = held ? colorFor(c) : MUTED_BG;
            String range = WidgetNow.t12(c.start) + " – " + WidgetNow.t12(c.end);
            if (live) {
                r.time = "● NOW · " + WidgetNow.dur(c.end - nowMins) + " left";
                r.timeColor = WidgetUpdater.C_ACCENT;
            } else if (past && held) {
                r.time = range + "  ✓";
                r.timeColor = 0xFF94A3B8;
            } else if (isToday && held && c.start > nowMins && c.start - nowMins <= 60) {
                r.time = range + " · in " + WidgetNow.dur(c.start - nowMins);
                r.timeColor = WidgetUpdater.C_WARN;
            } else {
                r.time = range;
                r.timeColor = held ? 0xFFCBD5E1 : WidgetUpdater.C_DANGER;
            }
            rows.add(r);
        }
    }

    private static Row empty(String title, String sub) {
        Row r = new Row();
        r.time = "";
        r.title = title;
        r.sub = sub;
        r.badge = "";
        r.bg = EMPTY_BG;
        r.timeColor = 0xFF94A3B8;
        return r;
    }

    @Override public int getCount() { return rows.size(); }

    @Override
    public RemoteViews getViewAt(int position) {
        if (position < 0 || position >= rows.size()) return null;
        Row r = rows.get(position);
        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.widget_list_item);
        rv.setTextViewText(R.id.card_time, r.time);
        rv.setTextColor(R.id.card_time, r.timeColor);
        rv.setTextViewText(R.id.card_title, r.title);
        rv.setTextColor(R.id.card_title, 0xFFFFFFFF);
        rv.setTextViewText(R.id.card_sub, r.sub);
        rv.setTextColor(R.id.card_sub, 0xFFE2E8F0);
        rv.setTextViewText(R.id.card_badge, r.badge);
        rv.setTextColor(R.id.card_badge, 0xFFFFFFFF);
        rv.setViewVisibility(R.id.card_badge, r.badge.isEmpty() ? android.view.View.GONE : android.view.View.VISIBLE);
        rv.setInt(R.id.card_root, "setBackgroundColor", r.bg);
        return rv;
    }

    @Override public RemoteViews getLoadingView() { return null; }
    @Override public int getViewTypeCount() { return 1; }
    @Override public long getItemId(int pos) { return pos; }
    @Override public boolean hasStableIds() { return false; }
}
