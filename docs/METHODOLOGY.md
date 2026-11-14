# TerraVoxis — Methodology

TerraVoxis has NASA's *pictures*, not the data behind them. Every value it shows or plays is
**estimated from pixel colour** in a compressed, resized rendering by NASA's Scientific
Visualization Studio (SVS). None of it is a measurement.

## 1. Media pipeline (offline, `pipeline/`)

| Step | Script | What it does |
|---|---|---|
| Fetch | `fetch_svs.py` | Calls `https://svs.gsfc.nasa.gov/api/<id>`, finds the named file, downloads it with resume into `pipeline/_cache/`. Stops with a list of filenames if the name is not found. |
| Transcode | `transcode.py` | H.264, yuv420p, no audio, `+faststart`, keyframe every 15 frames, 30 fps. Flat maps → 1024×512. CRF 23, raised by 2 until ≤ 20 MB. Poster at ⅓ of the duration. |
| Lookup tables | `build_lut.py` | Legend image → 256-entry colour table (continuous) or class swatches (categorical). |
| Manifest | `build_manifest.py` | Writes `app/public/scenes/manifest.json`. |

Results:

| Scene | Source | Output | CRF | Size | Duration |
|---|---|---|---|---|---|
| ocean (SVS 3912) | `ecco2_sst_flow.mp4`, 256 MB | `ocean.mp4` 1024×512 | 29 | 19.6 MB | 66.7 s |
| lightning (SVS 5011) | `iss_lightning_sos_yearly_07312023_2048p60.mp4`, 334 MB | `lightning.mp4` 1024×512 | 23 | 13.8 MB | 100.0 s |
| aerosols (SVS 5669) | `Aerosols_2025-08-19T20_00_00_1920x1080.png` | copied as is | — | 2.8 MB | still |

No video was trimmed. Total media: 36 MB.

## 2. From colour to value

### Colour space
sRGB (D65) → CIELAB. Chroma `C = √(a² + b²)`, hue `h = atan2(b, a)` in degrees.
The same formulas are in `pipeline/colour.py` and `app/src/engine/analysis/color.ts`; unit tests
check seven reference colours to within 0.5.

### Lookup tables
* **ocean**: the strip of `sst_ecco2_cbar.png` (310×95) is cropped to x 15–290, y 36–59 (inside the
  black border; rows averaged), resampled to 256 entries from 0 °C to 32 °C. It runs from
  (52, 92, 250) blue to (247, 0, 24) red; its CIELAB hue falls monotonically from 297° to 37°, so
  every hue on the scale is unique.
* **aerosols**: each of the four swatches of `Aerosols_cbar.png` is averaged (all are flat colours).
  Because the GEOS rendering draws each class *brighter where there is more aerosol* over a dark
  background, each class also gets darker copies of its swatch at 70%, 45% and 28% brightness.
  These are derived from the legend, not from the picture.

### Inversion (browser)
A 32×32×32 table (5 bits per channel) is built when a scene opens. Each cell stores the nearest
entry and its distance.

| Method | Distance | Used by | Thresholds |
|---|---|---|---|
| `hue` | Euclidean in (a, b) after scaling both colours to chroma 50; pixels with chroma < `minChroma` are invalid | ocean | minChroma 10, maxDistance 14 |
| `categorical` | CIELAB distance to the nearest sample of each class; nearest class wins | aerosols | minChroma 8, maxDistance 18 |
| `event` | lit = hue, chroma and lightness inside a box; new = lit now and not lit in the previous analysed frame | lightning | hue 80–118°, chroma ≥ 22, L ≥ 18 |

A valid pixel has `u = index / 255`, `value = vmin + u (vmax − vmin)`, confidence `1 − distance/maxDistance`.

**Tuning record (honest):**
* ocean `minChroma` started at 18. On real frames, dim flow lines in cold water have chroma 8–17,
  so a probe south of Greenland had only 4% valid pixels. Land in the ocean video has chroma ≈ 0
  (Antarctica peaks at 8), so we lowered it to 10. Valid coverage of the whole frame rose from 36%
  to 50%.
* lightning thresholds started at hue 25–65, chroma 40, L 60. These are HSV-like numbers; in CIELAB
  the yellow dots sit at hue 95–106°, and after down-sampling to 256×128 their lightness is only
  16–45 and chroma 20–44. The starting values matched nothing. Final values above.
* aerosols: a threshold grid search could not remove one confusion (see limits).

### Probe and global features
A probe is a disc of radius `r` (fraction of image width; default 0.03). Coverage = valid ÷ all
pixels; `u` = confidence-weighted mean; if coverage < 0.15 the value is `null` ("No reliable reading
here"). `spread` = standard deviation of `u`; confidence = mean confidence × min(1, coverage/0.5);
motion = mean |ΔL| between analysed frames ÷ 20, clamped to 0–1. Analysis runs on a 192×96 canvas
(lightning 256×128, aerosols 192×108), at most 20 times per second.

Smoothing: one-pole, τ = 0.15 s (0.30 s in Accessibility mode); null → number jumps; reset on seek.
While paused, a refresh is applied without smoothing so moves show at once.

### Projection
ocean and lightning are equirectangular full-globe maps. We placed crosshairs at the true positions
of the Strait of Gibraltar, the Cape of Good Hope and Cape Horn on the ocean poster; each landed on
the feature within about 1–2°. The aerosol frame is the whole globe stretched to 16:9 (Hurricane
Erin renders at ≈73° W 27° N; Gibraltar at ≈7° W 37° N), so it also has coordinates.

## 3. From value to sound

`app/src/engine/mapping/mapFeatures.ts` is a pure function used by both live playback and export.
`u' = u` (or `1 − u` when "higher pitch means less").

| Parameter | Scientific | Musical | Accessibility |
|---|---|---|---|
| Probe pitch | `F_MIN·(F_MAX/F_MIN)^u'`, C3–C6 | nearest scale note to MIDI `48 + 36u'` | `u'` rounded to 8 steps, then Scientific |
| Probe gain | `0.5·coverage^0.6 · trim(f)` | same, with a note envelope | same; probes alternate every 1.2 s |
| Filter cutoff | `min(8000, f·(2 + 6·min(1, spread/0.25)))` | same | `4f` |
| Tremolo (6 Hz) | `0.6·motion` | `0.3·motion` | 0 |
| Pan | `0.9·(2x − 1)` | same | same |
| Bed | probe formula on global `u`, ÷2; gain `0.18·coverage^0.6`; cutoff `300 + 2500·motion` | same | off |
| Reverb | off | convolver, 1.6 s seeded IR, send 0.18 | off |
| Reference tone | off by default | off by default | on: 40 ms sine every 2 s at mid-range, −18 dB |

`trim(f) = clamp((f/440)^−0.25, 0.6, 1.4)`. Scales: ocean major pentatonic (root 48), lightning
minor pentatonic, aerosols Dorian (root 45). Musical notes are evaluated on sixteenth-note pulses and
re-struck only if the note changes **and** `u'` moved by more than half a scale step.

**Events (lightning):** pitch `523.25·4^w` Hz where `w` is the normalised latitude (south C5 → north
C7); Musical rounds to the scale; Accessibility uses three bands (south of 23.4° S, tropics, north)
at C5, G5, C6. Gain `0.25 + 0.5·strength`, pan by longitude. At most 8 event voices start in any
100 ms (strongest kept); at most 4 per frame in Accessibility mode. A soft activity bed on the root
note follows the share of lit pixels (full at 4% of the frame).

**Aerosol classes:** gain `0.4·share^0.7`, from the scan band (3% of the width, sweeping west to east
in 24 s) or from probe 1 with "Probe only". Accessibility plays only the two largest classes.
Timbres: sea salt = band-passed noise (1800 Hz); dust = 110 Hz sawtooth, low-passed, 0.3 Hz wobble;
smoke = 82 + 87 Hz sines (slow beat) plus 15% noise; sulfate = 880/1320/1760 Hz sines with staggered tremolo.

**Audio graph:** mix → high-pass 40 Hz → master (ceiling −6 dBFS) → compressor as limiter
(−6 dB, 20:1, 3 ms, 250 ms). Parameters move with `setTargetAtTime(…, 0.04)`. The video clock is the
only clock; targets for each analysed frame are applied at `currentTime + 0.02`.

**Deviation from the brief:** event voices use the 4 ms attack from the timbre table, which is
shorter than the general 10 ms ramp rule. All other starts and stops ramp over ≥ 10 ms.

## 4. Measured results

### Real-video inversion error (ocean)
We chose places where the picture's colour matches a legend label using an **independent** test
(HSV hue within 10° of the legend colour at that label, on ≥ 50% of the coloured pixels in the probe),
then read them through the real app, paused on that frame (`pipeline/_cache/inversion_*.json`).

| Frame | Label | Reading | Error |
|---|---|---|---|
| 20 s | 0 °C | 2.1 °C | +2.1 |
| 20 s | 0 °C | 2.4 °C | +2.4 |
| 20 s | 10 °C | 9.6 °C | −0.4 |
| 20 s | 10 °C | 9.1 °C | −0.9 |
| 20 s | 20 °C | 20.1 °C | +0.1 |
| 20 s | 20 °C | 21.2 °C | +1.2 |
| 40 s | 0 °C | 1.9 °C | +1.9 |
| 40 s | 0 °C | 2.1 °C | +2.1 |
| 40 s | 10 °C | 10.1 °C | +0.1 |
| 40 s | 10 °C | 9.2 °C | −0.8 |
| 40 s | 20 °C | 20.0 °C | 0.0 |
| 40 s | 20 °C | 18.4 °C | −1.6 |

**Mean absolute error 1.14 °C; maximum 2.4 °C; n = 12.** Readings near 0 °C are biased upward by
about 2 °C: at the end of the scale, averaging can only pull the value inward. No place in either
frame matched the 32 °C end colour (the video's reds are more orange than the legend's end), so the
top of the scale is untested here. This test is partly circular — it checks the pipeline against
the picture's own colours, not against ocean data.

Sanity check against well-known ocean conditions (not ground truth; the model year is 2007–08,
frame at 20 s ≈ northern summer): western Pacific warm pool (150° E, 2° N) 30.1 °C;
Southern Ocean (30° W, 60° S) 2.6 °C; Gulf Stream off Cape Hatteras 25.0 °C; Peru upwelling
(80° W, 12° S) 19.5 °C. All are plausible.

### Synthetic accuracy (unit tests)
* `lab` inversion on a synthetic perceptual gradient: MAE of `u` < 0.02.
* `hue` inversion on the real ocean legend with brightness scaled 0.5–1.0: MAE of `u` < 0.05 (< 1.6 °C), < 5% rejected.
* Event detection on 200 random synthetic frames: precision and recall ≥ 0.9.

### Performance (Chromium, this laptop)
* Analysis time per frame: mean 0.9–1.1 ms, max 4.9–5.6 ms (the first two frames, before the JIT warms up). Target < 4 ms: met on average.
* JavaScript bundle: 113 kB gzipped (target < 300 kB).
* Export of the 67 s ocean video: 37 s wall time, JS heap peak 48 MB (target < 300 MB).
* Exported WAV pitch tracks the live sound: ≈ 595 Hz at the start (live: 592 Hz at 23 °C), rising to ≈ 790–800 Hz mid-video as the Gulf Stream warms, then falling back.

### Export determinism
The feature timeline and mapping are deterministic (unit tests), and every audio node renders
bit-identically on its own. Long full-graph renders in Chrome differ between runs by **at most one
16-bit step in about 1.4% of samples**. We could not find a cause in our code; the end-to-end test
asserts this bound rather than bit-exactness. Raw render peak for the aerosol export: 0.20 (well
below −1 dBFS; no normalisation applied).

## 5. Limits

* Values come from a compressed picture of a model, not from the model's data.
* Sea surface temperatures beyond the legend appear as the end of the scale.
* Aerosols: the rendered sea salt is bluer than its swatch, so some bright sea salt in the Southern
  Ocean is read as dust (about 3–4% of pixels south of 45° S). Faint, thin aerosol is not recognised.
  Black carbon matched only ~1% of the frame.
* Lightning: dots are a roving 10-day accumulation, not single flashes; an "event" means a dot
  appeared on screen. The video shows no dots for its first ≈ 6 seconds.
* Coordinates are accurate to about 1–2°.
* Musical mode hides small differences by design.
