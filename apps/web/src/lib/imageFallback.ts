/**
 * Cover images are URLs typed in by admins and colleges; hot-linked ones break
 * (404, or sites that refuse hot-linking). A broken image becomes a neutral
 * placeholder instead of a broken-image icon. One listener for the whole app.
 */
const PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="225" viewBox="0 0 400 225"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f97316" stop-opacity=".18"/><stop offset="1" stop-color="#6366f1" stop-opacity=".18"/></linearGradient></defs><rect width="400" height="225" fill="url(#g)"/></svg>',
  );

export function installImageFallback() {
  window.addEventListener(
    'error',
    (event) => {
      const img = event.target;
      if (!(img instanceof HTMLImageElement) || img.dataset.fallback === 'done') return;
      img.dataset.fallback = 'done';
      img.srcset = '';
      img.src = PLACEHOLDER;
    },
    true, // image errors don't bubble; listen in the capture phase
  );
}
