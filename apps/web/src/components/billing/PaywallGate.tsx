import React, { useState } from 'react';
import { useEntitlements, EntitlementFeature } from '@/services/entitlement.service';
import { PaymentModal } from './PaymentModal';
import { Lock, Sparkles } from 'lucide-react';

interface PaywallGateProps {
  feature: EntitlementFeature;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  inline?: boolean;
}

export function PaywallGate({ feature, children, fallback, inline = false }: PaywallGateProps) {
  const { can } = useEntitlements();
  const [showModal, setShowModal] = useState(false);

  if (can(feature)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (inline) {
    return (
      <span 
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowModal(true); }}
        className="cursor-pointer inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 font-medium hover:bg-indigo-500/20 transition-colors"
      >
        <Lock className="w-3.5 h-3.5" />
        Unlock
        {showModal && <PaymentModal isOpen={showModal} onClose={() => setShowModal(false)} />}
      </span>
    );
  }

  return (
    <div className="relative rounded-2xl overflow-hidden group">
      {/* Blurred out content preview if we wanted to pass children here and blur them. For now, just show the prompt */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md z-10 flex flex-col items-center justify-center p-6 text-center border border-slate-800 rounded-2xl">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4 shadow-lg">
          <Lock className="w-6 h-6 text-white" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Premium Feature Locked</h3>
        <p className="text-slate-400 text-sm mb-6 max-w-sm">
          You need an active plan to access this feature. Upgrade now to unlock your full potential.
        </p>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white text-slate-900 font-bold hover:bg-slate-100 transition-colors shadow-lg"
        >
          <Sparkles className="w-4 h-4 text-indigo-600" />
          Unlock Access
        </button>
      </div>
      
      {/* Placeholder content underneath the blur */}
      <div className="opacity-30 pointer-events-none select-none blur-[2px]">
        {children}
      </div>

      <PaymentModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}
