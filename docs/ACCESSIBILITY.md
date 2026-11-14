# TerraVoxis — Accessibility

## Features
* Nothing sounds until the user acts; the audio context is created on the first Play or legend press.
* Semantic HTML: landmarks (`header`, `nav`, `main`, `aside`, `footer`), one `h1` per page, a skip link, page titles per route, `lang="en-GB"`.
* Focus moves to the page heading on route change.
* One polite `role="status"` live region and one `role="alert"` region, present from page load. Automatic announcements are limited to one per 3 seconds; user-requested ones (describe, probe moves, mode changes) are always spoken.
* **Listening probes** are focusable buttons with `aria-roledescription="listening probe"`, a label such as "Probe 1, 31° north, 79° west, 23 °C", and `aria-keyshortcuts`. Arrow keys move 1%, Shift+arrows 5%; the reading is announced on key release. Drag has a keyboard alternative.
* **Audio legend** teaches the mapping before playback; Escape stops it.
* **Describe this moment** (D): template text with value, unit, place, fifth of the scale, trend, confidence and "Estimated from pixel colour".
* Every scene has a full text description, readable without playing anything (in "About this scene" and to screen readers beside the picture).
* Sliders carry `aria-valuetext` with units; controls are at least 24×24 px (most 40–44 px).
* High-contrast setting (black and white, yellow focus ring); reduced-motion setting (follows the system by default; the scan line then moves in 5% steps). No added flashing effects.
* Opt-in speech ("Speak descriptions aloud — turn off if you use a screen reader"), split into sentences, units spoken in words.
* Single-key shortcuts can be turned off and never fire while typing.
* **Vibration cues** (opt-in, Settings): while playing, 1 to 4 short pulses when probe 1 enters a new value quarter (1 = lowest, 4 = highest), and a short tap for new lightning events. Uses `navigator.vibrate`, so it works on Android Chrome but not iPhone Safari or desktops; the setting is disabled where unsupported. Hysteresis and throttling stop it buzzing on noisy values.

## Keyboard
| Key | Action |
|---|---|
| Space or K | Play or pause |
| L | Play or stop the audio legend |
| D | Describe this moment |
| Arrows / Shift+arrows on a probe | Move by 1% / 5% |
| 1, 2, 3 | Scientific, Musical, Accessibility |
| M | Mute |
| Left/Right on the seek slider | Seek 5 s |
| Escape | Stop the legend or close a dialog |
| ? | Shortcut list |

## What was tested
| Check | Tool | Result |
|---|---|---|
| Automated scan of all 6 routes, normal and high contrast (WCAG 2.0–2.2 A/AA + best practice) | `@axe-core/playwright` in Chromium and Firefox | 0 serious or critical issues |
| Complete journey with the keyboard only (Jukebox → scene → legend → play → move probe → describe → pause → modes) | Playwright, no pointer events | Pass (Chromium, Firefox) |
| Live region contains "°C" and "Estimated from pixel colour" after D | Playwright | Pass |
| No audio context before a user action; near silence when paused | Playwright + AnalyserNode | Pass (RMS 0.094 playing, 0.000 paused) |
| Skip link, single `h1`, landmarks, probe labels, 24 px targets | Playwright | Pass |
| Settings persist; high contrast applies | Playwright | Pass |

One bug found by axe and fixed: in-text links were distinguishable only by colour (now underlined).

## Known gaps — not yet tested
* **Vibration cues have only been unit-tested**, not felt on a real Android phone.
* **No screen-reader pass has been done** (NVDA, JAWS, VoiceOver). Please run NVDA on Windows with Firefox and Chrome before the demo.
* Safari and mobile browsers have not been tested on real devices (only a 390 px viewport in Chromium).
* Contrast was checked by axe, not by hand for every state.
* Trend words need about 2 seconds of playback history.
