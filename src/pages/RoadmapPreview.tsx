import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Lock, CheckCircle2, Star, Loader2 } from 'lucide-react';
import { useApiQuery } from '@/hooks/useApi';

export default function RoadmapPreview() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [targetSlug, setTargetSlug] = useState('java_dsa_90day');
  const [roadmapTitle, setRoadmapTitle] = useState('90-Day DSA + Placement Roadmap');
  const [isMounted, setIsMounted] = useState(false);

  const { data: roadmapData, isLoading } = useApiQuery<any>(
    ['roadmap', targetSlug],
    `/roadmaps/${targetSlug}`
  );

  const DYNAMIC_CHAPTERS = roadmapData?.items?.map((item: any, i: number) => ({
    id: item.day_number || i + 1,
    title: item.title,
    time: '60 min', // In real app, derived from tasks or est_minutes
    emoji: '📚' // Or dynamic icon
  })) || [];

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
      return;
    }

    const data = localStorage.getItem('dsa_os_onboarding');
    if (data) {
      try {
        const { goal, hours_per_day } = JSON.parse(data);

        let parsedHours = 0;
        if (hours_per_day?.includes('3-4') || hours_per_day?.includes('5+')) {
          parsedHours = 3;
        }

        if (goal === 'Get a Job' && parsedHours >= 3) {
          setRoadmapTitle('90-Day Placement Roadmap');
          setTargetSlug('java_dsa_90day');
        } else if (goal === 'Get an Internship') {
          setRoadmapTitle('30-Day Internship Sprint');
          setTargetSlug('java_dsa_90day'); // fallback slug
        } else if (goal === 'Clear College Exams') {
          setRoadmapTitle('Semester Survival Plan');
          setTargetSlug('java_dsa_90day'); // fallback slug
        }
      } catch (e) {
        // ignore JSON parse errors
      }
    }

    // trigger animation
    const timer = setTimeout(() => setIsMounted(true), 100);
    return () => clearTimeout(timer);
  }, [isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-32">
      {/* Decorative desktop background blobs */}
      <div className="hidden sm:block fixed top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />
      <div className="hidden sm:block fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/10 blur-[120px] pointer-events-none" />

      <style>{`
        @keyframes customPulse {
          0%, 100% { opacity: 0.4; transform: scale(0.98); }
          50% { opacity: 0.6; transform: scale(1); }
        }
        .pulse-locked {
          animation: customPulse 3s ease-in-out infinite;
        }
      `}</style>

      <div className="max-w-3xl mx-auto bg-white sm:my-8 sm:rounded-[2rem] sm:shadow-2xl sm:shadow-slate-200/50 sm:border border-slate-100 overflow-hidden relative z-10 transition-all duration-500">

        {/* SECTION 1 - Header */}
        <div className="pt-10 pb-6 px-6 sm:px-12 text-center bg-gradient-to-b from-blue-50/50 to-white">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">
            Your <span className="text-blue-600 px-1">{roadmapTitle}</span> is Ready 🚀
          </h1>
          <p className="text-slate-500 font-medium text-sm sm:text-base mb-6">
            {DYNAMIC_CHAPTERS.length} chapters  ·  90+ practice problems  ·  0 completed
          </p>

          <div className="w-full max-w-md mx-auto h-1.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
            <div className="h-full w-0 bg-blue-600 rounded-full" />
          </div>
        </div>

        {/* SECTION 3 - Social Proof (Moved up for better flow on desktop, or keep as section 3. Let's place it here for immediate trust) */}
        <div className="px-6 sm:px-12 py-4 bg-amber-50/50 border-y border-amber-100/50 mx-4 sm:mx-8 mb-4 rounded-2xl flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-1 mb-1 text-amber-500">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
            ))}
            <span className="text-slate-700 font-bold ml-2 text-sm sm:text-base">4.8/5</span>
          </div>
          <p className="text-slate-600 text-xs sm:text-sm font-medium">from 200+ students</p>
          <p className="text-slate-500 text-xs mt-1">
            Joined by students from IET Lucknow · SATI Vidisha · LNCT Bhopal
          </p>
        </div>

        {/* SECTION 2 - Chapter List */}
        <div className="px-6 sm:px-12 py-4 relative">
          {/* Vertical Line */}
          <div className="absolute left-10 sm:left-16 top-8 bottom-8 w-0.5 border-l-2 border-dashed border-slate-200" />

          <div className="flex flex-col gap-6 relative z-10">
            {DYNAMIC_CHAPTERS.map((chapter: any, index: number) => {
              const isUnlocked = index < 2;

              {/* Card */ }
              return (
                <div key={chapter.id} className={`flex-1 p-4 sm:p-5 rounded-2xl border transition-all ${isUnlocked
                  ? 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200'
                  : 'bg-slate-50/80 border-slate-100/50'
                  }`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl sm:text-2xl drop-shadow-sm">{chapter.emoji}</span>
                      <h3 className={`font-bold text-sm sm:text-lg ${isUnlocked ? 'text-slate-900' : 'text-slate-500 blur-[3px] select-none'}`}>
                        {chapter.title}
                      </h3>
                    </div>
                    {!isUnlocked && (
                      <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 flex-shrink-0 ml-2" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-xs sm:text-sm px-2.5 py-1 rounded-full font-semibold ${isUnlocked ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'
                      }`}>
                      {chapter.time}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECTION 4 - Sticky CTA */}
      <div className="fixed bottom-0 left-0 w-full p-4 sm:p-6 bg-white sm:bg-white/80 sm:backdrop-blur-md border-t border-slate-100 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-50">
        <div className="max-w-3xl mx-auto flex flex-col items-center justify-center">
          <button
            onClick={() => navigate('/signup')}
            className="w-full h-14 sm:h-16 bg-blue-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-blue-500/25 transition-all hover:bg-blue-700 hover:-translate-y-1 hover:shadow-blue-500/40 flex items-center justify-center"
          >
            Start Free — Unlock Your Roadmap &rarr;
          </button>
          <p className="text-slate-500 text-xs sm:text-sm font-medium mt-3 text-center">
            7-day free trial · No credit card · Cancel anytime
          </p>
        </div>
      </div>
    </div >
  );
}
