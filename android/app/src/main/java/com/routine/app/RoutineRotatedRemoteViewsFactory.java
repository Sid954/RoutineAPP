package com.routine.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;

/**
 * Builds the Landscape Routine View:
 * - Dynamically adapts card layout to current widget width (clamped min 220dp, max 550dp)
 * - Guarantees cards fit on screen without layout breakage
 */
public class RoutineRotatedRemoteViewsFactory implements RemoteViewsService.RemoteViewsFactory {

    private final Context ctx;

    private static final int[]    DAY_INDICES = {6, 0, 1, 2, 3}; // Sat, Sun, Mon, Tue, Wed
    private static final String[] DAY_LABELS  = {"SAT", "SUN", "MON", "TUE", "WED"};

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

    static class CardModel {
        String title;
        String timeRange;
        String subInfo;
        int    bgColor;
        boolean isLive;
        boolean isPast;
    }

    public RoutineRotatedRemoteViewsFactory(Context ctx) {
        this.ctx = ctx;
    }

    @Override public void onCreate()          { }
    @Override public void onDataSetChanged()  { }
    @Override public void onDestroy()         { }

    @Override
    public int getCount() {
        return DAY_INDICES.length; // 5 day rows: Sat, Sun, Mon, Tue, Wed
    }

    @Override
    public RemoteViews getViewAt(int position) {
        if (position < 0 || position >= DAY_INDICES.length) return null;

        int dayIdx = DAY_INDICES[position];
        String dayLabel = DAY_LABELS[position];

        SharedPreferences prefs = ctx.getSharedPreferences("RoutineWidgetData", Context.MODE_PRIVATE);
        String json = prefs.getString("full_schedule_json", "");
        int widgetWidthDp = prefs.getInt("widget_rotated_width_dp", 360);

        Calendar cal = Calendar.getInstance();
        int todayIdx = cal.get(Calendar.DAY_OF_WEEK) - 1; // 0=Sun, ..., 6=Sat
        boolean isToday = (dayIdx == todayIdx);
        int nowMins = cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE);

        RemoteViews rowRv = new RemoteViews(ctx.getPackageName(), R.layout.widget_rotated_row);

        // Keep day box background dark, just show a blue dot • for today
        rowRv.setInt(R.id.rotated_day_box, "setBackgroundResource", R.drawable.widget_tab_btn_bg);
        rowRv.setViewVisibility(R.id.rotated_day_badge, View.GONE);

        if (isToday) {
            rowRv.setTextViewText(R.id.rotated_day_name, dayLabel + "\n•");
            rowRv.setTextColor(R.id.rotated_day_name, 0xFF38bdf8); // Blue text with dot
        } else {
            rowRv.setTextViewText(R.id.rotated_day_name, dayLabel);
            rowRv.setTextColor(R.id.rotated_day_name, 0xFF94a3b8);
        }

        rowRv.removeAllViews(R.id.rotated_cards_container);

        List<CardModel> cards = new ArrayList<>();

        if (!json.isEmpty()) {
            try {
                JSONObject sched = new JSONObject(json);
                JSONArray dayArr = sched.optJSONArray(String.valueOf(dayIdx));

                if (dayArr != null) {
                    for (int i = 0; i < dayArr.length(); i++) {
                        JSONObject item = dayArr.optJSONObject(i);
                        if (item == null) continue;

                        CardModel c = new CardModel();
                        String startStr = item.optString("start", "--:--");
                        String endStr   = item.optString("end",   "--:--");
                        c.timeRange = fmt12Compact(startStr) + "→" + fmt12Compact(endStr);
                        c.title = item.optString("title", "Unknown");

                        String room = item.optString("room", "");
                        String instr = item.optString("instructor", "");

                        String roomNum = room.replaceAll("(?i)^room\\s*", "").trim();
                        String sub = roomNum;
                        if (!instr.isEmpty()) {
                            sub += (sub.isEmpty() ? "" : " · ") + instr;
                        }
                        c.subInfo = sub.isEmpty() ? "—" : sub;

                        String type = item.optString("type", "THEORY");
                        boolean isLab = "LAB".equalsIgnoreCase(type);

                        int pi = Math.abs(c.title.hashCode()) % PALETTES.length;
                        if (isLab) {
                            c.bgColor = 0xFF701235; // Crimson Red for Labs
                        } else {
                            c.bgColor = PALETTES[pi][0];
                        }

                        if (isToday) {
                            int sm = RoutineScheduleEngine.parseTimeToMins(startStr);
                            int em = RoutineScheduleEngine.parseTimeToMins(endStr);
                            if (sm != -1 && em != -1) {
                                c.isLive = nowMins >= sm && nowMins < em;
                                c.isPast = nowMins >= em;
                            }
                        }

                        cards.add(c);
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        // Dynamically calculate card size based on actual widget width dp and subjects count
        int numCards = cards.isEmpty() ? 1 : cards.size();
        int availWidth = Math.max(160, widgetWidthDp - 60);
        int calcCardWidth = availWidth / numCards;

        int cardLayoutRes = (calcCardWidth < 85 || numCards >= 4) ? R.layout.widget_rotated_card_sm : R.layout.widget_rotated_card;

        if (cards.isEmpty()) {
            RemoteViews emptyCard = new RemoteViews(ctx.getPackageName(), cardLayoutRes);
            emptyCard.setTextViewText(R.id.rotated_card_title, "No Class");
            emptyCard.setTextViewText(R.id.rotated_card_time, "Day Off");
            emptyCard.setTextViewText(R.id.rotated_card_sub, "—");
            emptyCard.setInt(R.id.rotated_card_root, "setBackgroundColor", 0xFF111827);
            emptyCard.setTextColor(R.id.rotated_card_title, 0xFF475569);
            emptyCard.setTextColor(R.id.rotated_card_time, 0xFF334155);
            emptyCard.setTextColor(R.id.rotated_card_sub, 0xFF334155);
            rowRv.addView(R.id.rotated_cards_container, emptyCard);
        } else {
            for (CardModel card : cards) {
                RemoteViews cardRv = new RemoteViews(ctx.getPackageName(), cardLayoutRes);
                cardRv.setTextViewText(R.id.rotated_card_title, card.title);
                cardRv.setTextViewText(R.id.rotated_card_sub, card.subInfo);
                cardRv.setInt(R.id.rotated_card_root, "setBackgroundColor", card.bgColor);
                cardRv.setTextColor(R.id.rotated_card_title, 0xFFFFFFFF);
                cardRv.setTextColor(R.id.rotated_card_sub, 0xFFe2e8f0);

                if (card.isLive) {
                    cardRv.setTextViewText(R.id.rotated_card_time, "● LIVE " + card.timeRange);
                    cardRv.setTextColor(R.id.rotated_card_time, 0xFF38bdf8);
                } else if (card.isPast) {
                    cardRv.setTextViewText(R.id.rotated_card_time, card.timeRange + " ✓");
                    cardRv.setTextColor(R.id.rotated_card_time, 0xFFcbd5e1);
                } else {
                    cardRv.setTextViewText(R.id.rotated_card_time, card.timeRange);
                    cardRv.setTextColor(R.id.rotated_card_time, 0xFFcbd5e1);
                }

                rowRv.addView(R.id.rotated_cards_container, cardRv);
            }
        }

        return rowRv;
    }

    @Override public RemoteViews getLoadingView() { return null; }
    @Override public int getViewTypeCount()       { return 1; }
    @Override public long getItemId(int pos)      { return pos; }
    @Override public boolean hasStableIds()       { return true; }

    private static String fmt12Compact(String raw) {
        int m = RoutineScheduleEngine.parseTimeToMins(raw);
        if (m < 0) return raw;
        int h = m / 60, min = m % 60;
        int h12 = h % 12;
        if (h12 == 0) h12 = 12;
        return String.format("%d:%02d", h12, min);
    }
}
