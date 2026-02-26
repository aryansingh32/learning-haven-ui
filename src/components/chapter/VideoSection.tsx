import React from "react";

type Timestamp = {
  label?: string;
  seconds?: number;
};

interface VideoSectionProps {
  youtubeId?: string | null;
  channel?: string | null;
  durationMinutes?: number | null;
  timestamps?: Timestamp[] | null;
}

export const VideoSection: React.FC<VideoSectionProps> = ({
  youtubeId,
  channel,
  durationMinutes,
  timestamps,
}) => {
  if (!youtubeId) return null;

  const baseWatchUrl = `https://www.youtube.com/watch?v=${youtubeId}`;

  const items = Array.isArray(timestamps) ? timestamps : [];

  return (
    <section className="mb-6">
      <p className="text-sm font-semibold text-gray-800 mb-1">
        🎥 Best Video for This Topic
      </p>
      <p className="text-xs text-gray-500 mb-3">
        We reviewed 10+ videos. This one is the best.
      </p>

      <div className="overflow-hidden rounded-lg shadow-sm mb-3">
        <iframe
          src={`https://www.youtube.com/embed/${youtubeId}`}
          className="w-full aspect-video rounded-lg"
          allowFullScreen
          title="Best video for this topic"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
        {channel && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 font-medium">
            {channel}
          </span>
        )}
        {typeof durationMinutes === "number" && durationMinutes > 0 && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-medium">
            {durationMinutes} min watch
          </span>
        )}
      </div>

      {items.length > 0 && (
        <div className="mt-2 space-y-1">
          <p className="text-xs font-semibold text-gray-700">
            Key Timestamps
          </p>
          <div className="flex flex-wrap gap-2 mt-1">
            {items.map((ts, idx) => {
              const seconds = ts.seconds ?? 0;
              const href = `${baseWatchUrl}&t=${seconds}s`;
              return (
                <a
                  key={`${seconds}-${idx}`}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] px-2.5 py-1 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  {ts.label || `At ${seconds}s`}
                </a>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};

