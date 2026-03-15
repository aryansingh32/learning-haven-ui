import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Target, BookOpen, Trophy, Flame, ChevronDown } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useEffect } from 'react';

const painPoints = [
  {
    icon: '😵',
    title: "Don't know where to start with DSA",
    desc: 'Too many topics, zero roadmap. You end up jumping between tutorials.',
  },
  {
    icon: '📺',
    title: 'YouTube has 100 videos. Which one is right?',
    desc: 'You watch 3 hours but still can\'t solve a single problem.',
  },
  {
    icon: '😰',
    title: 'LeetCode feels impossible without guidance',
    desc: 'You open a Medium problem and have no idea where to start.',
  },
];

const journeyPhases = [
  { phase: 1, title: 'Foundations', desc: 'Problem solving, arrays, strings', icon: BookOpen, color: 'from-orange-400 to-amber-500' },
  { phase: 2, title: 'Advanced DS', desc: 'Stacks, queues, trees, graphs', icon: Target, color: 'from-blue-400 to-indigo-500' },
  { phase: 3, title: 'Job Ready', desc: 'DP, system design, mock interviews', icon: Trophy, color: 'from-emerald-400 to-teal-500' },
];


export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  return (
  <div className="min-h-screen bg-white font-sans overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-5 py-3">
          <h1 className="font-display text-xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">DSA</span>{' '}
            <span className="text-slate-900">OS</span>
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/signin')}
              className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors px-3 py-2"
            >
              Sign In
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-8 px-5 sm:pt-32 sm:pb-16">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-600 rounded-full px-4 py-1.5 text-xs font-bold mb-6 border border-orange-100">
              <Flame className="w-3.5 h-3.5" />
              Built for Tier 3/4 students
            </div>
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-slate-900 leading-[1.1] tracking-tight mb-5">
              Your college{' '}
              <span className="relative">
                <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                  doesn't teach
                </span>
                <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 200 8" fill="none">
                  <path d="M1 5.5C40 2 80 2 100 3.5C120 5 160 6 199 3" stroke="rgb(249,115,22)" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </span>{' '}
              you this.
              <br />
              <span className="text-slate-400 text-2xl sm:text-4xl md:text-5xl font-bold">We do.</span>
            </h1>
            <p className="text-base sm:text-lg text-slate-500 max-w-xl mx-auto mb-8 leading-relaxed">
              A structured DSA journey designed for Tier 3/4 students. No random YouTube playlists. No confusion. Just a clear path from zero to job-ready.
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <button
              onClick={() => navigate('/signup')}
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-lg font-bold rounded-2xl shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:-translate-y-0.5 transition-all duration-200"
            >
              Start Your Journey — Free
              <ArrowRight className="inline-block ml-2 w-5 h-5" />
            </button>
            <p className="text-xs text-slate-400 mt-3">No credit card required. Start learning in 30 seconds.</p>
          </motion.div>
        </div>
      </section>

      {/* Scroll indicator */}
      <div className="flex justify-center pb-4 sm:pb-8">
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="text-slate-300"
        >
          <ChevronDown className="w-6 h-6" />
        </motion.div>
      </div>

      {/* Pain Points */}
      <section className="px-5 py-10 sm:py-16 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-xl sm:text-3xl font-extrabold text-slate-900 mb-3"
          >
            Sound familiar?
          </motion.h2>
          <p className="text-center text-sm sm:text-base text-slate-500 mb-8 sm:mb-12">
            These are the 3 problems every Tier 3/4 student faces. We solved all three.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {painPoints.map((point, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-100 shadow-sm hover:shadow-md hover:border-orange-100 transition-all"
              >
                <span className="text-3xl mb-3 block">{point.icon}</span>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base mb-2">{point.title}</h3>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">{point.desc}</p>
              </motion.div>
            ))}
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mt-8"
          >
            <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 rounded-full px-5 py-2 text-sm font-bold border border-green-100">
              <Check className="w-4 h-4" /> We solved all three.
            </div>
          </motion.div>
        </div>
      </section>

      {/* Journey Visual */}
      <section className="px-5 py-10 sm:py-20">
        <div className="max-w-4xl mx-auto">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-xl sm:text-3xl font-extrabold text-slate-900 mb-3"
          >
            Your journey from zero to job-ready
          </motion.h2>
          <p className="text-center text-sm sm:text-base text-slate-500 mb-8 sm:mb-12">
            Not a syllabus. A clear, guided path.
          </p>
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-6 sm:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-orange-300 via-blue-300 to-emerald-300 sm:-translate-x-px" />
            <div className="space-y-6 sm:space-y-10">
              {journeyPhases.map((phase, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                  className={`relative flex items-center ${i % 2 === 0 ? 'sm:justify-start' : 'sm:justify-end'}`}
                >
                  {/* Node dot */}
                  <div className={`absolute left-6 sm:left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-gradient-to-br ${phase.color} ring-4 ring-white shadow-md z-10`} />
                  {/* Card */}
                  <div className={`ml-14 sm:ml-0 sm:w-[44%] bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-lg transition-shadow ${i % 2 !== 0 ? '' : ''}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${phase.color} flex items-center justify-center text-white shadow-md`}>
                        <phase.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Phase {phase.phase}</p>
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base">{phase.title}</h3>
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-500">{phase.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-5 py-6 border-t border-slate-100 text-center">
        <p className="text-xs text-slate-400">
          © 2026 DSA OS. Built for students who want to code their future.
        </p>
      </footer>
    </div>
  );
}
