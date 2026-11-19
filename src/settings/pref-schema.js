/**
 * What the Settings page shows for each preference group (rendered by settings-page.js).
 *   type 'switch' : on / off toggle
 *   type 'choice' : a segmented control, options are [value, label]
 *   type 'accents': the accent colour swatches
 * Items with the same `section` (in a row) share one card under that heading.
 * Keys and values must match DEFAULTS in prefs.js (tests/test_prefs.js checks this).
 */
export const PREF_GROUPS = {
  appearance: [
    { key: 'accent', section: 'Colour', type: 'accents', title: 'Accent colour', desc: 'Buttons, highlights and the live class' },
    { key: 'corners', section: 'Class cards', type: 'choice', title: 'Card corners', desc: 'How round class cards look', options: [['sharp', 'Sharp'], ['default', 'Default'], ['round', 'Round']] },
    { key: 'textSize', section: 'Class cards', type: 'choice', title: 'Card text size', desc: 'Size of class cards on Home and in the Routine', options: [['small', 'Small'], ['default', 'Default'], ['large', 'Large'], ['xl', 'Huge']] }
  ],
  home: [
    { key: 'greeting', section: 'Top of Home', type: 'switch', title: 'Greeting', desc: 'Good morning, your name and the session count' },
    { key: 'clock', section: 'Top of Home', type: 'switch', title: 'Clock', desc: 'The large time at the top of Home' },
    { key: 'weekStrip', section: 'Top of Home', type: 'switch', title: 'Week strip', desc: 'The row of days under the greeting' },
    { key: 'countBadge', section: 'Top of Home', type: 'switch', title: 'Class count label', desc: 'Small label next to "Today\'s Schedule"' },
    { key: 'todayFab', section: 'Shortcuts', type: 'switch', title: '"Back to today" button', desc: 'Floating shortcut when you look at another day. Turn off if you use the Home button' }
  ],
  cards: [
    { key: 'density', section: 'Layout', type: 'choice', title: 'Card spacing', desc: 'How much room each class card takes', options: [['compact', 'Compact'], ['default', 'Default'], ['roomy', 'Roomy']] },
    { key: 'groupClasses', section: 'Layout', type: 'switch', title: 'Group back-to-back classes', desc: 'Classes that follow each other join into one block, with breaks between blocks' },
    { key: 'room', section: 'Details', type: 'switch', title: 'Room', desc: 'Show the room on each class' },
    { key: 'teacher', section: 'Details', type: 'switch', title: 'Teacher', desc: 'Show who teaches each class' },
    { key: 'teacherName', section: 'Details', type: 'choice', title: 'Teacher name', desc: 'Full name or the short code', options: [['full', 'Full name'], ['code', 'Short code']] },
    { key: 'duration', section: 'Details', type: 'switch', title: 'Duration', desc: 'The "1h 15m" label on the right' },
    { key: 'typeTag', section: 'Details', type: 'switch', title: 'Theory / Lab tag', desc: 'The small label next to the subject' },
    { key: 'progress', section: 'Status and breaks', type: 'switch', title: 'Live progress fill', desc: 'The colour that fills the class you are in' },
    { key: 'doneBadge', section: 'Status and breaks', type: 'switch', title: '"Done" tick', desc: 'The tick on classes that already finished' },
    { key: 'breaks', section: 'Status and breaks', type: 'switch', title: 'Breaks between classes', desc: 'The "Cafeteria Recharge" strips' }
  ],
  routine: [
    { key: 'routineBadge', section: 'Routine tab', type: 'switch', title: 'Class type badge', desc: 'Theory, Lab, Online or Cancel tag on each class' },
    { key: 'routineDot', section: 'Routine tab', type: 'switch', title: 'Mark today', desc: 'A dot on today\'s tab' },
    { key: 'dimPast', section: 'Routine tab', type: 'switch', title: 'Fade finished classes', desc: 'Classes that already ended look lighter' }
  ],
  time: [
    { key: 'timeFormat', section: 'Clock', type: 'choice', title: 'Time format', desc: 'How times are written everywhere in the app', options: [['12', '12 hour'], ['24', '24 hour']] }
  ],
  gestures: [
    { key: 'swipe', section: 'Gestures', type: 'switch', title: 'Swipe between days', desc: 'Swipe the Home list sideways to change day' },
    { key: 'pull', section: 'Gestures', type: 'switch', title: 'Pull to refresh', desc: 'Pull down on Home, Notices, Faculty and Rooms' }
  ]
};
