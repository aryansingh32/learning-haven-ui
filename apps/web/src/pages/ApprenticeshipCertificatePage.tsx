import { useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apprenticeshipService } from '@/features/apprenticeship/api/apprenticeship.service';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Download, Share2 } from "lucide-react";
import { tracker } from "@/lib/tracker";

export default function ApprenticeshipCertificatePage() {
  const { code = "" } = useParams<{ code: string }>();

  useEffect(() => {
    tracker.track("certificate_viewed", { code });
  }, [code]);

  const query = useQuery({
    queryKey: ["apprenticeship-certificate", code],
    queryFn: () => apprenticeshipService.verifyCertificate(code),
    enabled: Boolean(code),
  });

  const certificate = query.data?.certificate;
  const shareText = useMemo(() => {
    if (!certificate) return "";
    return `I'm excited to share that I've completed the ${certificate.program_id || "Learning Haven Apprenticeship"} at Learning Haven.\n\nCertificate: ${window.location.href}\n\n#WebDevelopment #LearningHaven`;
  }, [certificate]);

  const shareOnLinkedIn = () => {
    tracker.track("certificate_linkedin_shared", { code });
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!certificate) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-16">
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            {query.isLoading ? "Verifying certificate..." : "Certificate not found."}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-emerald-400" />
          <div>
            <h1 className="text-3xl font-bold">Verified Certificate</h1>
            <p className="text-slate-300">This certificate is authentic and was issued by Learning Haven.</p>
          </div>
        </div>

        <Card className="overflow-hidden border border-amber-300/30 bg-gradient-to-br from-slate-900 via-slate-950 to-amber-950/30 text-white">
          <CardContent className="space-y-8 p-10">
            <div className="flex items-center justify-between">
              <Badge className="bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20">Verified</Badge>
              <span className="text-sm text-slate-300">{certificate.verification_code}</span>
            </div>

            <div className="space-y-3 text-center">
              <p className="text-sm uppercase tracking-[0.35em] text-amber-200">Learning Haven</p>
              <h2 className="text-5xl font-semibold tracking-tight">{certificate.recipient_name}</h2>
              <p className="mx-auto max-w-3xl text-lg text-slate-200">
                successfully completed the apprenticeship program with a final grade of {certificate.final_grade}.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase text-slate-400">Completed</p>
                <p className="mt-2 text-lg font-semibold">{new Date(certificate.issued_at).toLocaleDateString()}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase text-slate-400">Projects</p>
                <p className="mt-2 text-lg font-semibold">{certificate.projects_completed}/5</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase text-slate-400">Quality</p>
                <p className="mt-2 text-lg font-semibold">{certificate.avg_code_quality_score}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase text-slate-400">Grade</p>
                <p className="mt-2 text-lg font-semibold">{certificate.final_grade}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-3">
          {certificate.pdf_url ? (
            <Button asChild onClick={() => tracker.track("certificate_downloaded", { code })}>
              <a href={certificate.pdf_url} target="_blank" rel="noreferrer">
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </a>
            </Button>
          ) : null}
          <Button variant="outline" onClick={shareOnLinkedIn}>
            <Share2 className="mr-2 h-4 w-4" />
            Share on LinkedIn
          </Button>
        </div>

        <Card>
          <CardContent className="space-y-2 p-6 text-sm">
            <p className="font-medium">Suggested LinkedIn copy</p>
            <pre className="whitespace-pre-wrap rounded-xl bg-muted p-4 text-xs">{shareText}</pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
