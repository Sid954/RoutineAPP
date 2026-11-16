package com.routine.app;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;

/**
 * Pure schedule logic for the widgets (no Android APIs, unit-testable on the JVM).
 * Works out what is happening now and when the widgets next need a refresh.
 */
public final class WidgetNow {

    /** One class on one date. Minutes are minutes after midnight. */
    public static final class Cls {
        public String title = "Class", room = "", instructor = "", type = "Theory", status = "normal", note = "";
        public int start = -1, end = -1;
        public boolean exam = false;

        public boolean isHeld() { return !"cancelled".equals(status) && !"moved_away".equals(status); }
        public boolean isLab() { return "lab".equalsIgnoreCase(type); }
        public boolean isOnline() { return "online".equals(status); }
    }

    /** One date: optional holiday name and its classes (sorted by start). */
    public static final class Day {
        public String holiday = "";
        public final List<Cls> classes = new ArrayList<>();

        public List<Cls> held() {
            List<Cls> out = new ArrayList<>();
            for (Cls c : classes) if (c.isHeld()) out.add(c);
            return out;
        }
    }

    /** Source of days: the widget data store implements this. */
    public interface Source {
        Day dayFor(Calendar date);
        boolean hasData();
    }

    public enum Kind { NO_DATA, LIVE, BREAK, BEFORE, DONE, OFF, HOLIDAY }

    public static final class Snapshot {
        public Kind kind = Kind.NO_DATA;
        public Cls current;          // LIVE: the class now
        public Cls next;             // next held class (today or a later day)
        public Calendar nextDate;    // date of `next`
        public int nextDaysAhead = 0;
        public Cls afterNext;        // the one after `next` on the same day
        public int nowMins;
        public int leftMins, elapsedMins, progress;   // LIVE
        public int inMins;                            // minutes until `next` when it is today
        public int heldToday, indexToday;             // e.g. class 2 of 4
        public String holiday = "";
    }

    private WidgetNow() {}

    public static int minutesOf(Calendar c) {
        return c.get(Calendar.HOUR_OF_DAY) * 60 + c.get(Calendar.MINUTE);
    }

    public static Calendar dayStart(Calendar c, int addDays) {
        Calendar d = (Calendar) c.clone();
        d.set(Calendar.HOUR_OF_DAY, 0);
        d.set(Calendar.MINUTE, 0);
        d.set(Calendar.SECOND, 0);
        d.set(Calendar.MILLISECOND, 0);
        d.add(Calendar.DAY_OF_MONTH, addDays);
        return d;
    }

    public static Snapshot compute(Source src, Calendar now) {
        Snapshot s = new Snapshot();
        s.nowMins = minutesOf(now);
        if (src == null || !src.hasData()) return s;

        Day today = src.dayFor(now);
        List<Cls> held = today.held();
        s.heldToday = held.size();
        s.holiday = today.holiday == null ? "" : today.holiday;

        for (int i = 0; i < held.size(); i++) {
            Cls c = held.get(i);
            if (s.nowMins >= c.start && s.nowMins < c.end) {
                s.kind = Kind.LIVE;
                s.current = c;
                s.indexToday = i + 1;
                s.elapsedMins = s.nowMins - c.start;
                s.leftMins = c.end - s.nowMins;
                int dur = Math.max(1, c.end - c.start);
                s.progress = Math.max(0, Math.min(100, s.elapsedMins * 100 / dur));
                for (int j = i + 1; j < held.size(); j++) {
                    if (held.get(j).start >= c.end) { s.next = held.get(j); break; }
                }
                if (s.next != null) {
                    s.nextDate = dayStart(now, 0);
                    s.inMins = s.next.start - s.nowMins;
                    s.afterNext = after(held, s.next);
                }
                break;
            }
        }
        if (s.kind == Kind.LIVE) {
            if (s.next == null) findLater(src, now, s);
            return s;
        }

        Cls upcoming = null;
        boolean anyEnded = false;
        for (Cls c : held) {
            if (c.end <= s.nowMins) anyEnded = true;
            if (c.start > s.nowMins && upcoming == null) upcoming = c;
        }
        if (upcoming != null) {
            s.kind = anyEnded ? Kind.BREAK : Kind.BEFORE;
            s.next = upcoming;
            s.nextDate = dayStart(now, 0);
            s.inMins = upcoming.start - s.nowMins;
            s.afterNext = after(held, upcoming);
            return s;
        }

        if (!held.isEmpty()) s.kind = Kind.DONE;
        else if (!s.holiday.isEmpty()) s.kind = Kind.HOLIDAY;
        else s.kind = Kind.OFF;
        findLater(src, now, s);
        return s;
    }

    private static Cls after(List<Cls> held, Cls c) {
        int idx = held.indexOf(c);
        for (int j = idx + 1; j < held.size(); j++) if (held.get(j).start >= c.end) return held.get(j);
        return null;
    }

    /** First held class on a later day (up to 8 days ahead). */
    private static void findLater(Source src, Calendar now, Snapshot s) {
        for (int d = 1; d <= 8; d++) {
            Calendar date = dayStart(now, d);
            List<Cls> held = src.dayFor(date).held();
            if (!held.isEmpty()) {
                s.next = held.get(0);
                s.nextDate = date;
                s.nextDaysAhead = d;
                s.afterNext = after(held, s.next);
                return;
            }
        }
    }

    /**
     * When the widgets should refresh next (epoch millis).
     *  - in a class, or within an hour of the next class: every 2 minutes (countdowns)
     *  - otherwise: at the next class start/end boundary, one hour before the next class,
     *    or midnight, whichever is first; never later than 3 hours from now
     */
    public static long nextRefreshAt(Source src, Calendar now) {
        long nowMs = now.getTimeInMillis();
        long cap = nowMs + 3L * 60 * 60 * 1000;
        long midnight = dayStart(now, 1).getTimeInMillis() + 30_000L;
        long best = Math.min(cap, midnight);
        if (src == null || !src.hasData()) return best;

        int nowMins = minutesOf(now);
        Calendar base = dayStart(now, 0);
        boolean busy = false;
        for (Cls c : src.dayFor(now).held()) {
            if (nowMins >= c.start && nowMins < c.end) busy = true;
            if (c.start > nowMins && c.start - nowMins <= 60) busy = true;
            if (c.start > nowMins) best = Math.min(best, at(base, c.start));
            if (c.start - 60 > nowMins) best = Math.min(best, at(base, c.start - 60));
            if (c.end > nowMins) best = Math.min(best, at(base, c.end));
        }
        if (busy) {
            // Next even minute, at second 2 (so the minute has ticked over)
            Calendar n = (Calendar) now.clone();
            n.set(Calendar.SECOND, 2);
            n.set(Calendar.MILLISECOND, 0);
            n.add(Calendar.MINUTE, 2 - (n.get(Calendar.MINUTE) % 2));
            best = Math.min(best, n.getTimeInMillis());
        }
        return Math.max(best, nowMs + 30_000L);
    }

    private static long at(Calendar base, int mins) {
        return base.getTimeInMillis() + mins * 60_000L + 2_000L;
    }

    /* ── Text helpers ─────────────────────────────────────────────────── */
    public static String t12(int mins) {
        if (mins < 0) return "--:--";
        int h = (mins / 60) % 24, m = mins % 60;
        return (h % 12 == 0 ? 12 : h % 12) + ":" + (m < 10 ? "0" : "") + m + (h >= 12 ? " PM" : " AM");
    }

    public static String dur(int mins) {
        if (mins < 0) mins = 0;
        int h = mins / 60, m = mins % 60;
        if (h == 0) return m + "m";
        return m == 0 ? h + "h" : h + "h " + m + "m";
    }

    private static final String[] DAY_NAMES = {"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"};

    /** "Tomorrow", "Saturday", or "Sat 22" for dates a week out. */
    public static String relDay(Calendar date, int daysAhead) {
        if (daysAhead == 0) return "Today";
        if (daysAhead == 1) return "Tomorrow";
        String name = DAY_NAMES[date.get(Calendar.DAY_OF_WEEK) - 1];
        if (daysAhead < 7) return name;
        return name.substring(0, 3) + " " + date.get(Calendar.DAY_OF_MONTH);
    }

    /** Parse "09:45", "9:45 AM", "14:30" -> minutes, or -1. */
    public static int parseTime(String raw) {
        if (raw == null) return -1;
        String t = raw.trim().toUpperCase();
        if (t.isEmpty()) return -1;
        boolean pm = t.contains("PM"), am = t.contains("AM");
        String[] parts = t.replaceAll("[^0-9:]", "").split(":");
        if (parts.length < 2) return -1;
        try {
            int h = Integer.parseInt(parts[0]), m = Integer.parseInt(parts[1]);
            if (pm && h < 12) h += 12;
            if (am && h == 12) h = 0;
            if (h > 23 || m > 59) return -1;
            return h * 60 + m;
        } catch (NumberFormatException e) {
            return -1;
        }
    }
}
