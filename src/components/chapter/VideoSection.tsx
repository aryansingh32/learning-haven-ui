import React from 'react';

interface VideoSectionProps {
  videoId: string;
  channel?: string;
  title?: string;
  duration?: number;
  timestamps?: Array<{ title: string; seconds: number }>;
}

export const VideoSection: React.FC<VideoSectionProps> = ({
  videoId,
  channel,
  title,
  duration,
  timestamps = []
}) => {
  if (!videoId) return null;

  const formatDuration = (mins?: number) => {
    if (!mins) return '';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className="mb-10">
      <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-1">
        <span>🎥</span> Best Video for This Topic
      </h2>
      <p className="text-slate-500 text-sm mb-4">
        We reviewed 10+ videos. This one is the best.
      </p>

      <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-lg mb-4 aspect-video relative">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          className="w-full h-full absolute inset-0"
          allowFullScreen
          title={title || "YouTube Video"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {channel && (
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
            👤 {channel}
          </span>
        )}
        {duration && (
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
            ⏱️ {formatDuration(duration)}
          </span>
        )}
      </div>

      {timestamps && timestamps.length > 0 && (
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
          <h4 className="text-sm font-bold text-slate-800 mb-2">Key Moments</h4>
          <ul className="space-y-2">
            {timestamps.map((ts, idx) => (
              <li key={idx}>
                <a
                  href={`https://youtube.com/watch?v=${videoId}&t=${ts.seconds}s`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-2"
                >
                  <span className="font-mono bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs">
                    {Math.floor(ts.seconds / 60)}:{(ts.seconds % 60).toString().padStart(2, '0')}
                  </span>
                  {ts.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
