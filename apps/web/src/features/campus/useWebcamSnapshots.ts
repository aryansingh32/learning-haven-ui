import { useEffect, useRef } from 'react';
import { nextSnapshotDelay, SNAPSHOT_LIMITS } from '@repo/assessment-core';
import { uploadSnapshot } from '@/services/campus.service';

// Optional webcam proctoring. When a test turns it on, the start screen asks for
// the camera; during the test a small photo (320×240 JPEG) is taken at random
// moments 2–5 minutes apart and sent to the Campus API, where only the
// college's invigilators can see it. Nothing is recorded continuously and no
// audio is used. If the camera is refused or stops, the exam page reports
// 'camera_off' once (noted for the invigilator, never a violation by itself).

export const cameraSupported = () =>
  typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);

/** Asks for the front camera. Resolves null when refused or not available. */
export async function requestCamera(): Promise<MediaStream | null> {
  if (!cameraSupported()) return null;
  try {
    return await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' }, audio: false });
  } catch {
    return null;
  }
}

export function stopCamera(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

const live = (stream: MediaStream | null) => Boolean(stream?.getVideoTracks().some((t) => t.readyState === 'live'));

/** One frame of the stream as a JPEG data URL under the size limit (lower quality until it fits). */
async function capture(stream: MediaStream): Promise<string | null> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  try {
    await video.play();
    if (!video.videoWidth) await new Promise((r) => setTimeout(r, 300));
    const w = 320;
    const h = Math.round((video.videoHeight / Math.max(1, video.videoWidth)) * w) || 240;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')?.drawImage(video, 0, 0, w, h);
    for (const quality of [0.6, 0.45, 0.3]) {
      const url = canvas.toDataURL('image/jpeg', quality);
      if ((url.length - 23) * 0.75 <= SNAPSHOT_LIMITS.maxBytes) return url;
    }
    return null;
  } catch {
    return null;
  } finally {
    video.pause();
    video.srcObject = null;
  }
}

interface Options {
  attemptId: string;
  /** The test asks for photos and the attempt is running. */
  enabled: boolean;
  stream: MediaStream | null;
  /** Called once when the camera is missing, refused or stops. */
  onCameraOff: () => void;
}

/** Attempts whose camera-off was already reported (the runner remounts for each timed section). */
const cameraOffReported = new Set<string>();

export function useWebcamSnapshots({ attemptId, enabled, stream, onCameraOff }: Options) {
  const offRef = useRef(onCameraOff);
  offRef.current = onCameraOff;

  useEffect(() => {
    if (!enabled) return;
    const off = () => {
      if (cameraOffReported.has(attemptId)) return;
      cameraOffReported.add(attemptId);
      offRef.current();
    };
    if (!live(stream)) { off(); return; }

    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const tracks = stream!.getVideoTracks();
    tracks.forEach((t) => t.addEventListener('ended', off));

    const take = async () => {
      if (stopped) return;
      if (!live(stream)) { off(); return; }
      const image = await capture(stream!);
      if (image && !stopped) {
        try {
          const res = await uploadSnapshot(attemptId, image);
          if (res.remaining <= 0) return; // the limit for this attempt is reached
        } catch { /* offline or too soon: try again at the next moment */ }
      }
      if (!stopped) timer = setTimeout(take, nextSnapshotDelay() * 1000);
    };
    // The first photo soon after starting (or resuming), then at random moments.
    timer = setTimeout(take, (20 + Math.floor(Math.random() * 40)) * 1000);
    return () => {
      stopped = true;
      clearTimeout(timer);
      tracks.forEach((t) => t.removeEventListener('ended', off));
    };
  }, [attemptId, enabled, stream]);
}
