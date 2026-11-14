import { useManifest, usePageTitle } from '../scenes/useManifest';
import { ManifestError } from './Jukebox';
import { REFERENCES } from './references';

export function Credits() {
  usePageTitle('Credits');
  const { manifest, error, retry } = useManifest();
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-10">
      <h1 tabIndex={-1} className="text-4xl font-bold">
        Credits
      </h1>
      <p className="mt-4 text-lg">
        Every picture in TerraVoxis is a visualization by NASA’s Scientific Visualization Studio (SVS). NASA content is used for
        educational purposes. TerraVoxis is not affiliated with or endorsed by NASA.
      </p>
      <section aria-labelledby="scenes-h" className="mt-8">
        <h2 id="scenes-h" className="text-2xl font-semibold">
          Scenes
        </h2>
        {error && <ManifestError message={error} retry={retry} />}
        {manifest?.scenes.map((s) => (
          <article key={s.id} className="mt-5 border-t border-border pt-4" aria-labelledby={`cr-${s.id}`}>
            <h3 id={`cr-${s.id}`} className="text-xl font-semibold">
              {s.title}
            </h3>
            <p className="mt-1">Visualization by NASA’s Scientific Visualization Studio.</p>
            <p>{s.credits.join(', ')}.</p>
            <p className="mt-1 text-sm text-muted">
              Source file {s.transcode.sourceFile}
              {s.transcode.crf !== null && `, re-encoded for the web (H.264, CRF ${s.transcode.crf}, no audio${s.transcode.trimmedSeconds ? `, first ${s.transcode.trimmedSeconds} s` : ''})`}.
            </p>
            <p className="mt-1">
              <a href={s.svsUrl} target="_blank" rel="noopener noreferrer">
                {s.svsUrl} (opens in a new tab)
              </a>
            </p>
          </article>
        ))}
      </section>
      <section aria-labelledby="lic-h" className="mt-10">
        <h2 id="lic-h" className="text-2xl font-semibold">
          Licences
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-6">
          <li>NASA SVS imagery is generally not subject to copyright in the United States. NASA’s insignia and logotype are not used anywhere in this app.</li>
          <li>TerraVoxis code: MIT licence.</li>
          <li>Open-source code and tools: each is listed with its licence under References below.</li>
          <li>Fonts: your system’s own fonts; nothing is downloaded from a font service.</li>
        </ul>
      </section>
      <section aria-labelledby="refs-h" className="mt-10">
        <h2 id="refs-h" className="text-2xl font-semibold">
          References
        </h2>
        <p className="mt-2">Every external resource TerraVoxis uses or builds on.</p>
        {REFERENCES.map((group) => (
          <section key={group.id} aria-labelledby={group.id} className="mt-6">
            <h3 id={group.id} className="text-xl font-semibold">
              {group.title}
            </h3>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              {group.items.map((r) => (
                <li key={r.url + r.name}>
                  <a href={r.url}>{r.name}</a>. {r.detail}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </section>
      <section aria-labelledby="ai-h" className="mt-10">
        <h2 id="ai-h" className="text-2xl font-semibold">
          Use of AI
        </h2>
        <p className="mt-2">
          The code and documents of TerraVoxis were written with the help of an AI coding assistant (Anthropic’s Claude, through Claude
          Code), directed and reviewed by the team. No AI model runs inside the app: every sound is produced by deterministic
          algorithms from the pixels of NASA frames, and every description is built from fixed templates.
        </p>
      </section>
    </main>
  );
}
