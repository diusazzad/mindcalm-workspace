import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Video,
  Lock,
  AlertTriangle,
  EyeOff,
  Check,
  X,
} from "lucide-react";

export default function ConsentGateModal({
  isOpen,
  onClose,
  onGrantConsent,
  onRevokeConsent,
  isConsentGranted,
}) {
  const [agreedToTerms, setAgreedToTerms] = useState(isConsentGranted);

  useEffect(() => {
    setAgreedToTerms(isConsentGranted);
  }, [isConsentGranted, isOpen]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (agreedToTerms) {
      await onGrantConsent();
    } else {
      await onRevokeConsent();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-2xl border border-cyan-800/60 bg-slate-900 shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-850 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-cyan-950 border border-cyan-700/60 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                Camera Privacy & Opt-In Consent Gate
              </h3>
              <p className="text-xs text-slate-400">
                Presage SmartSpectra Challenge Privacy Architecture
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-4 text-sm text-slate-300">
          <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-800/40 flex items-start space-x-3">
            <Lock className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <strong className="text-cyan-300 font-semibold block mb-0.5">
                100% Ephemeral In-Memory Processing
              </strong>
              MindCalm Workspace and the Presage SmartSpectra v3.4 SDK process
              optical bio-signals strictly in volatile RAM.
              <span className="text-white font-medium">
                {" "}
                Zero raw video, frames, facial crops, or identifiable imagery
                are ever recorded, saved to local disk, or transmitted over
                external networks.
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/40 flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <strong className="text-amber-300 font-semibold block mb-0.5">
                Strict Non-Medical Ergonomics Disclaimer
              </strong>
              This application provides non-clinical ergonomic feedback and
              biofeedback pacing for workplace wellness. It is{" "}
              <span className="text-amber-200 underline font-semibold">
                NOT a medical device
              </span>{" "}
              and cannot be used for diagnosing, treating, mitigating, or
              preventing any medical condition.
            </div>
          </div>

          {/* Core Guarantees List */}
          <div className="space-y-2 pt-1">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              User Rights & Telemetry Architecture:
            </h4>
            <ul className="space-y-1.5 text-xs text-slate-300">
              <li className="flex items-center space-x-2">
                <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                <span>
                  Explicit opt-in: Camera optical capture is strictly locked
                  until you explicitly toggle consent.
                </span>
              </li>
              <li className="flex items-center space-x-2">
                <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                <span>
                  One-click revocation: Revoking consent instantly terminates
                  all optical sampling and destroys active session buffers.
                </span>
              </li>
              <li className="flex items-center space-x-2">
                <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                <span>
                  Fallback Simulation Mode: Automatically available for
                  evaluations without hardware camera access.
                </span>
              </li>
            </ul>
          </div>

          {/* Checkbox */}
          <div className="pt-2 border-t border-slate-800">
            <label className="flex items-center space-x-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
              />
              <span className="text-xs text-slate-200">
                I understand the privacy policy, acknowledge the non-medical
                disclaimer, and authorize camera bio-signal sampling.
              </span>
            </label>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-850 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className={`px-5 py-2 rounded-lg text-xs font-semibold shadow-md transition-all ${
              agreedToTerms
                ? "bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-white shadow-cyan-500/20"
                : "bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700"
            }`}
          >
            {agreedToTerms
              ? "Confirm & Enable Biofeedback"
              : "Revoke & Disconnect Camera"}
          </button>
        </div>
      </div>
    </div>
  );
}
