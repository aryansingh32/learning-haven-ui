import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProctoringEvent, ProctoringPolicy } from '@/services/campus.service';

// Browser lockdown for proctored campus tests. The browser only REPORTS what
// happened; the Campus API decides whether it is a warning or a violation and
// when to auto-submit, so nothing here can be tampered with to avoid a penalty.

const LEAVE_EVENTS: ProctoringEvent[] = ['tab_switch', 'window_blur', 'fullscreen_exit'];
/** One real action (e.g. Alt+Tab out of full screen) fires several browser events; count it once. */
const LEAVE_DEDUP_MS = 2000;

export const fullscreenSupported = () =>
  typeof document !== 'undefined' && Boolean(document.fullscreenEnabled && document.documentElement.requestFullscreen);

export const isFullscreen = () => typeof document !== 'undefined' && Boolean(document.fullscreenElement);

export async function enterFullscreen(): Promise<boolean> {
  if (!fullscreenSupported()) return false;
  try {
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    return true;
  } catch {
    return false;
  }
}

export function exitFullscreen() {
  if (isFullscreen()) void document.exitFullscreen().catch(() => undefined);
}

interface Options {
  policy: ProctoringPolicy | null;
  /** False before the exam starts and after it ends. */
  active: boolean;
  onEvent: (type: ProctoringEvent) => void;
  /** Clipboard / right-click attempts that were blocked (not penalised). */
  onBlocked?: (type: ProctoringEvent) => void;
}

export function useLockdown({ policy, active, onEvent, onBlocked }: Options) {
  const [fullscreen, setFullscreen] = useState(isFullscreen());
  const lastLeaveAt = useRef(0);
  const onEventRef = useRef(onEvent);
  const onBlockedRef = useRef(onBlocked);
  onEventRef.current = onEvent;
  onBlockedRef.current = onBlocked;

  const enabled = Boolean(active && policy?.enabled);
  const needsFullscreen = Boolean(enabled && policy?.requireFullscreen && fullscreenSupported());

  const report = useCallback((type: ProctoringEvent) => {
    if (LEAVE_EVENTS.includes(type)) {
      const now = Date.now();
      if (now - lastLeaveAt.current < LEAVE_DEDUP_MS) return;
      lastLeaveAt.current = now;
    }
    onEventRef.current(type);
  }, []);

  useEffect(() => {
    const onChange = () => {
      const fs = isFullscreen();
      setFullscreen(fs);
      if (!fs && needsFullscreen) report('fullscreen_exit');
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [needsFullscreen, report]);

  useEffect(() => {
    if (!enabled) return;

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') report('tab_switch');
    };
    let blurTimer: ReturnType<typeof setTimeout> | undefined;
    const onBlur = () => {
      // A tab switch also blurs the window; let visibilitychange report that one.
      blurTimer = setTimeout(() => {
        if (document.visibilityState === 'visible' && !document.hasFocus()) report('window_blur');
      }, 300);
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);

    const block = (type: ProctoringEvent) => (e: Event) => {
      e.preventDefault();
      onBlockedRef.current?.(type);
      report(type);
    };
    const onCopy = block('copy');
    const onPaste = block('paste');
    const onMenu = block('context_menu');
    if (policy?.blockClipboard) {
      document.addEventListener('copy', onCopy);
      document.addEventListener('cut', onCopy);
      document.addEventListener('paste', onPaste);
      document.addEventListener('contextmenu', onMenu);
    }

    return () => {
      clearTimeout(blurTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCopy);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('contextmenu', onMenu);
    };
  }, [enabled, policy?.blockClipboard, report]);

  return { enabled, needsFullscreen, fullscreen, blocked: needsFullscreen && !fullscreen };
}
