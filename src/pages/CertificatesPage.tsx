import { Download, Share2, Award, Calendar, ExternalLink, BadgeCheck, Sparkles, Trophy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useApiQuery } from "@/hooks/useApi";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const CertificatesPage = () => {
  // 1. Fetch User Profile for name
  const { data: profile } = useApiQuery<any>(
    ['user-profile'],
    '/users/me'
  );

  // 2. Fetch User Certificates
  const { data: certificates, isLoading: certsLoading } = useApiQuery<any[]>(
    ['user-certificates'],
    '/certificates'
  );

  const activeCert = certificates?.[0]; // Show the most recent one as main

  if (certsLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Certificates</h1>
        <p className="text-sm text-muted-foreground mt-1">Your achievements & verifiable learning milestones</p>
      </div>

      {activeCert ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="card-layer-3 rounded-2xl p-8 md:p-12 text-center relative overflow-hidden shine-sweep"
        >
          {/* Paper texture overlay */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg width=\"60\" height=\"60\" viewBox=\"0 0 60 60\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cg fill=\"none\" fill-rule=\"evenodd\"%3E%3Cg fill=\"%23000000\" fill-opacity=\"0.4\"%3E%3Cpath d=\"m36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')" }} />
          {/* Decorative border */}
          <div className="absolute inset-3 border-2 border-dashed border-primary/15 rounded-xl pointer-events-none" />
          <div className="absolute inset-4 border border-primary/8 rounded-xl pointer-events-none" />
          <div className="relative z-10">
            {/* Gold embossed seal */}
            <div className="relative inline-block mb-5">
              <div className="h-16 w-16 rounded-full gradient-golden flex items-center justify-center mx-auto shadow-xl animate-glow-pulse">
                <Award className="h-8 w-8 text-primary-foreground" />
              </div>
              <Sparkles className="absolute -top-1 -right-1 h-5 w-5 text-primary animate-float" />
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.3em] mb-3 font-semibold">Certificate of Achievement</p>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-2">{activeCert.topic_name || activeCert.title || "DSA Mastery"}</h2>
            <p className="text-sm text-muted-foreground mb-1">Awarded to <strong className="text-foreground">{profile?.full_name || "Code Haven User"}</strong></p>
            <p className="text-xs text-muted-foreground mb-8">For demonstrating exceptional skills in {activeCert.topic_name || "Data Structures and Algorithms"}</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <motion.button
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 px-6 py-3 rounded-xl gradient-golden text-primary-foreground text-sm font-medium transition-all shadow-lg hover:shadow-xl btn-ripple"
              >
                <Download className="h-4 w-4" /> Download PDF
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted transition-all border border-border/50"
              >
                <Share2 className="h-4 w-4" /> Share Credentials
              </motion.button>
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="card-glass rounded-3xl p-16 text-center border border-dashed border-border/60">
          <div className="h-16 w-16 rounded-2xl bg-secondary/50 flex items-center justify-center mx-auto mb-4 opacity-40">
            <Trophy className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">No Certificates Yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">Complete a learning track to earn your first certified achievement and showcase your DSA expertise.</p>
          <motion.button
            whileTap={{ scale: 0.95 }}
            className="px-6 py-3 rounded-xl gradient-golden text-primary-foreground text-sm font-semibold shadow-md"
          >
            Start Learning
          </motion.button>
        </div>
      )}

      {/* Share Options */}
      {activeCert && (
        <div className="card-glass rounded-2xl p-5">
          <p className="text-sm font-semibold text-foreground mb-3">Share to Social</p>
          <div className="flex flex-wrap gap-2">
            {["LinkedIn", "Twitter / X", "WhatsApp", "Copy Link"].map((platform, i) => (
              <motion.button
                key={platform}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary/30 text-foreground text-sm font-medium hover:bg-secondary/60 transition-all border border-border/40"
              >
                <ExternalLink className="h-3.5 w-3.5 text-primary" />
                {platform}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Certificates List */}
      <div className="card-glass rounded-2xl p-5">
        <p className="text-sm font-semibold text-foreground mb-4">All Achievements</p>
        <div className="space-y-2">
          {certificates?.map((cert, i) => (
            <motion.div
              key={cert.id || cert.certificate_code}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              whileHover={{ x: 4 }}
              className="flex items-center gap-4 p-4 rounded-xl bg-secondary/20 hover:bg-secondary/40 transition-all card-hover group"
            >
              <div className="h-11 w-11 rounded-xl gradient-golden flex items-center justify-center flex-shrink-0 shadow-md group-hover:shadow-lg transition-shadow">
                <BadgeCheck className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{cert.topic_name || cert.title || "Track Mastery"}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{new Date(cert.created_at || cert.date).toLocaleDateString()}</span>
                  <span className="text-xs text-muted-foreground">• {cert.certificate_code || cert.id}</span>
                </div>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <motion.button whileTap={{ scale: 0.9 }} className="p-2.5 rounded-xl card-glass text-foreground hover:bg-secondary transition-all border border-border/40">
                  <Download className="h-4 w-4" />
                </motion.button>
                <motion.button whileTap={{ scale: 0.9 }} className="p-2.5 rounded-xl card-glass text-foreground hover:bg-secondary transition-all border border-border/40">
                  <Share2 className="h-4 w-4" />
                </motion.button>
              </div>
            </motion.div>
          ))}
          {!certsLoading && (!certificates || certificates.length === 0) && (
            <div className="py-10 text-center opacity-30 italic text-sm">
              Your achievements will appear here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CertificatesPage;
