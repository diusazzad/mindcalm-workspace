import React, { useState, useEffect } from "react";
import {
  Wind,
  Play,
  Pause,
  RotateCcw,
  Info,
  Sparkles,
  Activity,
} from "lucide-react";

const PATTERNS = {
  box: {
    id: "box",
    name: "Box Breathing (4-4-4-4)",
    tag: "Focus & Parasympathetic Reset",
    phases: [
      {
        name: "Inhale",
        duration: 4,
        instruction: "Breathe in slowly through your nose",
        color: "from-cyan-500 to-emerald-400",
      },
      {
        name: "Hold",
        duration: 4,
        instruction: "Gently suspend breath, keep shoulders relaxed",
        color: "from-emerald-400 to-teal-500",
      },
      {
        name: "Exhale",
        duration: 4,
        instruction: "Release breath steadily through mouth",
        color: "from-teal-500 to-indigo-500",
      },
      {
        name: "Hold",
        duration: 4,
        instruction: "Rest in stillness before next inhale",
        color: "from-indigo-500 to-cyan-500",
      },
    ],
  },
  relax: {
    id: "relax",
    name: "Relax & De-stress (4-7-8)",
    tag: "Vagal Tone & Rapid Calming",
    phases: [
      {
        name: "Inhale",
        duration: 4,
        instruction: "Quiet inhale through nose",
        color: "from-cyan-500 to-blue-400",
      },
      {
        name: "Hold",
        duration: 7,
        instruction: "Retain oxygenated stillness",
        color: "from-blue-400 to-indigo-500",
      },
      {
        name: "Exhale",
        duration: 8,
        instruction: "Whoosh exhale completely through mouth",
        color: "from-indigo-500 to-violet-500",
      },
    ],
  },
  coherent: {
    id: "coherent",
    name: "Coherent Rhythm (5-5)",
    tag: "Maximum HRV Coherence",
    phases: [
      {
        name: "Inhale",
        duration: 5,
        instruction: "Smooth diaphragmatic inhalation",
        color: "from-emerald-400 to-teal-400",
      },
      {
        name: "Exhale",
        duration: 5,
        instruction: "Even autonomic release",
        color: "from-teal-400 to-cyan-500",
      },
    ],
  },
};

export default function BoxBreathingPacer({ userRespirationRate }) {
  const [isActive, setIsActive] = useState(true);
  const [patternKey, setPatternKey] = useState("box");
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [countdown, setCountdown] = useState(4);
  const [completedCycles, setCompletedCycles] = useState(0);

  const pattern = PATTERNS[patternKey] || PATTERNS.box;
  const currentPhase = pattern.phases[phaseIndex] || pattern.phases[0];
  const totalPhaseDuration = currentPhase.duration;

  // Real-time Biofeedback Coherence Sync Calculation
  // Target rate for Box (16s cycle) is 3.75 RPM, Coherent is 6.0 RPM
  const targetRpm =
    patternKey === "box" ? 3.75 : patternKey === "coherent" ? 6.0 : 4.0;
  const respirationDelta = Math.abs((userRespirationRate || 14.5) - targetRpm);
  // Coherence score between 60% and 98% based on stability
  const coherenceScore = Math.max(
    58,
    Math.min(98, Math.round(100 - respirationDelta * 3.8)),
  );

  useEffect(() => {
    if (!isActive) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setPhaseIndex((currPhase) => {
            const nextPhase = (currPhase + 1) % pattern.phases.length;
            if (nextPhase === 0) {
              setCompletedCycles((c) => c + 1);
            }
            return nextPhase;
          });
          const nextIdx = (phaseIndex + 1) % pattern.phases.length;
          return pattern.phases[nextIdx].duration;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, phaseIndex, patternKey, pattern.phases]);

  const handlePatternChange = (key) => {
    setPatternKey(key);
    setPhaseIndex(0);
    setCountdown(PATTERNS[key].phases[0].duration);
  };

  // SVG circular progress calculation
  const circumference = 2 * Math.PI * 72; // radius = 72
  const progressRatio = Math.max(
    0,
    Math.min(1, (totalPhaseDuration - countdown + 1) / totalPhaseDuration),
  );
  const strokeDashoffset = circumference - progressRatio * circumference;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl flex flex-col justify-between">
      <div>
        {/* Header Strip with Pattern Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 mb-4 gap-2">
          <div className="flex items-center space-x-2">
            <Wind className="h-5 w-5 text-emerald-400" />
            <h3 className="font-bold text-sm text-white uppercase tracking-wider">
              Autonomic Breathing Pacer
            </h3>
          </div>

          {/* Pattern Selector Pills */}
          <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
            <button
              onClick={() => handlePatternChange("box")}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                patternKey === "box"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Box 4-4-4-4
            </button>
            <button
              onClick={() => handlePatternChange("coherent")}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                patternKey === "coherent"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Coherent 5-5
            </button>
            <button
              onClick={() => handlePatternChange("relax")}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                patternKey === "relax"
                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Relax 4-7-8
            </button>
          </div>
        </div>

        {/* Biofeedback Coherence Sync Ribbon */}
        <div className="mb-4 p-2.5 rounded-xl bg-slate-950/70 border border-cyan-900/40 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-4 w-4 text-cyan-400 animate-pulse" />
            <span className="text-slate-300 font-medium">
              Biofeedback Coherence Sync:
            </span>
            <span className="font-semibold text-emerald-400">
              {coherenceScore}% Resonance
            </span>
          </div>
          <span className="text-[11px] font-mono text-cyan-300">
            Target Pace: {targetRpm} RPM
          </span>
        </div>

        {/* Dynamic Pacer Visualizer with SVG Smooth Radial Track */}
        <div className="py-4 flex flex-col items-center justify-center">
          <div className="relative flex items-center justify-center">
            {/* Ambient Background Glow */}
            <div
              className={`h-48 w-48 rounded-full bg-gradient-to-tr ${currentPhase.color} opacity-25 filter blur-xl transition-all duration-1000 ${
                currentPhase.name === "Inhale"
                  ? "scale-125"
                  : currentPhase.name === "Exhale"
                    ? "scale-90"
                    : "scale-110"
              }`}
            />

            {/* SVG Ring Countdown Track */}
            <svg className="w-48 h-48 transform -rotate-90">
              <circle
                cx="96"
                cy="96"
                r="72"
                stroke="currentColor"
                strokeWidth="6"
                fill="transparent"
                className="text-slate-800"
              />
              <circle
                cx="96"
                cy="96"
                r="72"
                stroke="currentColor"
                strokeWidth="6"
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="text-cyan-400 transition-all duration-1000 ease-linear"
              />
            </svg>

            {/* Center Phase Card */}
            <div
              className={`absolute h-36 w-36 rounded-full border border-cyan-500/30 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center shadow-2xl transition-all duration-700 ${
                currentPhase.name === "Inhale"
                  ? "scale-105 border-cyan-400 shadow-cyan-500/30"
                  : currentPhase.name === "Exhale"
                    ? "scale-95 border-indigo-400 shadow-indigo-500/20"
                    : "scale-100 border-emerald-400/50"
              }`}
            >
              <span className="text-[11px] uppercase tracking-widest text-slate-400 font-semibold">
                {currentPhase.name}
              </span>
              <span className="text-4xl font-extrabold text-white font-mono my-0.5">
                {countdown}s
              </span>
              <span className="text-[10px] text-cyan-300 font-mono">
                {userRespirationRate
                  ? `Live: ${userRespirationRate.toFixed(1)} RPM`
                  : "Syncing"}
              </span>
            </div>
          </div>

          <p className="mt-4 text-xs text-center text-slate-200 font-medium max-w-sm">
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
                ? "border-amber-700/60 bg-amber-950/40 text-amber-300 hover:bg-amber-900/40"
                : "border-emerald-700/60 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/40"
            }`}
          >
            {isActive ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            <span>{isActive ? "Pause Pacer" : "Resume Pacer"}</span>
          </button>

          <button
            onClick={() => {
              setPhaseIndex(0);
              setCountdown(pattern.phases[0].duration);
              setCompletedCycles(0);
            }}
            className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200"
            title="Reset Pacer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center space-x-3 text-[11px] text-slate-400">
          <span className="font-mono text-cyan-400">
            Cycles: {completedCycles}
          </span>
          <span className="flex items-center space-x-1">
            <Info className="h-3.5 w-3.5 text-cyan-400" />
            <span>Vagal Stimulation</span>
          </span>
        </div>
      </div>
    </div>
  );
}
