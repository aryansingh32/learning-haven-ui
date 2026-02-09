import { Download, Share2, Award, Calendar, ExternalLink } from "lucide-react";

const certificates = [
  {
    title: "Arrays & Hashing Mastery",
    date: "February 2, 2025",
    id: "CERT-ARR-2025-001",
    status: "Issued",
  },
  {
    title: "Two Pointers Expert",
    date: "January 20, 2025",
    id: "CERT-TP-2025-002",
    status: "Issued",
  },
  {
    title: "Binary Search Proficiency",
    date: "January 10, 2025",
    id: "CERT-BS-2025-003",
    status: "Issued",
  },
];

const CertificatesPage = () => {
  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Certificates</h1>
        <p className="text-sm text-muted-foreground mt-1">Your achievements & credentials</p>
      </div>

      {/* Certificate Preview */}
      <div className="bg-card rounded-2xl shadow-card border border-border p-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 gradient-golden" />
        <div className="relative z-10">
          <Award className="h-12 w-12 text-primary mx-auto mb-4" />
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Certificate of Achievement</p>
          <h2 className="font-display text-2xl font-bold text-foreground mb-1">Arrays & Hashing Mastery</h2>
          <p className="text-sm text-muted-foreground mb-1">Awarded to <strong className="text-foreground">Arjun Sharma</strong></p>
          <p className="text-xs text-muted-foreground mb-6">For completing all 20 problems in the Arrays & Hashing module</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
              <Download className="h-4 w-4" /> Download PDF
            </button>
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted transition-colors">
              <Share2 className="h-4 w-4" /> Share
            </button>
          </div>
        </div>
      </div>

      {/* Share Options */}
      <div className="bg-card rounded-2xl shadow-card border border-border p-5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Share to Social</p>
        <div className="flex flex-wrap gap-3">
          {["LinkedIn", "Twitter / X", "WhatsApp", "Copy Link"].map((platform) => (
            <button
              key={platform}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {platform}
            </button>
          ))}
        </div>
      </div>

      {/* Certificates List */}
      <div className="bg-card rounded-2xl shadow-card border border-border p-5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">All Certificates</p>
        <div className="space-y-3">
          {certificates.map((cert) => (
            <div key={cert.id} className="flex items-center gap-4 p-4 rounded-xl bg-secondary hover:bg-muted transition-colors">
              <div className="h-10 w-10 rounded-xl gradient-golden flex items-center justify-center flex-shrink-0">
                <Award className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{cert.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{cert.date}</span>
                  <span className="text-xs text-muted-foreground">• {cert.id}</span>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button className="p-2 rounded-lg bg-card border border-border text-foreground hover:bg-secondary transition-colors">
                  <Download className="h-4 w-4" />
                </button>
                <button className="p-2 rounded-lg bg-card border border-border text-foreground hover:bg-secondary transition-colors">
                  <Share2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CertificatesPage;
