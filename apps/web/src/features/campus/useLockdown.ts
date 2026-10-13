import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProctoringEvent, ProctoringPolicy } from '@/services/campus.service';

// Browser lockdown for proctored campus tests. The browser only REPORTS what
// happened; the Campus API decides whether it is a warning or a violation and
// when to auto-submit, so nothing here can be tampered with to avoid a penalty.

const LEAVE_EVENTS: ProctoringEvent[] = ['tab_switch', 'window_blur', 'fullscreen_exit'];
/** One real action (e.g. Alt+Tab out of full screen) fires several browser events; count it once. */
const LEAVE_DEDUP_MS = 2000;
/** Integrity signals (second screen, dev tools, screenshots, big insertions): at most one report per type per 30 s. */
const SIGNAL_DEDUP_MS = 30_000;
const SIGNALS: ProctoringEvent[] = ['multiple_screens', 'devtools_open', 'screenshot_key', 'large_paste'];
/** Text inserted at once (beyond what typing produces) that counts as a large paste. */
export const LARGE_INSERT_CHARS = 200;
/** Docked developer tools take at least this much of the window. */
const DEVTOOLS_GAP_PX = 160;

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
  const lastSignalAt = useRef<Partial<Record<ProctoringEvent, number>>>({});
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
    if (SIGNALS.includes(type)) {
      const now = Date.now();
      if (now - (lastSignalAt.current[type] ?? 0) < SIGNAL_DEDUP_MS) return;
      lastSignalAt.current[type] = now;
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

    // Capture phase, and stop the event there: the code editor (Monaco) handles
    // clipboard and right-click itself, so a bubbling listener would be too late.
    const block = (type: ProctoringEvent) => (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      onBlockedRef.current?.(type);
      report(type);
    };
    const onCopy = block('copy');
    const onPaste = block('paste');
    const onMenu = block('context_menu');
    // Dropping text into the page is pasting by another name.
    const onDrop = (e: DragEvent) => { if (e.dataTransfer?.types.includes('text/plain')) onPaste(e); };
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const capture = { capture: true };
    if (policy?.blockClipboard) {
      document.addEventListener('copy', onCopy, capture);
      document.addEventListener('cut', onCopy, capture);
      document.addEventListener('paste', onPaste, capture);
      document.addEventListener('contextmenu', onMenu, capture);
      document.addEventListener('drop', onDrop, capture);
      document.addEventListener('dragover', onDragOver, capture);
    }

    return () => {
      clearTimeout(blurTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('copy', onCopy, capture);
      document.removeEventListener('cut', onCopy, capture);
      document.removeEventListener('paste', onPaste, capture);
      document.removeEventListener('contextmenu', onMenu, capture);
      document.removeEventListener('drop', onDrop, capture);
      document.removeEventListener('dragover', onDragOver, capture);
    };
  }, [enabled, policy?.blockClipboard, report]);

  // Integrity signals: reported, never blocking (the server notes them for invigilators).
  useEffect(() => {
    if (!enabled) return;
    const scr = window.screen as Screen & { isExtended?: boolean; addEventListener?: (t: string, f: () => void) => void; removeEventListener?: (t: string, f: () => void) => void };
    const checkScreens = () => { if (scr.isExtended) report('multiple_screens'); };
    checkScreens();
    scr.addEventListener?.('change', checkScreens);

    // Docked dev tools shrink the page inside the window.
    const devtoolsTimer = setInterval(() => {
      const gapW = window.outerWidth - window.innerWidth;
      const gapH = window.outerHeight - window.innerHeight;
      if (window.outerWidth > 0 && (gapW > DEVTOOLS_GAP_PX || gapH > DEVTOOLS_GAP_PX + 80)) report('devtools_open');
    }, 3000);

    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      // Dev tools and view-source shortcuts: blocked and noted.
      if (e.key === 'F12' || (mod && e.shiftKey && ['i', 'j', 'c'].includes(k)) || (mod && k === 'u')) {
        e.preventDefault();
        report('devtools_open');
        return;
      }
      // Screenshots: Print Screen, Windows snip (Win+Shift+S arrives as Shift+S with meta), macOS Cmd+Shift+3/4/5.
      if (e.key === 'PrintScreen' || (e.metaKey && e.shiftKey && ['s', '3', '4', '5'].includes(k))) report('screenshot_key');
    };
    // A big block of text appearing at once (drag-and-drop, auto-typers, IME tricks) in any answer box or the code editor.
    const onBeforeInput = (e: InputEvent) => {
      if ((e.data?.length ?? 0) >= LARGE_INSERT_CHARS || (/^insertFrom(Paste|Drop)/.test(e.inputType) && !policy?.blockClipboard)) report('large_paste');
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('keyup', onKey, true);
    document.addEventListener('beforeinput', onBeforeInput as EventListener, true);
    return () => {
      scr.removeEventListener?.('change', checkScreens);
      clearInterval(devtoolsTimer);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('keyup', onKey, true);
      document.removeEventListener('beforeinput', onBeforeInput as EventListener, true);
    };
  }, [enabled, policy?.blockClipboard, report]);

  return { enabled, needsFullscreen, fullscreen, blocked: needsFullscreen && !fullscreen };
}
