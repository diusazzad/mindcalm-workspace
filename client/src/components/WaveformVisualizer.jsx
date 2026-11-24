import React, { useRef, useEffect } from "react";
import { Activity, Wind } from "lucide-react";

export default function WaveformVisualizer({
  ppgHistory = [],
  respHistory = [],
  isConnected,
  isSessionActive,
  isHumanDetected = true,
}) {
  const ppgCanvasRef = useRef(null);
  const respCanvasRef = useRef(null);

  const isNoHuman = isSessionActive && !isHumanDetected;

  // Render PPG Canvas (Pulse Waveform)
  useEffect(() => {
    const canvas = ppgCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 25) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (isNoHuman) {
      ctx.fillStyle = "#f59e0b";
      ctx.font = "12px monospace";
      ctx.fillText(
        "Optical Lock Lost — No human detected in camera viewport",
        20,
        height / 2,
      );
      return;
    }

    if (!ppgHistory.length || !isConnected) {
      ctx.fillStyle = "#64748b";
      ctx.font = "12px monospace";
      ctx.fillText(
        "Awaiting 30Hz optical PPG telemetry stream...",
        20,
        height / 2,
      );
      return;
    }

    // Draw PPG line
    ctx.beginPath();
    ctx.strokeStyle = "#06b6d4"; // Cyan
    ctx.lineWidth = 2;
    ctx.shadowColor = "#06b6d4";
    ctx.shadowBlur = 8;

    const step = width / Math.max(ppgHistory.length - 1, 1);
    ppgHistory.forEach((val, idx) => {
      // Normalize val (-1 to 1) to canvas height
      const y = height / 2 - val * (height * 0.38);
      const x = idx * step;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;
  }, [ppgHistory, isConnected, isNoHuman]);

  // Render Respiration Canvas
  useEffect(() => {
    const canvas = respCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 25) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (isNoHuman) {
      ctx.fillStyle = "#f59e0b";
      ctx.font = "12px monospace";
      ctx.fillText(
        "Awaiting thoracic motion — Position face & torso in reticle",
        20,
        height / 2,
      );
      return;
    }

    if (!respHistory.length || !isConnected) {
      ctx.fillStyle = "#64748b";
      ctx.font = "12px monospace";
      ctx.fillText("Awaiting thoracic respiration wave...", 20, height / 2);
      return;
    }

    // Draw Respiration line
    ctx.beginPath();
    ctx.strokeStyle = "#10b981"; // Emerald
    ctx.lineWidth = 2.5;
    ctx.shadowColor = "#10b981";
    ctx.shadowBlur = 8;

    const step = width / Math.max(respHistory.length - 1, 1);
    respHistory.forEach((val, idx) => {
      const y = height / 2 - val * (height * 0.38);
      const x = idx * step;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;
  }, [respHistory, isConnected, isNoHuman]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <Activity className="h-5 w-5 text-cyan-400" />
          <h3 className="font-bold text-sm text-white uppercase tracking-wider">
            Live Dual-Waveform Visualizer (30Hz Telemetry)
          </h3>
        </div>
        <span className="text-xs font-mono text-slate-400">
          SmartSpectra v3.4 Engine Buffer: 120 samples
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* PPG Waveform Card */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-950 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-cyan-400 flex items-center space-x-1.5">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              <span>Photoplethysmography (PPG Pulse Wave)</span>
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              Normal Range: ±1.0
            </span>
          </div>
          <div className="w-full overflow-hidden rounded-lg bg-slate-900/70 border border-slate-800">
            <canvas
              ref={ppgCanvasRef}
              width={540}
              height={140}
              className="w-full h-[140px] block"
            />
          </div>
        </div>

        {/* Respiration Waveform Card */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-950 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-emerald-400 flex items-center space-x-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>Thoracic Expansion (Respiration Cycle)</span>
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              Inhale / Exhale Trajectory
            </span>
          </div>
          <div className="w-full overflow-hidden rounded-lg bg-slate-900/70 border border-slate-800">
            <canvas
              ref={respCanvasRef}
              width={540}
              height={140}
              className="w-full h-[140px] block"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
