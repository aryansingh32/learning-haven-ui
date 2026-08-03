import { Lock, Crown } from "lucide-react";

export function PremiumLockBadge({ isLocked = true, className = "" }: { isLocked?: boolean, className?: string }) {
  if (!isLocked) return null;
  
  return (
    <div className={`flex items-center gap-1 bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20 text-orange-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest shrink-0 ${className}`}>
      <Lock className="w-3 h-3" />
      <Crown className="w-3 h-3 ml-0.5" />
      PRO
    </div>
  );
}
