package com.routine.app;

import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import java.util.Calendar;

/** Rows of the week widget: Sat–Wed, each with that date's class cards. Reloads on every refresh. */
public class RoutineRotatedRemoteViewsFactory implements RemoteViewsService.RemoteViewsFactory {

    private final Context ctx;
    private static final String[] LABELS = {"SAT", "SUN", "MON", "TUE", "WED"};

    private WidgetData data;
    private Calendar now;
    private int widthDp = 360;

    public RoutineRotatedRemoteViewsFactory(Context ctx) { this.ctx = ctx; }

    private void load() {
        data = WidgetData.load(ctx);
        now = Calendar.getInstance();
        widthDp = ctx.getSharedPreferences(WidgetData.PREFS, Context.MODE_PRIVATE).getInt("widget_rotated_width_dp", 360);
    }

    @Override public void onCreate() { load(); }
    @Override public void onDataSetChanged() { load(); }   // was empty: the week view never reloaded
    @Override public void onDestroy() { }
    @Override public int getCount() { return WidgetUpdater.CLASS_DAYS.length; }

    @Override
    public RemoteViews getViewAt(int position) {
        if (position < 0 || position >= WidgetUpdater.CLASS_DAYS.length) return null;
        if (data == null) load();
        int dow = WidgetUpdater.CLASS_DAYS[position];
        Calendar date = WidgetUpdater.dateForDow(now, dow);
        boolean isToday = WidgetData.ymd(date).equals(WidgetData.ymd(now));
        int nowMins = WidgetNow.minutesOf(now);

        RemoteViews row = new RemoteViews(ctx.getPackageName(), R.layout.widget_rotated_row);
        row.setInt(R.id.rotated_day_box, "setBackgroundResource", isToday ? R.drawable.widget_tab_btn_active_bg : R.drawable.widget_tab_btn_bg);
        row.setViewVisibility(R.id.rotated_day_badge, View.GONE);
        row.setTextViewText(R.id.rotated_day_name, LABELS[position] + "\n" + date.get(Calendar.DAY_OF_MONTH));
        row.setTextColor(R.id.rotated_day_name, isToday ? WidgetUpdater.C_ACCENT : WidgetUpdater.C_MUTED);
        row.removeAllViews(R.id.rotated_cards_container);

        WidgetNow.Day day = data.hasData() ? data.dayFor(date) : new WidgetNow.Day();
        int n = Math.max(1, day.classes.size());
        int cardWidth = Math.max(160, widthDp - 60) / n;
        int layout = (cardWidth < 85 || n >= 4) ? R.layout.widget_rotated_card_sm : R.layout.widget_rotated_card;

        if (day.classes.isEmpty()) {
            RemoteViews c = new RemoteViews(ctx.getPackageName(), layout);
            c.setTextViewText(R.id.rotated_card_title, !data.hasData() ? "Open app" : (day.holiday.isEmpty() ? "No classes" : day.holiday));
            c.setTextViewText(R.id.rotated_card_time, !data.hasData() ? "to sync" : (day.holiday.isEmpty() ? "Free day" : "Holiday"));
            c.setTextViewText(R.id.rotated_card_sub, "—");
            c.setInt(R.id.rotated_card_root, "setBackgroundColor", RoutineListRemoteViewsFactory.EMPTY_BG);
            c.setTextColor(R.id.rotated_card_title, day.holiday.isEmpty() ? 0xFF64748B : WidgetUpdater.C_WARN);
            c.setTextColor(R.id.rotated_card_time, 0xFF475569);
            c.setTextColor(R.id.rotated_card_sub, 0xFF334155);
            row.addView(R.id.rotated_cards_container, c);
            return row;
        }

        for (WidgetNow.Cls cl : day.classes) {
            boolean held = cl.isHeld();
            boolean live = isToday && held && nowMins >= cl.start && nowMins < cl.end;
            boolean past = isToday && nowMins >= cl.end;
            RemoteViews c = new RemoteViews(ctx.getPackageName(), layout);
            c.setTextViewText(R.id.rotated_card_title, cl.title);
            String room = WidgetUpdater.roomText(cl);
            String sub = held ? (("ONLINE".equals(room) ? "Online" : room) + (cl.instructor.isEmpty() ? "" : " · " + cl.instructor))
                    : RoutineListRemoteViewsFactory.badgeFor(cl);
            c.setTextViewText(R.id.rotated_card_sub, sub);
            c.setInt(R.id.rotated_card_root, "setBackgroundColor", held ? RoutineListRemoteViewsFactory.colorFor(cl) : RoutineListRemoteViewsFactory.MUTED_BG);
            c.setTextColor(R.id.rotated_card_title, held ? 0xFFFFFFFF : 0xFF94A3B8);
            c.setTextColor(R.id.rotated_card_sub, held ? 0xFFE2E8F0 : WidgetUpdater.C_DANGER);
            String range = shortT(cl.start) + "–" + shortT(cl.end);
            if (live) {
                c.setTextViewText(R.id.rotated_card_time, "● " + WidgetNow.dur(cl.end - nowMins) + " left");
                c.setTextColor(R.id.rotated_card_time, WidgetUpdater.C_ACCENT);
            } else {
                c.setTextViewText(R.id.rotated_card_time, past && held ? range + " ✓" : range + (cl.exam ? " · TEST" : ""));
                c.setTextColor(R.id.rotated_card_time, cl.exam && held ? WidgetUpdater.C_WARN : 0xFFCBD5E1);
            }
            row.addView(R.id.rotated_cards_container, c);
        }
        return row;
    }

    private static String shortT(int mins) {
        if (mins < 0) return "--";
        int h = (mins / 60) % 24, m = mins % 60;
        return (h % 12 == 0 ? 12 : h % 12) + ":" + (m < 10 ? "0" : "") + m;
    }

    @Override public RemoteViews getLoadingView() { return null; }
    @Override public int getViewTypeCount() { return 1; }
    @Override public long getItemId(int pos) { return pos; }
    @Override public boolean hasStableIds() { return false; }
}
