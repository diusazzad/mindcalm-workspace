import React from 'react';
import { Activity, ShieldCheck, Wifi, WifiOff, Volume2, VolumeX, RotateCcw } from 'lucide-react';

export default function Navbar({
  isConnected,
  isSessionActive,
  sessionDuration,
  isConsentGranted,
  onOpenConsent,
  onResetSession,
  isMuted,
  onToggleMute,
}) {
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Activity className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-bold text-white tracking-tight">MindCalm</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-medium">
                Workspace
              </span>
            </div>
            <p className="text-xs text-slate-400">Powered by Presage SmartSpectra v3.4 SDK</p>
          </div>
        </div>

        {/* Center: Live Status & Duration */}
        <div className="hidden md:flex items-center space-x-4 bg-slate-950/70 border border-slate-800 px-4 py-1.5 rounded-full">
          <div className="flex items-center space-x-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span className="text-xs font-medium text-slate-300">
              {isConnected ? 'Telemetry 30Hz' : 'Disconnected'}
            </span>
          </div>

          <div className="h-3 w-px bg-slate-800" />

          <div className="text-xs text-slate-400 font-mono">
            Session: <span className="text-slate-200 font-semibold">{formatTime(sessionDuration)}</span>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Privacy badge / consent gate trigger */}
          <button
            onClick={onOpenConsent}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isConsentGranted
                ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/60 hover:bg-emerald-900/40'
                : 'bg-amber-950/50 text-amber-400 border border-amber-800/60 hover:bg-amber-900/40'
            }`}
            title="View Camera Privacy & Consent Architecture"
          >
            <ShieldCheck className="h-4 w-4" />
            <span className="hidden sm:inline">
              {isConsentGranted ? 'Consent Verified (Zero-Storage)' : 'Review Consent'}
            </span>
          </button>

          {/* Soundscape Mute Toggle */}
          <button
            onClick={onToggleMute}
            className={`p-2 rounded-lg border text-xs transition-all ${
              isMuted
                ? 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200'
                : 'border-cyan-800 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-900/40'
            }`}
            title={isMuted ? 'Unmute Ambient Soundscape' : 'Mute Ambient Soundscape'}
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          {/* Reset Session */}
          <button
            onClick={onResetSession}
            className="p-2 rounded-lg border border-slate-700 bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
            title="Reset Session Telemetry"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
