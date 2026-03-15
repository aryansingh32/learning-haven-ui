import { Download, Share2, Award, Calendar, ExternalLink, BadgeCheck, Sparkles, Trophy } from "lucide-react";
import { motion } from "framer-motion";
import { useApiQuery } from "@/hooks/useApi";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { phaseOne } from "@/data/chapters";

const CertificatesPage = () => {
  const { user } = useAuth();

  // Keep ALL existing API calls
  const { data: profile } = useApiQuery<any>(
    ['user-profile'],
    '/users/me'
  );

  const { data: certificates, isLoading: certsLoading } = useApiQuery<any[]>(
    ['user-certificates'],
    '/certificates'
  );

  const userName = profile?.full_name || (user as any)?.full_name || 'Learner';

  // Generate share text for LinkedIn card
  const getShareText = (certName: string) =>
    `🎓 I just earned a certificate in "${certName}" on DSA OS!\n\nFrom problem solving 101 to real challenges — the structured approach works.\n\n#DSA #CodingJourney #Placements #LearningInPublic`;

  if (certsLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-4">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  const activeCert = certificates?.[0];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 md:pb-8">
      <div>
        <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground">Certificates</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Your verified achievements & learning milestones</p>
      </div>

      {activeCert ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl overflow-hidden bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 p-6 sm:p-10 text-center text-white relative"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_50%)]" />
          <div className="relative z-10">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
            >
              <div className="w-16 h-16 mx-auto rounded-full bg-white/20 backdrop-blur flex items-center justify-center mb-4 ring-4 ring-white/30">
                <Award className="w-8 h-8 text-white" />
              </div>
            </motion.div>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-2">Certificate of Achievement</p>
            <h2 className="text-xl sm:text-2xl font-extrabold mb-1">
              {activeCert.topic_name || activeCert.title || "DSA Mastery"}
            </h2>
            <p className="text-sm opacity-80 mb-1">Awarded to <strong>{userName}</strong></p>
            <p className="text-xs opacity-60 mb-5">
              For demonstrating exceptional skills in {activeCert.topic_name || "Data Structures and Algorithms"}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
              <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-orange-600 text-sm font-bold shadow-md hover:shadow-lg transition-all">
                <Download className="w-4 h-4" /> Download PDF
              </button>
              <button
                onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.origin)}`, '_blank')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/20 text-white text-sm font-bold border border-white/30 backdrop-blur hover:bg-white/30 transition-all"
              >
                <Share2 className="w-4 h-4" /> Share on LinkedIn
              </button>
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="card-glass rounded-2xl p-10 sm:p-14 text-center border border-dashed border-border/50">
          <div className="w-14 h-14 rounded-2xl bg-secondary/50 flex items-center justify-center mx-auto mb-4 opacity-30">
            <Trophy className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-1">No Certificates Yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">
            Complete a learning phase to earn your first verified certificate and showcase your DSA skills.
          </p>
          <button className="px-5 py-2.5 rounded-xl gradient-golden text-white text-sm font-bold shadow-md">
            Start Learning
          </button>
        </div>
      )}

      {/* LinkedIn Share Preview */}
      {activeCert && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card-glass rounded-2xl p-4 sm:p-5"
        >
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Share2 className="w-4 h-4 text-primary" />
            LinkedIn Share Preview
          </h3>
          <div className="bg-secondary/50 rounded-xl p-4 border border-border/50 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full gradient-golden flex items-center justify-center text-white font-bold text-xs">
                {userName.charAt(0)}
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">{userName}</p>
                <p className="text-[10px] text-muted-foreground">DSA OS Certificate Holder</p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground whitespace-pre-line leading-relaxed">
              {getShareText(activeCert.topic_name || activeCert.title || 'DSA Mastery')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {["LinkedIn", "Twitter / X", "WhatsApp", "Copy Link"].map((platform, i) => (
              <motion.button
                key={platform}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary/30 text-foreground text-xs font-medium hover:bg-secondary/60 transition-all border border-border/40"
              >
                <ExternalLink className="w-3 h-3 text-primary" />
                {platform}
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* All Certificates */}
      {certificates && certificates.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card-glass rounded-2xl p-4 sm:p-5"
        >
          <h3 className="text-sm font-bold text-foreground mb-3">All Achievements</h3>
          <div className="space-y-2">
            {certificates.map((cert, i) => (
              <motion.div
                key={cert.id || cert.certificate_code || i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 + i * 0.05 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-secondary/20 hover:bg-secondary/40 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl gradient-golden flex items-center justify-center text-white flex-shrink-0 shadow-sm">
                  <BadgeCheck className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                    {cert.topic_name || cert.title || "Track Mastery"}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Calendar className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(cert.created_at || cert.date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button className="p-2 rounded-lg card-glass text-foreground hover:bg-secondary transition-all border border-border/40">
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button className="p-2 rounded-lg card-glass text-foreground hover:bg-secondary transition-all border border-border/40">
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default CertificatesPage;
