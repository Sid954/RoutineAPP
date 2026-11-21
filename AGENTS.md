# Agent instructions (any AI coding agent)

Read these three files, in order, before touching anything:

1. **`CLAUDE.md`** — commands, build pipeline, architecture, release steps, standing rules.
2. **`PROJECT_OVERVIEW.md`** — the full briefing: data flow, design system, current state, backlog.
3. **`HANDOFF.md`** — where the work stands right now, including any uncommitted work and what the user must decide next.

Then check reality: `git log --oneline -15`, `git status`, `npm test`. Trust the live files and `git diff` over any doc or commit message.

## Non-negotiable rules (full list in the files above)

- **Ask before committing, pushing or releasing.** Ask before running build, screenshot or browser-automation scripts. Release only when the user says "release".
- **Never claim "fixed" without evidence** — test/script output, a real measurement, or the user's confirmation on their phone.
- Edit `src/` and root files, **never `www/`** (build output). Native Android code goes in `android-custom/`, not `android/app/src/main/`.
- DOM element IDs are a contract (`cc`, `cT`, `cR`, `cBar`, `nc`, `nT`, `chG`, `prevDayBtn`, `nextDayBtn`, `vcC`, `ecC`…). Restyle freely, never rename.
- **SVG icons only, zero emoji.** Exactly two themes (light/dark). No glassmorphism, glow or `backdrop-filter`. Keep `env(safe-area-inset-*)` padding.
- Calm motion: every state change animates (150–250 ms, `--mx-ease`, no overshoot/bounce/pop), transform/opacity only, honour `html[data-motion]`, and every gesture needs a mouse path (`bindMouseDrag`).
- Performance: `setHtmlIfChanged()` for list re-renders, no forced layout, no infinite decorative loops, no layout reads in global touch handlers, nothing heavy in the 30 s notices poll.
- Schedule overrides **flag** classes, never remove them; subject matching is exact `===`; the Weekly Routine page stays plain on purpose; all student views read through `getEffectiveClassesForDay()`.
- Notification alerts are planned **only** through `src/notifications/planner.js`. Never add another scheduler or restore removed notification code from git.
- When restoring a drifted component, copy exact values from the last known-good source (git history or the live file), never from memory.
- Flag any plaintext secret you spot. Never paste secrets in chat.

## Commands

```bash
npm install
npm test          # 31 plain Node suites; all must pass
npm run build     # src/ + root assets -> www/ (ask first)
npm run sync      # build + npx cap sync (ask first)
```

There is no linter or type checker. Tests `require()` the ES modules in `src/` with mocked globals, so keep logic modules DOM-free.