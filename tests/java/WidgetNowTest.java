import com.routine.app.WidgetNow;
import java.util.*;

/** JVM tests for the widget schedule logic (compiled + run by tests/test_widget_native.js). */
public class WidgetNowTest {
    static int failures = 0;
    static void check(boolean ok, String what) { if (!ok) { failures++; System.out.println("FAIL: " + what); } }

    static WidgetNow.Cls cls(String t, int s, int e, String status) {
        WidgetNow.Cls c = new WidgetNow.Cls(); c.title = t; c.start = s; c.end = e; c.status = status; c.room = "905"; return c;
    }

    /** Source backed by a date -> day map; weekday fallback like WidgetData. */
    static class Src implements WidgetNow.Source {
        final Map<String, WidgetNow.Day> byDate = new HashMap<>();
        final Map<Integer, WidgetNow.Day> byDow = new HashMap<>();
        public boolean hasData() { return true; }
        public WidgetNow.Day dayFor(Calendar d) {
            String k = String.format("%04d-%02d-%02d", d.get(Calendar.YEAR), d.get(Calendar.MONTH) + 1, d.get(Calendar.DAY_OF_MONTH));
            if (byDate.containsKey(k)) return byDate.get(k);
            WidgetNow.Day w = byDow.get(d.get(Calendar.DAY_OF_WEEK) - 1);
            return w != null ? w : new WidgetNow.Day();
        }
    }

    static Calendar at(int y, int mo, int d, int h, int mi) { Calendar c = Calendar.getInstance(); c.clear(); c.set(y, mo - 1, d, h, mi, 0); return c; }

    public static void main(String[] a) {
        // Saturday 21 Nov 2026: DSA 9:00-10:15, DSAL 10:30-11:45, MATH 13:00-14:15; Sunday ENG 9:45
        Src src = new Src();
        WidgetNow.Day sat = new WidgetNow.Day();
        sat.classes.add(cls("DSA", 540, 615, "normal"));
        sat.classes.add(cls("DSAL", 630, 705, "normal"));
        sat.classes.add(cls("MATH", 780, 855, "normal"));
        src.byDow.put(6, sat);
        WidgetNow.Day sun = new WidgetNow.Day();
        sun.classes.add(cls("ENG", 585, 660, "normal"));
        src.byDow.put(0, sun);

        WidgetNow.Snapshot s = WidgetNow.compute(src, at(2026, 11, 21, 8, 0));
        check(s.kind == WidgetNow.Kind.BEFORE && s.next.title.equals("DSA") && s.inMins == 60, "before first class");

        s = WidgetNow.compute(src, at(2026, 11, 21, 9, 30));
        check(s.kind == WidgetNow.Kind.LIVE && s.current.title.equals("DSA"), "live DSA");
        check(s.leftMins == 45 && s.elapsedMins == 30 && s.progress == 40, "live numbers");
        check(s.indexToday == 1 && s.heldToday == 3, "class 1 of 3");
        check(s.next.title.equals("DSAL") && s.inMins == 60, "next after live");

        s = WidgetNow.compute(src, at(2026, 11, 21, 12, 0));
        check(s.kind == WidgetNow.Kind.BREAK && s.next.title.equals("MATH") && s.inMins == 60, "break -> MATH");

        s = WidgetNow.compute(src, at(2026, 11, 21, 15, 0));
        check(s.kind == WidgetNow.Kind.DONE && s.next.title.equals("ENG") && s.nextDaysAhead == 1, "done -> tomorrow ENG");
        check(WidgetNow.relDay(s.nextDate, s.nextDaysAhead).equals("Tomorrow"), "relDay tomorrow");

        // Last class of the day while live: next comes from tomorrow
        s = WidgetNow.compute(src, at(2026, 11, 21, 13, 30));
        check(s.kind == WidgetNow.Kind.LIVE && s.next != null && s.next.title.equals("ENG") && s.nextDaysAhead == 1, "live last class -> tomorrow");

        // Date-specific override beats the weekday routine: DSA cancelled on this Saturday only
        WidgetNow.Day satCancel = new WidgetNow.Day();
        satCancel.classes.add(cls("DSA", 540, 615, "cancelled"));
        satCancel.classes.add(cls("DSAL", 630, 705, "normal"));
        satCancel.classes.add(cls("MATH", 780, 855, "normal"));
        src.byDate.put("2026-11-21", satCancel);
        s = WidgetNow.compute(src, at(2026, 11, 21, 9, 30));
        check(s.kind == WidgetNow.Kind.BEFORE && s.next.title.equals("DSAL"), "cancelled class is never live");
        check(s.heldToday == 2, "held count skips cancelled");
        s = WidgetNow.compute(src, at(2026, 11, 28, 9, 30));
        check(s.kind == WidgetNow.Kind.LIVE && s.current.title.equals("DSA"), "next Saturday falls back to the routine (no stale cancel)");
        src.byDate.clear();

        // Holiday and off day
        WidgetNow.Day hol = new WidgetNow.Day(); hol.holiday = "Victory Day";
        hol.classes.add(cls("DSA", 540, 615, "cancelled"));
        src.byDate.put("2026-11-21", hol);
        s = WidgetNow.compute(src, at(2026, 11, 21, 10, 0));
        check(s.kind == WidgetNow.Kind.HOLIDAY && s.holiday.equals("Victory Day") && s.next.title.equals("ENG"), "holiday -> next class");
        src.byDate.clear();
        s = WidgetNow.compute(src, at(2026, 11, 19, 10, 0));   // Thursday
        check(s.kind == WidgetNow.Kind.OFF && s.next.title.equals("DSA") && s.nextDaysAhead == 2, "Thursday off -> Saturday");
        check(WidgetNow.relDay(s.nextDate, s.nextDaysAhead).equals("Saturday"), "relDay Saturday");

        // Refresh timing
        Calendar now = at(2026, 11, 21, 9, 31);
        long next = WidgetNow.nextRefreshAt(src, now);
        check(next - now.getTimeInMillis() <= 2 * 60_000L + 5_000L, "in class: refresh within ~2 min");
        now = at(2026, 11, 21, 15, 0);
        next = WidgetNow.nextRefreshAt(src, now);
        Calendar midnight = at(2026, 11, 22, 0, 0);
        check(next <= now.getTimeInMillis() + 3L * 3600_000L, "idle: never later than 3h");
        now = at(2026, 11, 21, 22, 30);
        next = WidgetNow.nextRefreshAt(src, now);
        check(next >= midnight.getTimeInMillis() && next <= midnight.getTimeInMillis() + 60_000L, "late evening: refresh right after midnight");
        now = at(2026, 11, 21, 7, 0);
        next = WidgetNow.nextRefreshAt(src, now);
        check(Math.abs(next - at(2026, 11, 21, 8, 0).getTimeInMillis()) <= 5_000L, "morning: refresh 1h before the first class");
        check(WidgetNow.nextRefreshAt(src, now) > now.getTimeInMillis(), "always in the future");

        // Helpers
        check(WidgetNow.t12(780).equals("1:00 PM") && WidgetNow.t12(0).equals("12:00 AM"), "t12");
        check(WidgetNow.dur(75).equals("1h 15m") && WidgetNow.dur(45).equals("45m") && WidgetNow.dur(120).equals("2h"), "dur");
        check(WidgetNow.parseTime("09:45") == 585 && WidgetNow.parseTime("1:30 PM") == 810 && WidgetNow.parseTime("12:05 AM") == 5 && WidgetNow.parseTime("x") == -1, "parseTime");

        if (failures > 0) { System.out.println(failures + " widget check(s) failed"); System.exit(1); }
        System.out.println("All widget engine checks passed (" + "JVM" + ").");
    }
}
