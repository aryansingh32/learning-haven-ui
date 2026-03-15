import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, ArrowRight, Share2, Clock, Zap, CheckCircle2, Target } from 'lucide-react';
import { phases } from '@/data/chapters';
import { useAuth } from '@/context/AuthContext';

export default function PhaseCompletionPage() {
  const { phaseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const phase = phases.find((p) => p.id === phaseId) || phases[0];
  const currentIndex = phases.findIndex((p) => p.id === phaseId);
  const nextPhase = phases[currentIndex + 1];
  const userName = (user as any)?.full_name?.split(' ')[0] || 'Champion';
  const totalMinutes = phase.missions.reduce((sum, m) => sum + m.timeMinutes, 0);

  const shareText = `🎉 I just completed "${phase.title}" on DSA OS!\n\n${phase.missionsTotal} chapters, ${phase.problemsSolved}+ problems solved.\n\nThis structured approach is actually working. If you're from a Tier 3/4 college and want to crack placements, check it out.\n\n#DSA #CodingJourney #Placements`;

  return (
    <div className="max-w-7xl mx-auto space-y-6 py-4 pb-20 md:pb-8">
      {/* Celebration Hero */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 p-8 sm:p-12 text-center text-white"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_50%)]" />
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
          className="relative z-10"
        >
          <div className="w-20 h-20 mx-auto rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4 ring-4 ring-white/30">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold mb-2">Phase Complete! 🎉</h1>
          <p className="text-lg sm:text-xl font-bold opacity-90 mb-1">{phase.title}</p>
          <p className="text-sm opacity-70">Congratulations, {userName}! You've mastered this phase.</p>
        </motion.div>
      </motion.div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: CheckCircle2, label: 'Chapters', value: `${phase.missionsTotal}` },
          { icon: Target, label: 'Problems Solved', value: `${phase.problemsSolved}+` },
          { icon: Zap, label: 'XP Earned', value: `${phase.missions.reduce((sum, m) => sum + m.reward.xp, 0)}` },
          { icon: Clock, label: 'Time Spent', value: `~${Math.round(totalMinutes / 60)}h` },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + i * 0.1 }}
            className="card-glass rounded-2xl p-4 text-center"
          >
            <stat.icon className="w-5 h-5 text-primary mx-auto mb-2" />
            <p className="font-display text-2xl font-bold text-foreground">{stat.value}</p>
            <p className="text-[10px] text-muted-foreground">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* LinkedIn Share Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="card-glass rounded-2xl p-5 sm:p-6"
      >
        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <Share2 className="w-4 h-4 text-primary" />
          Share Your Achievement
        </h3>
        <div className="bg-secondary/50 rounded-xl p-4 border border-border/50 mb-4">
          <p className="text-xs text-foreground whitespace-pre-line">{shareText}</p>
        </div>
        <button
          onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.origin)}`, '_blank')}
          className="w-full sm:w-auto px-6 py-3 bg-[#0077B5] text-white rounded-xl font-bold text-sm hover:bg-[#006699] transition-colors"
        >
          Share on LinkedIn
        </button>
      </motion.div>

      {/* Next Phase CTA */}
      {nextPhase ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="card-glass rounded-2xl p-5 sm:p-6"
        >
          <h3 className="text-lg font-bold text-foreground mb-1">Ready for the next challenge?</h3>
          <p className="text-sm text-muted-foreground mb-4">{nextPhase.title}: {nextPhase.subtitle}</p>
          <button
            onClick={() => navigate('/chapters')}
            className="w-full sm:w-auto px-6 py-3 gradient-golden text-white rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all"
          >
            Start {nextPhase.title} <ArrowRight className="inline-block ml-2 w-4 h-4" />
          </button>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="card-glass rounded-2xl p-5 sm:p-6 text-center"
        >
          <h3 className="text-lg font-bold text-foreground mb-1">🎓 Course Complete!</h3>
          <p className="text-sm text-muted-foreground mb-4">You've completed the entire DSA OS curriculum. You're job-ready.</p>
          <button
            onClick={() => navigate('/certificates')}
            className="px-6 py-3 gradient-golden text-white rounded-xl font-bold text-sm shadow-lg"
          >
            View Your Certificate
          </button>
        </motion.div>
      )}
    </div>
  );
}
