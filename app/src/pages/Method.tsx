import { usePageTitle } from '../scenes/useManifest';

/** Public repository address. Set this once the repository is published; the link is hidden while empty. */
export const REPO_URL = '';

const Row = ({ c }: { c: string[] }) => (
  <tr className="border-b border-border/70 align-top">
    <th scope="row" className="py-2 pr-3 text-left font-semibold">
      {c[0]}
    </th>
    {c.slice(1).map((x, i) => (
      <td key={i} className="py-2 pr-3 font-mono text-sm">
        {x}
      </td>
    ))}
  </tr>
);

export function Method() {
  usePageTitle('Method');
  return (
    <main id="main" className="mx-auto max-w-4xl px-4 py-10 leading-relaxed">
      <h1 tabIndex={-1} className="text-4xl font-bold">
        Method
      </h1>
      <p className="mt-4 text-lg">
        TerraVoxis does not have the data behind NASA’s pictures. It has the pictures. So it works backwards: it reads each picture’s
        colour legend, finds the legend colour closest to each pixel, and turns that back into an <em>estimated</em> value. The
        estimate becomes sound through the fixed mapping below. Every number on screen is labelled “Estimated from pixel colour”
        because that is what it is — not a measurement.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">1. From colour to value</h2>
      <ol className="mt-2 list-decimal space-y-2 pl-6">
        <li>An offline script crops the legend’s colour strip and samples it into a 256-entry table from the lowest to the highest value.</li>
        <li>
          In the browser, a 32×32×32 table is built once per scene: for every quantised colour, the nearest legend entry and its
          distance, in CIELAB colour space.
        </li>
        <li>
          Ocean uses <strong>hue matching</strong>: lightness is ignored because the flow lines get brighter and darker, and greys
          (land) are rejected because their chroma is below 18.
        </li>
        <li>
          Aerosols use <strong>class matching</strong>: each of the four legend swatches, and darker copies of it (because the
          rendering dims colours where there is less aerosol), is compared with each pixel.
        </li>
        <li>Lightning uses <strong>event detection</strong>: a pixel that turns yellow-orange since the last analysed frame is a new event.</li>
        <li>
          A probe is a small disc. Its value is the confidence-weighted mean over the valid pixels inside it. If fewer than 15% of
          its pixels match the legend, it reports “No reliable reading here” and its voice fades out.
        </li>
      </ol>

      <h2 className="mt-10 text-2xl font-semibold">2. From value to sound</h2>
      <p className="mt-2">
        Let <span className="font-mono">u</span> be the value scaled to 0–1 (0 = bottom of the legend). With “higher pitch means less”,{' '}
        <span className="font-mono">u</span> is replaced by <span className="font-mono">1 − u</span>.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse">
          <caption className="mb-2 text-left text-muted">Probe voice, by mode</caption>
          <thead>
            <tr className="border-b border-edge text-left">
              <th scope="col" className="py-2 pr-3">
                Parameter
              </th>
              <th scope="col" className="py-2 pr-3">
                Scientific
              </th>
              <th scope="col" className="py-2 pr-3">
                Musical
              </th>
              <th scope="col" className="py-2 pr-3">
                Accessibility
              </th>
            </tr>
          </thead>
          <tbody>
            <Row c={['Pitch', '130.81 × 8^u Hz (C3 to C6)', 'Nearest scale note to MIDI 48 + 36u', 'u rounded to 8 steps, then as Scientific']} />
            <Row c={['Loudness', '0.5 × coverage^0.6', 'Same, with a note envelope', 'Same']} />
            <Row c={['Brightness (filter)', 'f × (2 + 6 × spread/0.25), max 8 kHz', 'Same', 'Fixed at 4f']} />
            <Row c={['Tremolo', '0.6 × motion at 6 Hz', '0.3 × motion', 'None']} />
            <Row c={['Left–right', '0.9 × (2x − 1): west left, east right', 'Same', 'Same']} />
          </tbody>
        </table>
      </div>
      <ul className="mt-4 list-disc space-y-1 pl-6">
        <li>Loudness is trimmed for pitch (quieter at high pitch) by (f/440)^−0.25, limited to 0.6–1.4.</li>
        <li>The bed follows the whole frame (or the scan band) one octave below the probe range, at gain 0.18 × coverage^0.6.</li>
        <li>
          Lightning events: pitch follows latitude, 523 × 4^w Hz from south to north (C5 to C7); pan follows longitude; loudness
          0.25 + 0.5 × strength. Never more than 8 events start in any 100 ms.
        </li>
        <li>Aerosols: each class has its own voice — noise for sea salt, a low buzz for dust, a slow beat for smoke, bright bells for sulfate — at gain 0.4 × share^0.7.</li>
        <li>Values are smoothed over 0.15 s (0.30 s in Accessibility mode) so the sound does not jitter.</li>
        <li>Master ceiling −6 dBFS, then a limiter. The video is the only clock: each analysed frame (at most 20 per second) is scheduled 20 ms ahead.</li>
      </ul>

      <h2 className="mt-10 text-2xl font-semibold">3. Modes</h2>
      <ul className="mt-2 list-disc space-y-1 pl-6">
        <li>
          <strong>Scientific</strong>: continuous pitch, no reverb. Best for comparing values.
        </li>
        <li>
          <strong>Musical</strong>: pitches rounded to a pentatonic or Dorian scale, light reverb, notes re-struck only when the value
          moves by more than half a scale step. Pleasant, but small differences may be hidden.
        </li>
        <li>
          <strong>Accessibility</strong>: eight clear pitch steps, slower smoothing, no bed, a reference tone every 2 seconds at the
          middle of the range, and two probes take turns every 1.2 seconds instead of sounding together.
        </li>
      </ul>

      <h2 className="mt-10 text-2xl font-semibold">4. Limits — please read</h2>
      <ul className="mt-2 list-disc space-y-2 pl-6">
        <li>Values come from a compressed, resized picture of a model, not from the model’s data. They are estimates.</li>
        <li>
          Measured inversion error, ocean: at 12 places in the real video whose colour matches a legend label (0, 10 or 20 °C), the
          readings were off by 1.1 °C on average and 2.4 °C at most. Readings near 0 °C are biased upward by about 2 °C, because averaging
          at the end of the scale can only pull inward. The 32 °C end could not be checked: no place in the video matched it.
        </li>
        <li>Lightning has no dots during its first six seconds or so; that is the video, not a fault.</li>
        <li>
          Aerosols: the rendered sea salt is bluer than its legend swatch, so some bright sea salt in the Southern Ocean is read as dust
          (about 3–4% of pixels south of 45° S). Thin, faint aerosol is not recognised at all.
        </li>
        <li>Lightning: each dot is part of a 10-day accumulation, not a single flash at that instant. An event here means a dot appeared on screen.</li>
        <li>Coordinates assume a flat (equirectangular) map; we checked coastlines to within about 1–2 degrees.</li>
        <li>Sea surface temperatures beyond the legend (below 0 °C or above 32 °C) are shown as the end of the scale.</li>
      </ul>

      <h2 className="mt-10 text-2xl font-semibold">5. How it was tested</h2>
      <p className="mt-2">
        Unit tests check colour conversion, inversion accuracy on synthetic gradients, monotonic pitch, scale membership, event
        detection, smoothing, coordinates, the WAV encoder and the descriptions. End-to-end tests drive the app in a real browser,
        check that sound plays and stops, and run an automated accessibility scan on every page. See the code and
        results{REPO_URL ? <>: <a href={REPO_URL}>{REPO_URL}</a></> : ' in the project repository'}.
      </p>
    </main>
  );
}
