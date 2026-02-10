import { Download, Share2, Award, Calendar, ExternalLink, BadgeCheck } from "lucide-react";
import { motion } from "framer-motion";

const certificates = [
  { title: "Arrays & Hashing Mastery", date: "February 2, 2025", id: "CERT-ARR-2025-001", status: "Issued" },
  { title: "Two Pointers Expert", date: "January 20, 2025", id: "CERT-TP-2025-002", status: "Issued" },
  { title: "Binary Search Proficiency", date: "January 10, 2025", id: "CERT-BS-2025-003", status: "Issued" },
];

const CertificatesPage = () => {
  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Certificates</h1>
        <p className="text-sm text-muted-foreground mt-1">Your achievements & credentials</p>
      </div>

      {/* Certificate Preview */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card-glass rounded-2xl p-8 md:p-12 text-center relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-[0.04]">
          <div className="absolute inset-0 gradient-golden" />
        </div>
        <div className="absolute inset-3 border-2 border-dashed border-primary/10 rounded-xl pointer-events-none" />
        <div className="relative z-10">
          <div className="h-14 w-14 rounded-2xl gradient-golden flex items-center justify-center mx-auto mb-5 shadow-lg">
            <Award className="h-7 w-7 text-primary-foreground" />
          </div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.3em] mb-3 font-semibold">Certificate of Achievement</p>
          <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-2">Arrays & Hashing Mastery</h2>
          <p className="text-sm text-muted-foreground mb-1">Awarded to <strong className="text-foreground">Arjun Sharma</strong></p>
          <p className="text-xs text-muted-foreground mb-8">For completing all 20 problems in the Arrays & Hashing module</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <motion.button
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-all shadow-md"
            >
              <Download className="h-4 w-4" /> Download PDF
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted transition-all"
            >
              <Share2 className="h-4 w-4" /> Share
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Share Options */}
      <div className="card-glass rounded-2xl p-5">
        <p className="text-sm font-semibold text-foreground mb-3">Share to Social</p>
        <div className="flex flex-wrap gap-2">
          {["LinkedIn", "Twitter / X", "WhatsApp", "Copy Link"].map((platform) => (
            <motion.button
              key={platform}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary/40 text-foreground text-sm font-medium hover:bg-secondary transition-all"
            >
              <ExternalLink className="h-3.5 w-3.5 text-primary" />
              {platform}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Certificates List */}
      <div className="card-glass rounded-2xl p-5">
        <p className="text-sm font-semibold text-foreground mb-4">All Certificates</p>
        <div className="space-y-2">
          {certificates.map((cert, i) => (
            <motion.div
              key={cert.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-4 p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-all card-hover"
            >
              <div className="h-11 w-11 rounded-xl gradient-golden flex items-center justify-center flex-shrink-0 shadow-sm">
                <BadgeCheck className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{cert.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{cert.date}</span>
                  <span className="text-xs text-muted-foreground">• {cert.id}</span>
                </div>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button className="p-2.5 rounded-xl card-glass text-foreground hover:bg-secondary transition-all active:scale-95">
                  <Download className="h-4 w-4" />
                </button>
                <button className="p-2.5 rounded-xl card-glass text-foreground hover:bg-secondary transition-all active:scale-95">
                  <Share2 className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CertificatesPage;
