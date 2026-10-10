import { useCallback, useEffect, useRef, useState } from 'react';

interface YTPlayerInstance {
  getCurrentTime: () => number;
  setPlaybackRate?: (rate: number) => void;
  getPlaybackRate?: () => number;
  getAvailablePlaybackRates?: () => number[];
  destroy: () => void;
}

interface YTPlayerOptions {
  videoId: string;
  width?: string | number;
  height?: string | number;
  playerVars?: Record<string, number | string>;
  events?: {
    onReady?: (event: { target: YTPlayerInstance }) => void;
    onStateChange?: (event: { data: number }) => void;
    onPlaybackRateChange?: (event: { data: number }) => void;
  };
}

interface YTNamespace {
  Player: new (el: HTMLElement | string, options: YTPlayerOptions) => YTPlayerInstance;
  PlayerState: { PLAYING: number };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** Speeds our own control offers (YouTube supports 0.25–2). */
export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
const RATE_KEY = 'forge.video.playbackRate';

/** The learner's remembered speed (1 if none, or if storage is unavailable). */
export function loadPlaybackRate(): number {
  try {
    const v = Number(localStorage.getItem(RATE_KEY));
    return (PLAYBACK_RATES as readonly number[]).includes(v) ? v : 1;
  } catch {
    return 1;
  }
}

export function savePlaybackRate(rate: number) {
  try {
    localStorage.setItem(RATE_KEY, String(rate));
  } catch {
    /* private mode: speed just isn't remembered */
  }
}

let apiLoadPromise: Promise<YTNamespace> | null = null;

function loadYouTubeIframeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiLoadPromise) return apiLoadPromise;

  apiLoadPromise = new Promise((resolve, reject) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      resolve(window.YT!);
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.onerror = () => {
        apiLoadPromise = null;
        reject(new Error('YouTube player could not load'));
      };
      document.head.appendChild(script);
    }
  });

  return apiLoadPromise;
}

/**
 * Mounts a YouTube IFrame API player inside `containerRef` (on a child node
 * the API replaces, so React's own node is never swapped out), polls its
 * playback time, and applies the learner's playback speed.
 */
export function useYouTubePlayer(videoId: string, active: boolean) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState<number>(() => loadPlaybackRate());
  const rateRef = useRef(playbackRate);
  const [availableRates, setAvailableRates] = useState<number[]>([...PLAYBACK_RATES]);

  useEffect(() => {
    if (!active || !containerRef.current) return;
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    const host = containerRef.current;
    const mount = document.createElement('div');
    mount.className = 'w-full h-full';
    host.appendChild(mount);
    setFailed(false);

    loadYouTubeIframeApi()
      .then((YT) => {
        if (cancelled) return;
        playerRef.current = new YT.Player(mount, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: { autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1, enablejsapi: 1, origin: window.location.origin },
          events: {
            onReady: (event) => {
              const player = event?.target ?? playerRef.current;
              const rates = player?.getAvailablePlaybackRates?.() ?? [];
              const offered = (PLAYBACK_RATES as readonly number[]).filter((r) => rates.length === 0 || rates.includes(r));
              setAvailableRates(offered.length ? offered : [1]);
              if (rateRef.current !== 1) player?.setPlaybackRate?.(rateRef.current);
              setIsReady(true);
            },
            // Changed from YouTube's own menu: keep our control (and the remembered speed) in step.
            onPlaybackRateChange: (event) => {
              if (typeof event?.data === 'number' && event.data > 0) {
                rateRef.current = event.data;
                setPlaybackRateState(event.data);
                savePlaybackRate(event.data);
              }
            },
            onStateChange: (event) => {
              if (event.data === YT.PlayerState.PLAYING) {
                if (pollTimer) clearInterval(pollTimer);
                pollTimer = setInterval(() => {
                  try {
                    setCurrentTime(playerRef.current?.getCurrentTime() ?? 0);
                  } catch {
                    /* player not ready yet */
                  }
                }, 500);
              } else if (pollTimer) {
                clearInterval(pollTimer);
                pollTimer = null;
              }
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      try {
        playerRef.current?.destroy();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
      host.replaceChildren();
      setIsReady(false);
    };
  }, [active, videoId]);

  const setPlaybackRate = useCallback((rate: number) => {
    rateRef.current = rate;
    setPlaybackRateState(rate);
    savePlaybackRate(rate);
    try {
      playerRef.current?.setPlaybackRate?.(rate);
    } catch {
      /* player not ready: applied on ready */
    }
  }, []);

  return { containerRef, currentTime, isReady, failed, playbackRate, setPlaybackRate, availableRates };
}
