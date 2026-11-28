import React from "react";
import {
  Heart,
  Activity,
  Wind,
  Eye,
  Brain,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

const STATE_CONFIG = {
  CALM_FLOW: {
    label: "Calm Flow",
    description: "Balanced autonomic pace, relaxed focus",
    badge: "bg-emerald-950/70 text-emerald-300 border-emerald-700/60",
    dot: "bg-emerald-400",
    ring: "border-emerald-500/30",
  },
  DEEP_FOCUS: {
    label: "Deep Focus",
    description: "Engaged task immersion, steady rhythm",
    badge: "bg-cyan-950/70 text-cyan-300 border-cyan-700/60",
    dot: "bg-cyan-400",
    ring: "border-cyan-500/30",
  },
  COGNITIVE_STRAIN: {
    label: "Focus Fatigue Cue",
    description: "Elevated arousal or shallow screen-breathing pattern",
    badge: "bg-amber-950/70 text-amber-300 border-amber-700/60",
    dot: "bg-amber-400",
    ring: "border-amber-500/30",
  },
  STANDBY: {
    label: "Standby (Camera Off)",
    description:
      "Click 'Start Session' to run framing calibration and optical sensing.",
    badge: "bg-slate-900 text-slate-400 border-slate-700",
    dot: "bg-slate-500",
    ring: "border-slate-700",
  },
  OUT_OF_CIRCLE: {
    label: "Framing Alert: Position Face in Guide",
    description:
      "Center your face and shoulders inside the guide overlay for optical capture.",
    badge: "bg-rose-950/80 text-rose-300 border-rose-500 animate-pulse",
    dot: "bg-rose-400",
    ring: "border-rose-500/40",
  },
};

export default function VitalsHUD({
  vitals,
  isSessionActive,
  isHumanDetected = false,
  sdkMode = "simulation_fallback",
}) {
  const isMeasuring = isSessionActive && isHumanDetected;
  const isLiveSdk = sdkMode === "native_smartspectra_v3.4";

  const pulseBpm = isMeasuring ? (vitals?.pulse_bpm ?? 0) : 0;
  const pulseConfidence = isMeasuring ? (vitals?.pulse_confidence ?? 0) : 0;
  const hrvRmssd = isMeasuring ? (vitals?.hrv_rmssd_ms ?? 0) : 0;
  const respirationRpm = isMeasuring ? (vitals?.respiration_rpm ?? 0) : 0;
  const blinkRate = isMeasuring ? (vitals?.blink_rate_cpm ?? 0) : 0;
  const blinksTotal = vitals?.blinks_total ?? vitals?.blinksTotal ?? 0;

  let cognitiveStateKey = "STANDBY";
  if (isSessionActive) {
    if (!isHumanDetected) {
      cognitiveStateKey = "OUT_OF_CIRCLE";
    } else {
      cognitiveStateKey = vitals?.cognitive_state || "CALM_FLOW";
    }
  }

  const stateMeta = STATE_CONFIG[cognitiveStateKey] || STATE_CONFIG.STANDBY;
  const isEyeStrainRisk = isMeasuring && (vitals?.eye_strain_risk ?? false);
  const isFaceTalking = isMeasuring && (vitals?.is_talking ?? false);
  const isPulseStable = isMeasuring && pulseConfidence >= 40;

  return (
    <div className="space-y-4">
      {/* Top Banner: Wellness State & Alignment Alert */}
      <div
        className={`p-4 rounded-2xl border bg-slate-900/90 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 transition-all duration-300 ${
          isSessionActive && !isHumanDetected
            ? "border-rose-500/60 shadow-rose-950/30"
            : "border-slate-800"
        }`}
      >
        <div className="flex items-center space-x-3.5 w-full md:w-auto">
          <div
            className={`h-11 w-11 rounded-xl border flex items-center justify-center flex-shrink-0 transition-colors ${
              isSessionActive && !isHumanDetected
                ? "bg-rose-950/50 border-rose-500 text-rose-400 animate-bounce"
                : isMeasuring
                  ? "bg-gradient-to-tr from-cyan-600/20 to-emerald-600/20 border-cyan-500/30 text-cyan-400"
                  : "bg-slate-800 border-slate-700 text-slate-500"
            }`}
          >
            {isSessionActive && !isHumanDetected ? (
              <AlertTriangle className="h-6 w-6" />
            ) : (
              <Brain className="h-6 w-6" />
            )}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs uppercase font-mono tracking-wider text-slate-400">
                Ergonomic State:
              </span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${stateMeta.badge} flex items-center space-x-1.5`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${stateMeta.dot} ${
                    isMeasuring ? "animate-pulse" : ""
                  }`}
                />
                <span>{stateMeta.label}</span>
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              {stateMeta.description}
            </p>
          </div>
        </div>

        {/* Alignment Indicator / Talking Indicator / Low Blink Cue */}
        <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
          {isSessionActive && !isHumanDetected ? (
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-950/70 border border-rose-500 text-rose-300 text-xs font-bold animate-pulse shadow-lg shadow-rose-900/30">
              <AlertTriangle className="h-4 w-4 text-rose-400" />
              <span>ALIGNMENT ALERT: Position Face in Guide Circle</span>
            </div>
          ) : isFaceTalking ? (
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-indigo-950/60 border border-indigo-700/50 text-indigo-300 text-xs">
              <span className="h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
              <span>Vocal Motion (Breathing Gated)</span>
            </div>
          ) : isEyeStrainRisk ? (
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-950/60 border border-amber-600/60 text-amber-300 text-xs font-medium animate-pulse">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              <span>Low Blink Rate (&lt;12/min — 20-20-20 Break Cue)</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-300 text-xs">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              <span>
                {isMeasuring
                  ? "Optical Alignment Normal"
                  : "Standby (Ready to Stream)"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 4 Core Ergonomic Biofeedback Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Pulse BPM */}
        <div
          className={`p-4 rounded-2xl bg-slate-900/90 border shadow-lg relative overflow-hidden transition-all duration-200 flex flex-col justify-between ${
            isSessionActive && !isHumanDetected
              ? "border-rose-500/50 bg-rose-950/10"
              : "border-slate-800 hover:border-rose-500/40"
          }`}
        >
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 font-mono mb-1">
              <span className="flex items-center space-x-1.5 text-rose-400">
                <Heart
                  className={`h-4 w-4 ${isMeasuring ? "animate-pulse" : "opacity-40"}`}
                />
                <span>PULSE RATE</span>
              </span>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                Conf: {pulseConfidence}%
              </span>
            </div>

            <div className="text-[10px] font-mono text-cyan-300/80 mb-1">
              Typical Resting Range: 60 – 100 BPM
            </div>

            <p className="text-[11px] text-slate-400 mb-2 font-normal leading-tight">
              (Non-medical optical pulse estimate via camera rPPG flow)
            </p>

            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold text-white tracking-tight font-mono">
                {pulseBpm}
              </span>
              <span className="text-sm font-semibold text-rose-400">BPM</span>
            </div>
          </div>

          <div className="mt-3 text-xs text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800">
            <span>
              {isLiveSdk ? "Presage SDK PPG" : "Browser Optical rPPG"}
            </span>
            <span
              className={
                isSessionActive && !isHumanDetected
                  ? "text-rose-400 font-bold"
                  : isMeasuring
                    ? isPulseStable
                      ? "text-emerald-400 font-medium"
                      : "text-amber-400 font-medium"
                    : "text-slate-500 font-medium"
              }
            >
              {isSessionActive && !isHumanDetected
                ? "Align in Circle"
                : isMeasuring
                  ? isPulseStable
                    ? "Stable"
                    : "Warming up"
                  : "Standby"}
            </span>
          </div>
        </div>

        {/* 2. HRV RMSSD */}
        <div
          className={`p-4 rounded-2xl bg-slate-900/90 border shadow-lg relative overflow-hidden transition-all duration-200 flex flex-col justify-between ${
            isSessionActive && !isHumanDetected
              ? "border-rose-500/50 bg-rose-950/10"
              : "border-slate-800 hover:border-cyan-500/40"
          }`}
        >
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 font-mono mb-1">
              <span className="flex items-center space-x-1.5 text-cyan-400">
                <Activity className="h-4 w-4" />
                <span>HEART VARIABILITY</span>
              </span>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                RMSSD
              </span>
            </div>

            <div className="text-[10px] font-mono text-cyan-300/80 mb-1">
              Reference Baseline: 35.0 – 65.0 ms
            </div>

            <p className="text-[11px] text-slate-400 mb-2 font-normal leading-tight">
              (Recovery & autonomic balance cue — higher ms reflects calmer
              tone)
            </p>

            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold text-white tracking-tight font-mono">
                {hrvRmssd.toFixed(1)}
              </span>
              <span className="text-sm font-semibold text-cyan-400">ms</span>
            </div>
          </div>

          <div className="mt-3 text-xs text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800">
            <span>{isLiveSdk ? "Presage HRV" : "Simulated Sync"}</span>
            <span
              className={
                isSessionActive && !isHumanDetected
                  ? "text-rose-400 font-bold font-mono text-[11px]"
                  : isMeasuring
                    ? "text-cyan-300 font-mono"
                    : "text-slate-500 font-mono text-[11px]"
              }
            >
              {isSessionActive && !isHumanDetected
                ? "Align in Circle"
                : isMeasuring
                  ? "Para/Symp"
                  : "Standby"}
            </span>
          </div>
        </div>

        {/* 3. Respiration RPM */}
        <div
          className={`p-4 rounded-2xl bg-slate-900/90 border shadow-lg relative overflow-hidden transition-all duration-200 flex flex-col justify-between ${
            isSessionActive && !isHumanDetected
              ? "border-rose-500/50 bg-rose-950/10"
              : "border-slate-800 hover:border-emerald-500/40"
          }`}
        >
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 font-mono mb-1">
              <span className="flex items-center space-x-1.5 text-emerald-400">
                <Wind className="h-4 w-4" />
                <span>RESPIRATION</span>
              </span>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                Thoracic
              </span>
            </div>

            <div className="text-[10px] font-mono text-cyan-300/80 mb-1">
              Relaxed Baseline: 12.0 – 18.0 RPM
            </div>

            <p className="text-[11px] text-slate-400 mb-2 font-normal leading-tight">
              (Thoracic breathing pace estimate — detects shallow screen-apnea
              habits)
            </p>

            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold text-white tracking-tight font-mono">
                {respirationRpm.toFixed(1)}
              </span>
              <span className="text-sm font-semibold text-emerald-400">
                RPM
              </span>
            </div>
          </div>

          <div className="mt-3 text-xs text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800">
            <span>Breathing Pace</span>
            <span
              className={
                isSessionActive && !isHumanDetected
                  ? "text-rose-400 font-bold"
                  : isMeasuring
                    ? "text-emerald-300 font-mono"
                    : "text-slate-500 font-mono"
              }
            >
              {isSessionActive && !isHumanDetected
                ? "Align in Circle"
                : isMeasuring
                  ? respirationRpm < 10
                    ? "Deep"
                    : "Standard"
                  : "Standby"}
            </span>
          </div>
        </div>

        {/* 4. Blink Rate & Real-Time Ocular Counter */}
        <div
          className={`p-4 rounded-2xl bg-slate-900/90 border shadow-lg relative overflow-hidden transition-all duration-200 flex flex-col justify-between ${
            isSessionActive && !isHumanDetected
              ? "border-rose-500/50 bg-rose-950/10"
              : "border-slate-800 hover:border-amber-500/40"
          }`}
        >
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

            <div className="text-[10px] font-mono text-cyan-300/80 mb-1">
              Ergonomic Target: 15 – 20 blinks/min
            </div>

            <p className="text-[11px] text-slate-400 mb-2 font-normal leading-tight">
              (Screen-break cue — rates below 12 suggest visual stare fatigue)
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
                isSessionActive && !isHumanDetected
                  ? "text-rose-400 font-bold"
                  : isMeasuring
                    ? isEyeStrainRisk
                      ? "text-amber-400 font-semibold"
                      : "text-emerald-400"
                    : "text-slate-500"
              }
            >
              {isSessionActive && !isHumanDetected
                ? "Align in Circle"
                : isMeasuring
                  ? isEyeStrainRisk
                    ? "Break Suggested"
                    : "Optimal"
                  : "Standby"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
