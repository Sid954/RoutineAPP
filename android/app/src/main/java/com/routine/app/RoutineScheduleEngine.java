package com.routine.app;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;

public class RoutineScheduleEngine {

    private static final String PREFS_NAME = "RoutineWidgetData";

    public static void updateScheduleState(Context context) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String fullJson = prefs.getString("full_schedule_json", "");
            if (fullJson.isEmpty()) return;

            JSONObject scheduleObj = new JSONObject(fullJson);
            Calendar now = Calendar.getInstance();
            int todayIdx = now.get(Calendar.DAY_OF_WEEK) - 1; // 0 = Sun, 1 = Mon, ..., 6 = Sat
            int nowMins = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);

            String todayKey = String.valueOf(todayIdx);
            JSONArray todayClasses = scheduleObj.optJSONArray(todayKey);

            JSONObject activeClass = null;
            JSONObject nextClass = null;

            int activeStart = -1, activeEnd = -1;
            int nextStart = -1;

            if (todayClasses != null) {
                for (int i = 0; i < todayClasses.length(); i++) {
                    JSONObject item = todayClasses.optJSONObject(i);
                    if (item == null) continue;

                    String startStr = item.optString("start", "");
                    String endStr = item.optString("end", "");
                    int startM = parseTimeToMins(startStr);
                    int endM = parseTimeToMins(endStr);

                    if (startM == -1 || endM == -1) continue;

                    if (nowMins >= startM && nowMins < endM) {
                        activeClass = item;
                        activeStart = startM;
                        activeEnd = endM;
                    } else if (startM > nowMins) {
                        if (nextClass == null || startM < nextStart) {
                            nextClass = item;
                            nextStart = startM;
                        }
                    }
                }
            }

            // If no next class today, check upcoming days sequentially
            if (nextClass == null) {
                for (int dayOffset = 1; dayOffset <= 7; dayOffset++) {
                    int checkDayIdx = (todayIdx + dayOffset) % 7;
                    JSONArray checkClasses = scheduleObj.optJSONArray(String.valueOf(checkDayIdx));
                    if (checkClasses != null && checkClasses.length() > 0) {
                        for (int i = 0; i < checkClasses.length(); i++) {
                            JSONObject item = checkClasses.optJSONObject(i);
                            if (item == null) continue;
                            String startStr = item.optString("start", "");
                            int startM = parseTimeToMins(startStr);
                            if (startM != -1) {
                                if (nextClass == null || startM < nextStart) {
                                    nextClass = item;
                                    nextStart = startM;
                                }
                            }
                        }
                        if (nextClass != null) break;
                    }
                }
            }

            SharedPreferences.Editor editor = prefs.edit();

            // Active class updates
            if (activeClass != null) {
                String title = activeClass.optString("title", "No Active Class");
                String room = activeClass.optString("room", "No Room");
                String type = activeClass.optString("type", "THEORY");
                String startStr = activeClass.optString("start", "");
                String endStr = activeClass.optString("end", "");

                editor.putString("current_label", "● LIVE CLASS ACTIVE");
                editor.putString("current_title", title);
                editor.putString("current_room", room.isEmpty() ? "No Room" : "Room " + room);
                editor.putString("current_time", format12hStr(startStr) + " – " + format12hStr(endStr));
                editor.putInt("start_mins", activeStart);
                editor.putInt("end_mins", activeEnd);
            } else {
                editor.putString("current_label", "● NO CLASS ACTIVE");
                editor.putString("current_title", "No Active Class");
                editor.putString("current_room", "No Room");
                editor.putString("current_time", "--:-- – --:--");
                editor.putInt("start_mins", -1);
                editor.putInt("end_mins", -1);
            }

            // Next class updates
            if (nextClass != null) {
                String title = nextClass.optString("title", "No Class");
                String room = nextClass.optString("room", "No Room");
                String startStr = nextClass.optString("start", "");
                String endStr = nextClass.optString("end", "");
                String instructor = nextClass.optString("instructor", "");

                String roomInfo = room.isEmpty() ? "No Room" : "Room " + room;
                String timeInfo = format12hStr(startStr) + " – " + format12hStr(endStr);
                String subInfo = roomInfo + " · " + timeInfo + (instructor.isEmpty() ? "" : " · " + instructor);

                editor.putString("next_label", "NEXT");
                editor.putString("next_title", title);
                editor.putString("next_info", subInfo);
                editor.putInt("next_start_mins", nextStart);
                editor.putBoolean("show_next", true);
            } else {
                editor.putString("next_label", "NEXT");
                editor.putString("next_title", "No Upcoming Class");
                editor.putString("next_info", "Room: -- · --:--");
                editor.putInt("next_start_mins", -1);
                editor.putBoolean("show_next", false);
            }

            editor.apply();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static int parseTimeToMins(String timeStr) {
        if (timeStr == null || timeStr.trim().isEmpty()) return -1;
        try {
            timeStr = timeStr.trim().toUpperCase();
            boolean isPM = timeStr.contains("PM");
            boolean isAM = timeStr.contains("AM");
            String cleanStr = timeStr.replaceAll("[^0-9:]", "");
            String[] parts = cleanStr.split(":");
            if (parts.length < 2) return -1;
            int hours = Integer.parseInt(parts[0]);
            int mins = Integer.parseInt(parts[1]);

            if (isPM && hours < 12) hours += 12;
            if (isAM && hours == 12) hours = 0;

            return hours * 60 + mins;
        } catch (Exception e) {
            return -1;
        }
    }

    public static String format12hStr(String timeStr) {
        int mins = parseTimeToMins(timeStr);
        if (mins == -1) return timeStr;
        int h = mins / 60;
        int m = mins % 60;
        String ampm = h >= 12 ? "PM" : "AM";
        int h12 = h % 12;
        if (h12 == 0) h12 = 12;
        return String.format("%d:%02d %s", h12, m, ampm);
    }
}
