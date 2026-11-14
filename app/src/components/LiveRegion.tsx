import { useEffect, useState } from 'react';
import { onAnnounce } from '../a11y/announce';

/** One polite status region and one alert region, present from page load. */
export function LiveRegion() {
  const [status, setStatus] = useState('');
  const [alert, setAlert] = useState('');
  useEffect(
    () =>
      onAnnounce((text, kind) => {
        if (kind === 'alert') {
          setAlert('');
          requestAnimationFrame(() => setAlert(text));
        } else {
          // Clear first so that repeating the same sentence is announced again.
          setStatus('');
          requestAnimationFrame(() => setStatus(text));
        }
      }),
    [],
  );
  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only" data-testid="live-status">
        {status}
      </div>
      <div role="alert" aria-atomic="true" className="sr-only" data-testid="live-alert">
        {alert}
      </div>
    </>
  );
}
