import { useEffect, useRef, useState } from 'react';

interface YTPlayerInstance {
  getCurrentTime: () => number;
  destroy: () => void;
}

interface YTPlayerOptions {
  videoId: string;
  playerVars?: Record<string, number | string>;
  events?: {
    onReady?: () => void;
    onStateChange?: (event: { data: number }) => void;
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

let apiLoadPromise: Promise<YTNamespace> | null = null;

function loadYouTubeIframeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiLoadPromise) return apiLoadPromise;

  apiLoadPromise = new Promise((resolve) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      resolve(window.YT!);
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(script);
    }
  });

  return apiLoadPromise;
}

/**
 * Mounts a YouTube IFrame API player and polls its current playback time.
 * Only used for video steps that carry a timestamp-synced interaction
 * timeline — regular videos keep using the lighter raw <iframe> embed.
 */
export function useYouTubePlayer(videoId: string, active: boolean) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!active || !containerRef.current) return;
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    loadYouTubeIframeApi().then((YT) => {
      if (cancelled || !containerRef.current) return;
      playerRef.current = new YT.Player(containerRef.current, {
        videoId,
        playerVars: { autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1, enablejsapi: 1 },
        events: {
          onReady: () => setIsReady(true),
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
      setIsReady(false);
    };
  }, [active, videoId]);

  return { containerRef, currentTime, isReady };
}
