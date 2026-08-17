package com.routine.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;

/**
 * Supplies class cards for the vertical up/down touch-scrollable ListView.
 * Cards feature full subject theme colors, room/instructor, and status indicators.
 */
public class RoutineListRemoteViewsFactory implements RemoteViewsService.RemoteViewsFactory {

    private final Context ctx;
    private final List<Card> cards = new ArrayList<>();

    // Palette themes matching web app: [bgDark, badgeBg]
    private static final int[][] PALETTES = {
        {0xFF252859, 0x55818cf8},  // 0: Royal Indigo / Blue (EDC)
        {0xFF0b4d45, 0x5522d3ee},  // 1: Cyan Teal
        {0xFF0f4c5c, 0x552dd4bf},  // 2: Deep Ocean Teal
        {0xFF4c249f, 0x55c084fc},  // 3: Electric Violet (ICMP)
        {0xFF701235, 0x55fb7185},  // 4: Crimson / Ruby (DSL / Labs)
        {0xFF6e1273, 0x55f0abfc},  // 5: Fuchsia Magenta
        {0xFF09524a, 0x554ade80},  // 6: Emerald Green (DS)
        {0xFF0c4a6e, 0x5560a5fa},  // 7: Sapphire Azure
        {0xFF581c87, 0x55c084fc},  // 8: Berry Plum
        {0xFF78350f, 0x55fb923c},  // 9: Amber Orange
    };

    static class Card {
        String timeRange;
        String title;
        String subInfo;
        String badgeText;
        int    bgColor;
        boolean isLive;
        boolean isPast;
    }

    public RoutineListRemoteViewsFactory(Context ctx) {
        this.ctx = ctx;
    }

    @Override public void onCreate()          { loadData(); }
    @Override public void onDataSetChanged()  { loadData(); }
    @Override public void onDestroy()         { cards.clear(); }

    private void loadData() {
        cards.clear();
        SharedPreferences prefs = ctx.getSharedPreferences("RoutineWidgetData", Context.MODE_PRIVATE);
        String json = prefs.getString("full_schedule_json", "");

        Calendar cal = Calendar.getInstance();
        int todayIdx = cal.get(Calendar.DAY_OF_WEEK) - 1; // 0=Sun, ..., 6=Sat
        int selectedDayIdx = prefs.getInt("widget_selected_day_idx", todayIdx);
        int nowMins = cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE);

        if (json.isEmpty()) {
            Card empty = new Card();
            empty.timeRange = "--:-- → --:--";
            empty.title = "No Schedule Synced";
            empty.subInfo = "Open app to sync";
            empty.badgeText = "INFO";
            empty.bgColor = 0xFF111827;
            cards.add(empty);
            return;
        }

        try {
            JSONObject sched = new JSONObject(json);
            JSONArray dayArr = sched.optJSONArray(String.valueOf(selectedDayIdx));

            if (dayArr == null || dayArr.length() == 0) {
                Card empty = new Card();
                empty.timeRange = "--:-- → --:--";
                empty.title = "No Classes Scheduled";
                empty.subInfo = "Enjoy your day off!";
                empty.badgeText = "FREE";
                empty.bgColor = 0xFF111827;
                cards.add(empty);
                return;
            }

            for (int i = 0; i < dayArr.length(); i++) {
                JSONObject item = dayArr.optJSONObject(i);
                if (item == null) continue;

                Card c = new Card();
                String startStr = item.optString("start", "--:--");
                String endStr   = item.optString("end",   "--:--");
                c.timeRange = fmt12(startStr) + " → " + fmt12(endStr);
                c.title = item.optString("title", "Unknown");

                String room = item.optString("room", "");
                String instr = item.optString("instructor", "");
                String roomStr = room.isEmpty() ? "" : "Room " + room;
                String sub = roomStr;
                if (!instr.isEmpty()) {
                    sub += (sub.isEmpty() ? "" : " · ") + instr;
                }
                c.subInfo = sub.isEmpty() ? "No room info" : sub;

                String type = item.optString("type", "THEORY");
                boolean isLab = "LAB".equalsIgnoreCase(type);
                boolean isExam = item.optBoolean("isExam", false);
                c.badgeText = isExam ? "📝 EXAM" : (isLab ? "★ LAB" : type.toUpperCase());

                int pi = Math.abs(c.title.hashCode()) % PALETTES.length;
                if (isLab) {
                    c.bgColor = 0xFF701235; // Crimson Red for Labs
                } else {
                    c.bgColor = PALETTES[pi][0];
                }

                if (selectedDayIdx == todayIdx) {
                    int sm = RoutineScheduleEngine.parseTimeToMins(startStr);
                    int em = RoutineScheduleEngine.parseTimeToMins(endStr);
                    if (sm != -1 && em != -1) {
                        c.isLive = nowMins >= sm && nowMins < em;
                        c.isPast = nowMins >= em;
                    }
                }

                cards.add(c);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public int getCount() {
        return cards.size();
    }

    @Override
    public RemoteViews getViewAt(int position) {
        if (position < 0 || position >= cards.size()) return null;
        Card card = cards.get(position);

        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.widget_list_item);

        rv.setTextViewText(R.id.card_title, card.title);
        rv.setTextViewText(R.id.card_sub, card.subInfo);
        rv.setTextViewText(R.id.card_badge, card.badgeText);
        rv.setInt(R.id.card_root, "setBackgroundColor", card.bgColor);
        rv.setTextColor(R.id.card_title, 0xFFFFFFFF);
        rv.setTextColor(R.id.card_sub, 0xFFe2e8f0);
        rv.setTextColor(R.id.card_badge, 0xFFFFFFFF);

        if (card.isLive) {
            rv.setTextViewText(R.id.card_time, "● LIVE  " + card.timeRange);
            rv.setTextColor(R.id.card_time, 0xFF38bdf8);
        } else if (card.isPast) {
            rv.setTextViewText(R.id.card_time, card.timeRange + "  ✓");
            rv.setTextColor(R.id.card_time, 0xFFcbd5e1);
        } else {
            rv.setTextViewText(R.id.card_time, card.timeRange);
            rv.setTextColor(R.id.card_time, 0xFFcbd5e1);
        }

        return rv;
    }

    @Override public RemoteViews getLoadingView() { return null; }
    @Override public int getViewTypeCount()       { return 1; }
    @Override public long getItemId(int pos)      { return pos; }
    @Override public boolean hasStableIds()       { return true; }

    private static String fmt12(String raw) {
        int m = RoutineScheduleEngine.parseTimeToMins(raw);
        if (m < 0) return raw;
        int h = m / 60, min = m % 60;
        String ap = h >= 12 ? "PM" : "AM";
        int h12 = h % 12;
        if (h12 == 0) h12 = 12;
        return String.format("%02d:%02d %s", h12, min, ap);
    }
}
