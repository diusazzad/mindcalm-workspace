import React from "react";
import {
  Heart,
  Activity,
  Wind,
  Eye,
  Brain,
  AlertCircle,
  ShieldAlert,
  CheckCircle,
} from "lucide-react";

const STATE_CONFIG = {
  CALM_FLOW: {
    label: "Calm Flow",
    description: "Optimal autonomic balance, relaxed focus",
    badge: "bg-emerald-950/70 text-emerald-300 border-emerald-700/60",
    dot: "bg-emerald-400",
    ring: "border-emerald-500/30",
  },
  DEEP_FOCUS: {
    label: "Deep Focus",
    description: "Engaged task immersion, stable metrics",
    badge: "bg-cyan-950/70 text-cyan-300 border-cyan-700/60",
    dot: "bg-cyan-400",
    ring: "border-cyan-500/30",
  },
  COGNITIVE_STRAIN: {
    label: "Cognitive Strain",
    description: "High sympathetic arousal, shallow respiration",
    badge: "bg-amber-950/70 text-amber-300 border-amber-700/60",
    dot: "bg-amber-400",
    ring: "border-amber-500/30",
  },
};

export default function VitalsHUD({ vitals, isSessionActive }) {
  const pulseBpm = vitals?.pulse_bpm ?? 0;
  const pulseConfidence = vitals?.pulse_confidence ?? 0;
  const hrvRmssd = vitals?.hrv_rmssd_ms ?? 0;
  const respirationRpm = vitals?.respiration_rpm ?? 0;
  const blinkRate = vitals?.blink_rate_cpm ?? 0;
  const blinksTotal = vitals?.blinks_total ?? vitals?.blinksTotal ?? 0;
  const cognitiveStateKey = vitals?.cognitive_state || "CALM_FLOW";
  const stateMeta = STATE_CONFIG[cognitiveStateKey] || STATE_CONFIG.CALM_FLOW;
  const isEyeStrainRisk = vitals?.eye_strain_risk ?? false;
  const isFaceTalking = vitals?.is_talking ?? false;

  return (
    <div className="space-y-4">
      {/* Top Banner: Cognitive State & Ergonomic Warning */}
      <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5 w-full md:w-auto">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-tr from-cyan-600/20 to-emerald-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 flex-shrink-0">
            <Brain className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs uppercase font-mono tracking-wider text-slate-400">
                Cognitive State:
              </span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${stateMeta.badge} flex items-center space-x-1.5`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${stateMeta.dot} animate-pulse`}
                />
                <span>{stateMeta.label}</span>
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              {stateMeta.description}
            </p>
          </div>
        </div>

        {/* Eye Strain Alert & Talking Indicator */}
        <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
          {isFaceTalking && (
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-indigo-950/60 border border-indigo-700/50 text-indigo-300 text-xs">
              <span className="h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
              <span>Vocal Motion (Vitals Gated)</span>
            </div>
          )}

          {isEyeStrainRisk ? (
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-950/60 border border-amber-600/60 text-amber-300 text-xs font-medium animate-pulse">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              <span>Low Blink Rate (Computer Vision Syndrome Risk)</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-300 text-xs">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              <span>Blink Dynamics Normal</span>
            </div>
          )}
        </div>
      </div>

      {/* 4 Core Physiological Telemetry Cards with Clean English Explanations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Pulse BPM */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg relative overflow-hidden group hover:border-rose-500/40 transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 font-mono mb-1">
              <span className="flex items-center space-x-1.5 text-rose-400">
                <Heart className="h-4 w-4 animate-pulse" />
                <span>PULSE RATE</span>
              </span>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                Conf: {pulseConfidence}%
              </span>
            </div>
            {/* Clean English explanatory bracket */}
            <p className="text-[11px] text-slate-400 mb-2 font-normal leading-tight">
              (Heart rate beats per minute measured via camera rPPG optical
              flow)
            </p>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold text-white tracking-tight font-mono">
                {pulseBpm > 0 ? pulseBpm : "--"}
              </span>
              <span className="text-sm font-semibold text-rose-400">BPM</span>
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800">
            <span>Presage PPG Optical</span>
            <span className="text-emerald-400 font-medium">Stable</span>
          </div>
        </div>

        {/* 2. HRV RMSSD */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg relative overflow-hidden group hover:border-cyan-500/40 transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 font-mono mb-1">
              <span className="flex items-center space-x-1.5 text-cyan-400">
                <Activity className="h-4 w-4" />
                <span>HEART VARIABILITY</span>
              </span>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                RMSSD
              </span>
            </div>
            {/* Clean English explanatory bracket */}
            <p className="text-[11px] text-slate-400 mb-2 font-normal leading-tight">
              (Autonomic tone & stress index — higher ms indicates
              parasympathetic calm)
            </p>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold text-white tracking-tight font-mono">
                {hrvRmssd > 0 ? hrvRmssd.toFixed(1) : "--"}
              </span>
              <span className="text-sm font-semibold text-cyan-400">ms</span>
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800">
            <span>Autonomic Tone</span>
            <span className="text-cyan-300 font-mono">Para/Symp</span>
          </div>
        </div>

        {/* 3. Respiration RPM */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg relative overflow-hidden group hover:border-emerald-500/40 transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 font-mono mb-1">
              <span className="flex items-center space-x-1.5 text-emerald-400">
                <Wind className="h-4 w-4" />
                <span>RESPIRATION</span>
              </span>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                Thoracic
              </span>
            </div>
            {/* Clean English explanatory bracket */}
            <p className="text-[11px] text-slate-400 mb-2 font-normal leading-tight">
              (Thoracic respiratory frequency — normal baseline is 12 to 18
              breaths/min)
            </p>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold text-white tracking-tight font-mono">
                {respirationRpm > 0 ? respirationRpm.toFixed(1) : "--"}
              </span>
              <span className="text-sm font-semibold text-emerald-400">
                RPM
              </span>
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800">
            <span>Breathing Pace</span>
            <span className="text-emerald-300 font-mono">
              {respirationRpm < 10 ? "Deep" : "Standard"}
            </span>
          </div>
        </div>

        {/* 4. Blink Rate & Real-Time Ocular Counter */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg relative overflow-hidden group hover:border-amber-500/40 transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 font-mono mb-1">
              <span className="flex items-center space-x-1.5 text-amber-400">
                <Eye className="h-4 w-4" />
                <span>BLINK DYNAMICS</span>
              </span>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                Total: {blinksTotal}
              </span>
            </div>
            {/* Clean English explanatory bracket */}
            <p className="text-[11px] text-slate-400 mb-2 font-normal leading-tight">
              (Eye hydration rate — values under 12 indicate visual fatigue &
              dry eye risk)
            </p>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold text-white tracking-tight font-mono">
                {blinkRate}
              </span>
              <span className="text-sm font-semibold text-amber-400">
                blinks/min
              </span>
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800">
            <span className="font-mono text-[11px]">
              Cumulative: {blinksTotal} blinks
            </span>
            <span
              className={
                isEyeStrainRisk
                  ? "text-amber-400 font-semibold"
                  : "text-emerald-400"
              }
            >
              {isEyeStrainRisk ? "Fatigue Detected" : "Optimal"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
