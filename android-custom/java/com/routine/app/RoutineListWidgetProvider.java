package com.routine.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

import java.util.Calendar;

/**
 * Day-list widget: Sat–Wed tabs and the chosen day's classes. The choice resets to today
 * (Saturday on Thu/Fri) every new day. Each tab shows the next date for that weekday, with
 * that date's announcements (cancelled / online / moved / tests) applied.
 */
public class RoutineListWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_SELECT_DAY = "com.routine.app.ACTION_SELECT_DAY";
    public static final String ACTION_PREV_DAY = "com.routine.app.ACTION_PREV_DAY";
    public static final String ACTION_NEXT_DAY = "com.routine.app.ACTION_NEXT_DAY";
    // Kept so older code paths that broadcast it still refresh this widget
    public static final String ACTION_UPDATE_LIST_WIDGET = "com.routine.app.ACTION_UPDATE_LIST_WIDGET";

    private static final String[] DAY_LABELS = {"Sat", "Sun", "Mon", "Tue", "Wed"};
    private static final int[] TAB_IDS = {R.id.tab_sat, R.id.tab_sun, R.id.tab_mon, R.id.tab_tue, R.id.tab_wed};

    @Override
    public void onUpdate(Context ctx, AppWidgetManager awm, int[] ids) {
        WidgetUpdater.updateAll(ctx);
    }

    @Override
    public void onEnabled(Context ctx) { WidgetUpdater.updateAll(ctx); }

    @Override
    public void onDisabled(Context ctx) { WidgetUpdater.updateAll(ctx); }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        super.onReceive(ctx, intent);
        String a = intent == null ? null : intent.getAction();
        if (a == null) return;
        Calendar now = Calendar.getInstance();
        int cur = WidgetUpdater.selectedDow(ctx, now);
        int pos = posOf(cur);
        if (ACTION_SELECT_DAY.equals(a)) {
            int dow = intent.getIntExtra("selected_day_idx", -1);
            if (dow < 0) return;
            WidgetUpdater.selectDow(ctx, dow);
        } else if (ACTION_PREV_DAY.equals(a)) {
            WidgetUpdater.selectDow(ctx, WidgetUpdater.CLASS_DAYS[(pos - 1 + 5) % 5]);
        } else if (ACTION_NEXT_DAY.equals(a)) {
            WidgetUpdater.selectDow(ctx, WidgetUpdater.CLASS_DAYS[(pos + 1) % 5]);
        } else if (!ACTION_UPDATE_LIST_WIDGET.equals(a)) {
            return;
        }
        AppWidgetManager awm = AppWidgetManager.getInstance(ctx);
        int[] ids = WidgetUpdater.ids(ctx, awm, RoutineListWidgetProvider.class);
        for (int id : ids) render(ctx, awm, id, now);
        awm.notifyAppWidgetViewDataChanged(ids, R.id.widget_list_view);
    }

    private static int posOf(int dow) {
        for (int i = 0; i < WidgetUpdater.CLASS_DAYS.length; i++) if (WidgetUpdater.CLASS_DAYS[i] == dow) return i;
        return 0;
    }

    private static PendingIntent self(Context ctx, String action, int rc, int dow) {
        Intent i = new Intent(ctx, RoutineListWidgetProvider.class).setAction(action);
        if (dow >= 0) i.putExtra("selected_day_idx", dow);
        return PendingIntent.getBroadcast(ctx, rc, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void render(Context ctx, AppWidgetManager awm, int id, Calendar now) {
        try {
            RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_list_layout);
            int todayDow = now.get(Calendar.DAY_OF_WEEK) - 1;
            int sel = WidgetUpdater.selectedDow(ctx, now);

            for (int i = 0; i < WidgetUpdater.CLASS_DAYS.length; i++) {
                int dow = WidgetUpdater.CLASS_DAYS[i];
                Calendar date = WidgetUpdater.dateForDow(now, dow);
                boolean isSel = dow == sel, isToday = dow == todayDow;
                v.setTextViewText(TAB_IDS[i], DAY_LABELS[i] + " " + date.get(Calendar.DAY_OF_MONTH));
                v.setInt(TAB_IDS[i], "setBackgroundResource", isSel ? R.drawable.widget_tab_btn_active_bg : R.drawable.widget_tab_btn_bg);
                v.setTextColor(TAB_IDS[i], isSel || isToday ? WidgetUpdater.C_ACCENT : WidgetUpdater.C_MUTED);
                v.setOnClickPendingIntent(TAB_IDS[i], self(ctx, ACTION_SELECT_DAY, 100 + dow, dow));
            }
            v.setOnClickPendingIntent(R.id.tab_prev, self(ctx, ACTION_PREV_DAY, 990, -1));
            v.setOnClickPendingIntent(R.id.tab_next, self(ctx, ACTION_NEXT_DAY, 991, -1));

            Calendar selDate = WidgetUpdater.dateForDow(now, sel);
            boolean selIsToday = WidgetData.ymd(selDate).equals(WidgetData.ymd(now));
            String[] names = {"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"};
            v.setTextViewText(R.id.widget_list_title, selIsToday ? "Today" : names[sel] + " " + selDate.get(Calendar.DAY_OF_MONTH));

            Intent svc = new Intent(ctx, RoutineListRemoteViewsService.class);
            svc.setData(Uri.fromParts("content", String.valueOf(id), null));
            v.setRemoteAdapter(R.id.widget_list_view, svc);

            v.setOnClickPendingIntent(R.id.widget_list_reload, WidgetUpdater.refresh(ctx, 12));
            v.setOnClickPendingIntent(R.id.widget_list_title, WidgetUpdater.openApp(ctx, 13));
            awm.updateAppWidget(id, v);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
