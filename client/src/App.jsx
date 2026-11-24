import React, { useState, useEffect, useRef, useCallback } from "react";
import Navbar from "./components/Navbar";
import ConsentGateModal from "./components/ConsentGateModal";
import VitalsHUD from "./components/VitalsHUD";
import CameraPreviewHUD from "./components/CameraPreviewHUD";
import WaveformVisualizer from "./components/WaveformVisualizer";
import BoxBreathingPacer from "./components/BoxBreathingPacer";
import SoundscapeController from "./components/SoundscapeController";
import {
  ShieldCheck,
  Video,
  Play,
  Square,
  RefreshCw,
  Cpu,
  Activity,
} from "lucide-react";

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [isConsentGranted, setIsConsentGranted] = useState(false);
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Vitals State
  const [vitals, setVitals] = useState({
    pulse_bpm: 72,
    pulse_confidence: 88,
    hrv_rmssd_ms: 45.2,
    respiration_rpm: 14.5,
    blink_rate_cpm: 18,
    blinks_total: 0,
    cognitive_state: "CALM_FLOW",
    eye_strain_risk: false,
    is_talking: false,
  });

  // Waveform Buffers (120 points)
  const [ppgHistory, setPpgHistory] = useState([]);
  const [respHistory, setRespHistory] = useState([]);

  const wsRef = useRef(null);
  const lastOpticalTimeRef = useRef(0);

  // Check consent status on mount
  useEffect(() => {
    fetch("/api/consent")
      .then((res) => res.json())
      .then((data) => {
        const granted = !!(data.consent_granted ?? data.consentGranted);
        setIsConsentGranted(granted);
        if (!granted) {
          setIsConsentModalOpen(true);
        }
      })
      .catch((err) => console.warn("Consent fetch error:", err));
  }, []);

  // Session duration timer
  useEffect(() => {
    let timer = null;
    if (isSessionActive) {
      timer = setInterval(() => {
        setSessionDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setSessionDuration(0);
    }
    return () => clearInterval(timer);
  }, [isSessionActive]);

  // Connect to 30Hz WebSocket
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/vitals`;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
    };

    socket.onclose = () => {
      setIsConnected(false);
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "vitals" && msg.data) {
          const d = msg.data;
          const v = d.vitals || {};

          // Check if camera optical processing is currently actively supplying live metrics
          const isOpticalActive =
            Date.now() - lastOpticalTimeRef.current < 1500;

          if (!isOpticalActive) {
            // Fallback to server simulation if camera is idle, off, or muted
            const ppgVal = d.ppgWave ?? d.ppg_wave;
            const respVal = d.respWave ?? d.resp_wave;

            if (typeof ppgVal === "number") {
              setPpgHistory((prev) => [...prev.slice(-119), ppgVal]);
            }
            if (typeof respVal === "number") {
              setRespHistory((prev) => [...prev.slice(-119), respVal]);
            }

            setVitals((prev) => ({
              ...prev,
              pulse_bpm: v.pulseBpm ?? d.pulse_bpm ?? prev.pulse_bpm,
              pulse_confidence:
                v.pulseConfidence ??
                d.pulse_confidence ??
                prev.pulse_confidence,
              hrv_rmssd_ms: v.hrvRmssdMs ?? d.hrv_rmssd_ms ?? prev.hrv_rmssd_ms,
              respiration_rpm:
                v.respirationRpm ?? d.respiration_rpm ?? prev.respiration_rpm,
              blink_rate_cpm:
                v.blinkRatePerMin ?? d.blink_rate_cpm ?? prev.blink_rate_cpm,
              blinks_total:
                v.blinksTotal ?? d.blinks_total ?? prev.blinks_total ?? 0,
              cognitive_state:
                v.cognitiveState ?? d.cognitive_state ?? prev.cognitive_state,
              eye_strain_risk:
                v.eyeStrainRisk ?? d.eye_strain_risk ?? prev.eye_strain_risk,
              is_talking: v.isTalking ?? d.is_talking ?? prev.is_talking,
            }));
          } else {
            // When optical is active, sync server autonomic tone (HRV) without overriding optical signals
            setVitals((prev) => ({
              ...prev,
              hrv_rmssd_ms: v.hrvRmssdMs ?? d.hrv_rmssd_ms ?? prev.hrv_rmssd_ms,
            }));
          }
        } else if (msg.type === "session_state") {
          setIsSessionActive(!!msg.is_running);
        }
      } catch (e) {
        console.error("WS parse error:", e);
      }
    };

    return () => {
      socket.close();
    };
  }, []);

  // Optical Telemetry Callback from CameraPreviewHUD
  const handleOpticalTelemetry = useCallback((telemetry) => {
    if (!telemetry || !telemetry.faceDetected) return;
    lastOpticalTimeRef.current = Date.now();

    // Real optical waveform streams
    if (typeof telemetry.ppgWave === "number") {
      setPpgHistory((prev) => [...prev.slice(-119), telemetry.ppgWave]);
    }
    if (typeof telemetry.respWave === "number") {
      setRespHistory((prev) => [...prev.slice(-119), telemetry.respWave]);
    }

    // Real optical vitals update
    setVitals((prev) => {
      let cognitive = prev.cognitive_state;
      if (telemetry.blinkRateCpm < 11 || telemetry.respirationRpm > 20) {
        cognitive = "COGNITIVE_STRAIN";
      } else if (
        telemetry.respirationRpm <= 15 &&
        telemetry.blinkRateCpm >= 14
      ) {
        cognitive = "CALM_FLOW";
      } else {
        cognitive = "DEEP_FOCUS";
      }

      return {
        ...prev,
        pulse_bpm: telemetry.pulseBpm || prev.pulse_bpm,
        pulse_confidence: telemetry.pulseConfidence || 88,
        respiration_rpm: telemetry.respirationRpm || prev.respiration_rpm,
        blink_rate_cpm: telemetry.blinkRateCpm,
        blinks_total: telemetry.totalBlinks,
        is_talking: telemetry.isTalking,
        eye_strain_risk: telemetry.blinkRateCpm < 12,
        cognitive_state: cognitive,
      };
    });
  }, []);

  const handleGrantConsent = async () => {
    try {
      await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ granted: true }),
      });
      setIsConsentGranted(true);
    } catch (e) {
      console.error("Grant consent failed:", e);
    }
  };

  const handleRevokeConsent = async () => {
    try {
      await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ granted: false }),
      });
      setIsConsentGranted(false);
      setIsSessionActive(false);
    } catch (e) {
      console.error("Revoke consent failed:", e);
    }
  };

  const handleStartSession = async () => {
    if (!isConsentGranted) {
      setIsConsentModalOpen(true);
      return;
    }
    try {
      const res = await fetch("/api/session/start", { method: "POST" });
      if (res.ok) {
        setIsSessionActive(true);
      }
    } catch (e) {
      console.error("Start session error:", e);
    }
  };

  const handleStopSession = async () => {
    try {
      const res = await fetch("/api/session/stop", { method: "POST" });
      if (res.ok) {
        setIsSessionActive(false);
      }
    } catch (e) {
      console.error("Stop session error:", e);
    }
  };

  const handleResetSession = async () => {
    try {
      await fetch("/api/session/reset", { method: "POST" });
      setPpgHistory([]);
      setRespHistory([]);
      setVitals((prev) => ({
        ...prev,
        blinks_total: 0,
        blink_rate_cpm: 16,
      }));
    } catch (e) {
      console.error("Reset session error:", e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
      <Navbar
        isConnected={isConnected}
        isSessionActive={isSessionActive}
        sessionDuration={sessionDuration}
        isConsentGranted={isConsentGranted}
        onOpenConsent={() => setIsConsentModalOpen(true)}
        onResetSession={handleResetSession}
        isMuted={isMuted}
        onToggleMute={() => setIsMuted(!isMuted)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Session Control Strip */}
        <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div
              className={`p-2.5 rounded-xl border flex items-center justify-center ${
                isSessionActive
                  ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-400 animate-pulse"
                  : "bg-slate-800 border-slate-700 text-slate-400"
              }`}
            >
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                MindCalm Workspace Active
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-mono">
                  Presage v3.4 SDK
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time optical biofeedback & autonomic pacing for developers
                and screen professionals.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
            {isSessionActive ? (
              <button
                onClick={handleStopSession}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white shadow-lg shadow-rose-600/20 flex items-center space-x-1.5 transition-colors"
              >
                <Square className="h-4 w-4" />
                <span>Pause Session</span>
              </button>
            ) : (
              <button
                onClick={handleStartSession}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-xs font-semibold text-white shadow-lg shadow-cyan-500/20 flex items-center space-x-1.5 transition-all"
              >
                <Play className="h-4 w-4" />
                <span>Start Telemetry</span>
              </button>
            )}

            <button
              onClick={handleResetSession}
              className="p-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Reset All Buffers"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Real-time Physiological Vitals Cards */}
        <VitalsHUD vitals={vitals} isSessionActive={isSessionActive} />

        {/* Center Grid: SmartSpectra Optical Viewport (Left) & Dual-Waveform Visualizer (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-4 flex flex-col">
            <CameraPreviewHUD
              isConsentGranted={isConsentGranted}
              isSessionActive={isSessionActive}
              onOpticalTelemetry={handleOpticalTelemetry}
            />
          </div>
          <div className="lg:col-span-8 flex flex-col">
            <WaveformVisualizer
              ppgHistory={ppgHistory}
              respHistory={respHistory}
              isConnected={isConnected}
            />
          </div>
        </div>

        {/* Lower Ergonomic Grid: Box Breathing Pacer (Left) & Adaptive Soundscape (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7 flex flex-col">
            <BoxBreathingPacer userRespirationRate={vitals.respiration_rpm} />
          </div>
          <div className="lg:col-span-5 flex flex-col">
            <SoundscapeController
              isMuted={isMuted}
              cognitiveState={vitals.cognitive_state}
            />
          </div>
        </div>

        {/* Challenge Footer Banner */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-3">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400 flex-shrink-0" />
            <span>
              Presage SmartSpectra SDK Challenge 2026 • 100% Ephemeral in-memory
              optical processing
            </span>
          </div>
          <span className="font-mono text-slate-400">
            Strictly non-clinical ergonomic biofeedback
          </span>
        </div>
      </main>

      {/* Mandatory Consent Gate Modal */}
      <ConsentGateModal
        isOpen={isConsentModalOpen}
        onClose={() => setIsConsentModalOpen(false)}
        onGrantConsent={handleGrantConsent}
        onRevokeConsent={handleRevokeConsent}
        isConsentGranted={isConsentGranted}
      />
    </div>
  );
}
