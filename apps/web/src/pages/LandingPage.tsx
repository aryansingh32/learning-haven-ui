import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Check, X, BookOpen, Code2, Award, Briefcase, Flame, ChevronDown, Star, Users, Zap, Shield } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useEffect, useState } from 'react';
import { useSiteConfig } from '@/context/SiteConfigContext';
import { trackPageView } from '@/lib/analytics';
import { api } from '@/services/api.svc';

const painPoints = [
  {
    bad: 'YouTube has 500 videos — no structure',
    icon: X,
    color: 'text-red-400',
  },
  {
    bad: 'LeetCode is a maze without guidance',
    icon: X,
    color: 'text-red-400',
  },
  {
    bad: 'Certificates nobody recognizes',
    icon: X,
    color: 'text-red-400',
  },
];

const PRICING = {
  monthlyDisplay: '583',
  yearlyDisplay: '6,999',
};

const pillars = [
  {
    icon: BookOpen,
    title: 'Learn',
    desc: 'Structured courses with story-driven chapters, quizzes, and real explanations.',
    color: 'from-blue-500 to-indigo-600',
    badge: '4 career paths',
  },
  {
    icon: Code2,
    title: 'Build',
    desc: 'CodeCrafters-style challenges — build Redis, Git, HTTP servers from scratch.',
    color: 'from-emerald-500 to-teal-600',
    badge: 'Docker verified',
  },
  {
    icon: Award,
    title: 'Certify',
    desc: 'Earn branded certificates you can add to LinkedIn and your resume.',
    color: 'from-amber-500 to-orange-600',
    badge: 'Verifiable',
  },
  {
    icon: Briefcase,
    title: 'Get Hired',
    desc: 'Resume builder, job board, apprenticeships, and placement support.',
    color: 'from-purple-500 to-violet-600',
    badge: 'Career tools',
  },
];

const testimonials = [
  {
    name: 'Rahul K.',
    college: 'AKTU, Lucknow',
    company: 'Amazon SDE-1',
    salary: '₹18 LPA',
    text: 'The structured roadmap changed everything. I went from confused to placed in 3 months.',
    avatar: '🧑‍💻',
  },
  {
    name: 'Priya S.',
    college: 'NIT Calicut',
    company: 'Flipkart',
    salary: '₹14 LPA',
    text: 'Build challenges gave me real projects to show in interviews. No other platform has this.',
    avatar: '👩‍💻',
  },
  {
    name: 'Aarav M.',
    college: 'VIT Bhopal',
    company: 'Razorpay',
    salary: '₹12 LPA',
    text: 'The AI coach helped me clear doubts at 2 AM before my interview. Worth every rupee.',
    avatar: '👨‍🎓',
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const config = useSiteConfig();
  const [studentCount, setStudentCount] = useState(847);

  useEffect(() => {
    trackPageView('/');
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }

    // Fetch live student count
    api.get('/analytics/public')
      .then(data => {
        if (data && data.total_users) {
          setStudentCount(data.total_users);
        }
      })
      .catch(err => console.error('Failed to fetch public stats:', err));
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-white font-sans overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-5 py-3">
          <h1 className="font-display text-xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">FORGE</span>
          </h1>
          <div className="hidden sm:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
            <a href="#testimonials" className="hover:text-slate-900 transition-colors">Stories</a>
            <a href="#pricing" className="hover:text-slate-900 transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/signin')}
              className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors px-3 py-2"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/signup')}
              className="hidden sm:inline-flex text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2 rounded-xl hover:shadow-lg hover:shadow-orange-500/25 transition-all"
            >
              Start Free
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
              {studentCount.toLocaleString()} students learning right now
            </div>
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-slate-900 leading-[1.1] tracking-tight mb-5">
              {config.hero_title || 'From Confused Beginner to Hired Developer.'}
            </h1>
            <p className="text-base sm:text-lg text-slate-500 max-w-xl mx-auto mb-8 leading-relaxed">
              {config.hero_subtitle || 'Structured learning + real projects + career support.\nBuilt for Indian students who want more than YouTube.'}
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <button
              onClick={() => navigate('/signup')}
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-lg font-bold rounded-2xl shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:-translate-y-0.5 transition-all duration-200"
            >
              Start Free — No Credit Card
              <ArrowRight className="inline-block ml-2 w-5 h-5" />
            </button>
            <button
              onClick={() => navigate('/pricing')}
              className="w-full sm:w-auto px-6 py-4 text-slate-600 text-base font-semibold rounded-2xl border border-slate-200 hover:bg-slate-50 transition-all"
            >
              → See how it works in 60 seconds
            </button>
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center mt-3"
          >
            <p className="text-xs font-medium text-slate-500">No credit card required. Free forever.</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex items-center justify-center gap-4 mt-6 text-sm text-slate-400"
          >
            <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> 4.8 rating</span>
            <span>•</span>
            <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> 10,000+ students</span>
            <span>•</span>
            <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> Free forever tier</span>
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
            These are the 3 problems every student faces. Forge solves all three.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {painPoints.map((point, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-100 shadow-sm hover:shadow-md hover:border-red-100 transition-all"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                    <point.icon className="w-4 h-4 text-red-400" />
                  </div>
                  <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Problem</span>
                </div>
                <p className="font-bold text-slate-900 text-sm sm:text-base">{point.bad}</p>
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
              <Check className="w-4 h-4" /> Forge solves all three — in one place.
            </div>
          </motion.div>
        </div>
      </section>

      {/* 4 Pillars */}
      <section id="features" className="px-5 py-10 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-xl sm:text-3xl font-extrabold text-slate-900 mb-3"
          >
            Everything you need. One platform.
          </motion.h2>
          <p className="text-center text-sm sm:text-base text-slate-500 mb-8 sm:mb-12">
            Learn → Build → Certify → Get Hired. That's the Forge path.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {pillars.map((pillar, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${pillar.color} flex items-center justify-center text-white shadow-md mb-4 group-hover:scale-110 transition-transform`}>
                  <pillar.icon className="w-6 h-6" />
                </div>
                <span className="inline-block text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-full mb-3">{pillar.badge}</span>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{pillar.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{pillar.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials / Social Proof */}
      <section id="testimonials" className="px-5 py-10 sm:py-20 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-xl sm:text-3xl font-extrabold text-slate-900 mb-3"
          >
            These students used Forge and got placed
          </motion.h2>
          <p className="text-center text-sm sm:text-base text-slate-500 mb-8 sm:mb-12">
            Real outcomes from real students. No fake numbers.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-lg">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-400">{t.college}</p>
                  </div>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed mb-4 italic">"{t.text}"</p>
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-900">{t.company}</span>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{t.salary}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Tease */}
      <section id="pricing" className="px-5 py-10 sm:py-20">
        <div className="max-w-4xl mx-auto">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-xl sm:text-3xl font-extrabold text-slate-900 mb-3"
          >
            Start free. Upgrade when you're ready.
          </motion.h2>
          <p className="text-center text-sm sm:text-base text-slate-500 mb-8 sm:mb-12">
            No credit card required. Generous free tier.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl mx-auto">
            {/* Free */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm"
            >
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Free</p>
              <p className="text-3xl font-extrabold text-slate-900 mb-4">₹0 <span className="text-sm font-medium text-slate-400">forever</span></p>
              <ul className="space-y-2.5 text-sm text-slate-600 mb-6">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 shrink-0" /> First 3 chapters per course</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 shrink-0" /> 3 build challenges</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 shrink-0" /> 5 AI queries per day</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 shrink-0" /> Progress tracking</li>
              </ul>
              <button
                onClick={() => navigate('/signup')}
                className="w-full py-3 rounded-xl border-2 border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all"
              >
                Get Started
              </button>
            </motion.div>
            {/* Pro */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl p-6 text-white shadow-lg shadow-orange-500/20 relative overflow-hidden"
            >
              <div className="absolute top-3 right-3 bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full">Most Popular</div>
              <p className="text-sm font-bold text-orange-100 uppercase tracking-widest mb-1">Pro</p>
              <p className="text-3xl font-extrabold mb-1">₹{PRICING.monthlyDisplay}<span className="text-sm font-medium text-orange-100">/mo</span></p>
              <p className="text-xs text-orange-100 mb-4">billed annually (₹{PRICING.yearlyDisplay}/year)</p>
              <ul className="space-y-2.5 text-sm text-orange-50 mb-6">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 shrink-0" /> All courses + all chapters</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 shrink-0" /> Unlimited AI coaching</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 shrink-0" /> Unlimited build challenges</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 shrink-0" /> Certificates + Resume builder</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 shrink-0" /> WhatsApp daily accountability</li>
              </ul>
              <button
                onClick={() => navigate('/pricing')}
                className="w-full py-3 rounded-xl bg-white text-orange-600 text-sm font-bold hover:bg-orange-50 transition-all shadow-md"
              >
                Upgrade to Pro
              </button>
            </motion.div>
          </div>
          <p className="text-center text-xs text-slate-400 mt-4">
            7-day money-back guarantee. Cancel anytime. Your progress is always saved.
          </p>
        </div>
      </section>

      {/* Referral Teaser */}
      <section className="px-5 py-10 sm:py-16 bg-slate-50">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-900 rounded-2xl p-8 text-white shadow-xl shadow-indigo-500/20"
          >
            <Zap className="w-8 h-8 mx-auto mb-3 text-amber-300" />
            <h3 className="text-xl sm:text-2xl font-extrabold mb-2">Refer a friend → You both learn free</h3>
            <p className="text-sm text-indigo-100 mb-5">
              Earn up to 20% commission for every friend who upgrades. Withdraw directly to UPI.
            </p>
            <button
              onClick={() => navigate('/signup')}
              className="px-6 py-3 bg-white text-indigo-900 text-sm font-bold rounded-xl hover:bg-indigo-50 transition-all shadow-md"
            >
              Start Earning <ArrowRight className="inline-block ml-1 w-4 h-4" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-5 py-10 sm:py-20">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 mb-4">
            Ready to forge your future?
          </h2>
          <p className="text-slate-500 mb-8">
            Join {studentCount.toLocaleString()}+ students already building their careers on Forge.
          </p>
          <button
            onClick={() => navigate('/signup')}
            className="px-10 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-lg font-bold rounded-2xl shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:-translate-y-0.5 transition-all duration-200"
          >
            Start Your Journey — Free
            <ArrowRight className="inline-block ml-2 w-5 h-5" />
          </button>
          <p className="text-xs text-slate-400 mt-3">No credit card required. Free forever.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-5 py-8 border-t border-slate-100">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold">
              <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">FORGE</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">From zero to hired. One forge at a time.</p>
          </div>
          <div className="flex items-center gap-6 text-xs text-slate-400">
            <span>Built for Indian students 🇮🇳</span>
            <span>•</span>
            <span>© 2026 Forge</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
