import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, XCircle, Loader2 } from "lucide-react";
import { api } from "@/services/api.svc";

interface VerifyResult {
  valid: boolean;
  message?: string;
  certificate?: {
    topic: string;
    issued_to: string;
    issued_at: string;
    verification_code: string;
  };
}

export default function CertificateVerifyPage() {
  const { code = "" } = useParams<{ code: string }>();

  const { data, isLoading } = useQuery<VerifyResult>({
    queryKey: ["certificate-verify", code],
    queryFn: () => api.get(`/certificates/verify/${code}`),
    enabled: Boolean(code),
    retry: false,
  });

  useEffect(() => {
    document.title = data?.valid ? "Verified Certificate — Learning Haven" : "Certificate Verification — Learning Haven";
  }, [data]);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-16 text-white flex items-center justify-center">
      <div className="w-full max-w-lg">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 text-slate-300">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p>Verifying certificate…</p>
          </div>
        ) : data?.valid && data.certificate ? (
          <div className="rounded-2xl border border-amber-300/30 bg-gradient-to-br from-slate-900 via-slate-950 to-amber-950/30 p-8 text-center shadow-xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 ring-4 ring-emerald-500/20">
              <BadgeCheck className="h-7 w-7 text-emerald-400" />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-2">Verified Certificate</p>
            <h1 className="text-2xl font-extrabold mb-1">{data.certificate.topic}</h1>
            <p className="text-slate-300 mb-4">
              Awarded to <strong>{data.certificate.issued_to}</strong>
            </p>
            <p className="text-xs text-slate-400">
              Issued on {new Date(data.certificate.issued_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            <p className="mt-4 text-[10px] font-mono text-slate-500 break-all">
              Verification code: {data.certificate.verification_code}
            </p>
            <p className="mt-6 text-xs text-slate-400">
              This certificate was issued by Learning Haven and is authentic.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-red-400/20 bg-slate-900 p-8 text-center shadow-xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 ring-4 ring-red-500/20">
              <XCircle className="h-7 w-7 text-red-400" />
            </div>
            <h1 className="text-xl font-bold mb-2">Certificate Not Found</h1>
            <p className="text-sm text-slate-400">
              We couldn't verify a certificate with this code. It may have been entered incorrectly or the certificate may not exist.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
