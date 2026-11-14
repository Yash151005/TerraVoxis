import { Link } from 'react-router';
import { assetUrl } from '../scenes/loadManifest';
import type { Scene } from '../scenes/types';
import { useManifest, usePageTitle } from '../scenes/useManifest';

const SOUND_KIND: Record<Scene['quantity']['kind'], string> = {
  continuous: 'A probe voice whose pitch follows the value, over a soft bed',
  event: 'Short tones for new lightning, panned west to east, pitched south to north',
  categorical: 'Four voices, one per aerosol type, scanned west to east',
};

export function ManifestError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-danger p-5">
      <h2 className="text-xl font-semibold">The scene list could not be loaded</h2>
      <p className="mt-2">{message}</p>
      <button type="button" onClick={retry} className="mt-4 min-h-10 rounded bg-sound px-4 font-semibold text-bg">
        Try again
      </button>
    </div>
  );
}

function Record({ scene, index }: { scene: Scene; index: number }) {
  const q = scene.quantity;
  const titleId = `rec-${scene.id}`;
  return (
    <li className="record group relative grid gap-4 border-t border-border py-6 sm:grid-cols-[minmax(0,18rem)_1fr] sm:gap-6">
      <div className="self-start overflow-hidden rounded-md border border-border bg-surface">
        <img src={assetUrl(scene.media.poster)} alt="" width={scene.media.width} height={scene.media.height} className="block aspect-[2/1] w-full object-cover" loading="lazy" />
      </div>
      <div className="flex flex-col">
        <p className="font-mono text-sm text-sound" aria-hidden="true">
          Track {String(index + 1).padStart(2, '0')} · SVS {scene.svsId}
        </p>
        <h2 id={titleId} className="mt-1 text-2xl font-bold">
          <Link to={`/scene/${scene.id}`} className="text-text no-underline after:absolute after:inset-0 hover:underline">
            {scene.title}
          </Link>
        </h2>
        <p className="mt-1 text-lg text-data">{scene.tagline}</p>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">Listens to</dt>
          <dd>
            {q.name}
            {q.unit && ` (${q.unit}, ${q.vmin} to ${q.vmax})`}
          </dd>
          <dt className="text-muted">Sounds like</dt>
          <dd>{SOUND_KIND[q.kind]}</dd>
          <dt className="text-muted">Media</dt>
          <dd>{scene.media.kind === 'video' ? `Video, ${Math.round(scene.media.duration)} seconds` : `Still image, scanned in ${scene.scan?.duration ?? 24} seconds`}</dd>
        </dl>
      </div>
    </li>
  );
}

export function Jukebox() {
  usePageTitle('');
  const { manifest, error, retry } = useManifest();
  return (
    <main id="main" className="mx-auto max-w-5xl px-4 py-10">
      <h1 tabIndex={-1} className="text-4xl font-bold sm:text-5xl">
        Hear the data behind the picture
      </h1>
      <p className="mt-4 max-w-3xl text-lg text-muted">
        TerraVoxis plays NASA Earth visualizations as sound. It reads each picture’s colour legend, turns pixel colour back into an
        estimated value, and turns that value into sound as the picture plays — so you can listen to ocean temperature, lightning
        and the air itself. Nothing sounds until you press play.
      </p>
      <p className="mt-2">
        <Link to="/method">How the sound is made, and its limits</Link>
      </p>
      <section aria-labelledby="records-h" className="mt-10">
        <h2 id="records-h" className="sr-only">
          Scenes
        </h2>
        {error && <ManifestError message={error} retry={retry} />}
        {!manifest && !error && <p role="status">Loading scenes…</p>}
        {manifest && (
          <ol className="list-none p-0">
            {manifest.scenes.map((s, i) => (
              <Record key={s.id} scene={s} index={i} />
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
