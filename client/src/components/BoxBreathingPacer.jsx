import React, { useState, useEffect } from 'react';
import { Wind, Play, Pause, RotateCcw, Info } from 'lucide-react';

const PHASES = [
  { name: 'Inhale', duration: 4, instruction: 'Breathe in slowly through your nose', color: 'from-cyan-500 to-emerald-400' },
  { name: 'Hold', duration: 4, instruction: 'Gently suspend breath, keep shoulders relaxed', color: 'from-emerald-400 to-teal-500' },
  { name: 'Exhale', duration: 4, instruction: 'Release breath steadily through mouth', color: 'from-teal-500 to-indigo-500' },
  { name: 'Hold', duration: 4, instruction: 'Rest in stillness before the next breath', color: 'from-indigo-500 to-cyan-500' }
];

export default function BoxBreathingPacer({ userRespirationRate }) {
  const [isActive, setIsActive] = useState(true);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [countdown, setCountdown] = useState(4);
  const [completedCycles, setCompletedCycles] = useState(0);

  useEffect(() => {
    if (!isActive) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setPhaseIndex((currPhase) => {
            const nextPhase = (currPhase + 1) % PHASES.length;
            if (nextPhase === 0) {
              setCompletedCycles((c) => c + 1);
            }
            return nextPhase;
          });
          return 4;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive]);

  const currentPhase = PHASES[phaseIndex];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center space-x-2">
            <Wind className="h-5 w-5 text-emerald-400" />
            <h3 className="font-bold text-sm text-white uppercase tracking-wider">
              Autonomic Box Breathing Pacer (4-4-4-4)
            </h3>
          </div>
          <span className="text-xs font-mono text-cyan-400">
            Cycle Count: {completedCycles}
          </span>
        </div>

        {/* Dynamic Pacer Circle */}
        <div className="py-6 flex flex-col items-center justify-center">
          <div className="relative flex items-center justify-center">
            {/* Outer pulsating ring */}
            <div
              className={`h-48 w-48 rounded-full bg-gradient-to-tr ${currentPhase.color} opacity-20 filter blur-xl transition-all duration-1000 ${
                phaseIndex === 0 ? 'scale-125' : phaseIndex === 2 ? 'scale-90' : 'scale-110'
              }`}
            />

            {/* Inner Interactive Circle */}
            <div
              className={`absolute h-40 w-40 rounded-full border-2 border-cyan-400/50 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center shadow-2xl transition-all duration-1000 ${
                phaseIndex === 0
                  ? 'scale-110 border-cyan-400 shadow-cyan-500/30'
                  : phaseIndex === 2
                  ? 'scale-95 border-indigo-400 shadow-indigo-500/20'
                  : 'scale-105 border-emerald-400'
              }`}
            >
              <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
                {currentPhase.name}
              </span>
              <span className="text-4xl font-extrabold text-white font-mono my-1">
                {countdown}s
              </span>
              <span className="text-[10px] text-cyan-300 font-mono">
                {userRespirationRate ? `Current: ${userRespirationRate.toFixed(1)} RPM` : 'Syncing'}
              </span>
            </div>
          </div>

          <p className="mt-4 text-xs text-center text-slate-300 font-medium max-w-xs">
            {currentPhase.instruction}
          </p>
        </div>
      </div>

      {/* Controls Strip */}
      <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsActive(!isActive)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center space-x-1.5 transition-colors ${
              isActive
                ? 'border-amber-700/60 bg-amber-950/40 text-amber-300 hover:bg-amber-900/40'
                : 'border-emerald-700/60 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/40'
            }`}
          >
            {isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            <span>{isActive ? 'Pause Pacer' : 'Resume Pacer'}</span>
          </button>

          <button
            onClick={() => {
              setPhaseIndex(0);
              setCountdown(4);
              setCompletedCycles(0);
            }}
            className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200"
            title="Reset Pacer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="text-[11px] text-slate-400 flex items-center space-x-1">
          <Info className="h-3.5 w-3.5 text-cyan-400" />
          <span>Vagal Nerve Stimulation</span>
        </div>
      </div>
    </div>
  );
}
