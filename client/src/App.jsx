import React, { useState, useEffect, useRef, useCallback } from "react";
import Navbar from "./components/Navbar";
import VitalsHUD from "./components/VitalsHUD";
import CameraPreviewHUD from "./components/CameraPreviewHUD";
import WaveformVisualizer from "./components/WaveformVisualizer";
import BoxBreathingPacer from "./components/BoxBreathingPacer";
import SoundscapeController from "./components/SoundscapeController";
import ConsentGateModal from "./components/ConsentGateModal";
import FaceCalibrationModal from "./components/FaceCalibrationModal";
import {
  Play,
  Square,
  RefreshCw,
  Activity,
  Scan,
  ShieldAlert,
} from "lucide-react";

function getClientSessionId() {
  try {
    let id = window.sessionStorage.getItem("mindcalm_session_id");
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      window.sessionStorage.setItem("mindcalm_session_id", id);
    }
    return id;
  } catch {
    return "default";
  }
}

export default function App() {
  const sessionIdRef = useRef(getClientSessionId());
  const [isConnected, setIsConnected] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isConsentGranted, setIsConsentGranted] = useState(false);
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);
  const [isCalibrationModalOpen, setIsCalibrationModalOpen] = useState(false);
  const [calibratedProfile, setCalibratedProfile] = useState(null);
  const [isHumanDetected, setIsHumanDetected] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [sdkMode, setSdkMode] = useState("simulation_fallback");
  const [validationHint, setValidationHint] = useState("");

  // Optical wave histories for 30Hz visualizers (120 samples)
  const [ppgHistory, setPpgHistory] = useState([]);
  const [respHistory, setRespHistory] = useState([]);

  // Physiological vitals initialized cleanly to 0
  const [vitals, setVitals] = useState({
    pulse_bpm: 0,
    pulse_confidence: 0,
    hrv_rmssd_ms: 0,
    respiration_rpm: 0,
    blink_rate_cpm: 0,
    blinks_total: 0,
    cognitive_state: "STANDBY",
    eye_strain_risk: false,
    is_talking: false,
  });

  const wsRef = useRef(null);
  const sessionTimerRef = useRef(null);
  const lastOpticalTimeRef = useRef(0);

  const apiHeaders = useCallback(
    (extra = {}) => ({
      "x-session-id": sessionIdRef.current,
      ...extra,
    }),
    [],
  );

  // Fetch initial isolated session telemetry state on mount
  useEffect(() => {
    fetch("/api/consent", { headers: apiHeaders() })
      .then((res) => res.json())
      .then((data) => {
        setIsConsentGranted(!!data.consent_granted);
        if (data.sdkMode || data.mode) {
          setSdkMode(data.sdkMode || data.mode);
        }
      })
      .catch((e) => console.error("Consent fetch error:", e));

    fetch("/api/vitals/current", { headers: apiHeaders() })
      .then((res) => res.json())
      .then((data) => {
        if (data.isActive || data.session_active) {
          setIsSessionActive(true);
        }
        if (data.sdkMode) {
          setSdkMode(data.sdkMode);
        }
      })
      .catch((e) => console.error("Initial vitals error:", e));
  }, [apiHeaders]);

  // WebSocket for Live Physiological Telemetry (per-session isolated)
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/vitals?sessionId=${encodeURIComponent(sessionIdRef.current)}`;
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

          if (v.sdkMode) {
            setSdkMode(v.sdkMode);
          }
          if (v.validationHint) {
            setValidationHint(v.validationHint);
          }

          const isOpticalActive =
            Date.now() - lastOpticalTimeRef.current < 2000;

          if (
            isSessionActive &&
            v.sdkMode === "native_smartspectra_v3.4" &&
            (v.pulseConfidence > 0 || v.respirationConfidence > 0)
          ) {
            // Native Presage SmartSpectra decoded protobuf vitals
            if (typeof d.ppgWave === "number") {
              setPpgHistory((prev) => [...prev.slice(-119), d.ppgWave]);
            }
            if (typeof d.respWave === "number") {
              setRespHistory((prev) => [...prev.slice(-119), d.respWave]);
            }
            setVitals((prev) => ({
              ...prev,
              pulse_bpm: v.pulseBpm || prev.pulse_bpm,
              pulse_confidence: v.pulseConfidence ?? prev.pulse_confidence,
              hrv_rmssd_ms: v.hrvRmssdMs ?? prev.hrv_rmssd_ms,
              respiration_rpm: v.respirationRpm || prev.respiration_rpm,
              blink_rate_cpm: v.blinkRatePerMin ?? prev.blink_rate_cpm,
              blinks_total: v.blinksTotal ?? prev.blinks_total,
              is_talking: Boolean(v.isTalking),
              cognitive_state: v.cognitiveState || prev.cognitive_state,
            }));
          } else if (isSessionActive && isHumanDetected && isOpticalActive) {
            // Sync HRV autonomic tone from backend stream when browser optical engine drives camera
            setVitals((prev) => ({
              ...prev,
              hrv_rmssd_ms: v.hrvRmssdMs ?? d.hrv_rmssd_ms ?? prev.hrv_rmssd_ms,
            }));
          }
        } else if (msg.type === "session_state") {
          setIsSessionActive(!!msg.is_running);
          if (msg.sdk_mode) {
            setSdkMode(msg.sdk_mode);
          }
        } else if (msg.type === "validation_status" && msg.data?.hint) {
          setValidationHint(msg.data.hint);
        }
      } catch (e) {
        console.error("WS parse error:", e);
      }
    };

    return () => {
      socket.close();
    };
  }, [isSessionActive, isHumanDetected]);

  // Stream downscaled RGB frames over WebSocket only when server Native SDK pipeline is active
  const handleSendFrame = useCallback(
    (rgbBase64, width, height, timestampUs) => {
      if (
        sdkMode === "native_smartspectra_v3.4" &&
        wsRef.current &&
        wsRef.current.readyState === WebSocket.OPEN
      ) {
        wsRef.current.send(
          JSON.stringify({
            type: "video_frame",
            rgbBase64,
            width,
            height,
            timestampUs,
          }),
        );
      }
    },
    [sdkMode],
  );

  // Optical Telemetry Callback from CameraPreviewHUD
  const handleOpticalTelemetry = useCallback((telemetry) => {
    if (!telemetry) return;
    lastOpticalTimeRef.current = Date.now();

    const isLockedAndAligned = Boolean(telemetry.isAligned);
    setIsHumanDetected(isLockedAndAligned);

    if (isLockedAndAligned) {
      // 1. Real optical waveforms (30Hz real-time)
      if (typeof telemetry.ppgWave === "number") {
        setPpgHistory((prev) => [...prev.slice(-119), telemetry.ppgWave]);
      }
      if (typeof telemetry.respWave === "number") {
        setRespHistory((prev) => [...prev.slice(-119), telemetry.respWave]);
      }

      // 2. Real optical vitals update
      setVitals((prev) => {
        let cognitive = prev.cognitive_state;
        if (
          telemetry.blinkRateCpm < 11 ||
          (telemetry.respirationRpm && telemetry.respirationRpm > 20)
        ) {
          cognitive = "COGNITIVE_STRAIN";
        } else if (
          telemetry.respirationRpm &&
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
          pulse_confidence: telemetry.pulseConfidence || 0,
          respiration_rpm: telemetry.respirationRpm || prev.respiration_rpm,
          blink_rate_cpm: telemetry.blinkRateCpm,
          blinks_total: telemetry.totalBlinks,
          is_talking: telemetry.isTalking,
          eye_strain_risk: telemetry.blinkRateCpm < 12,
          cognitive_state: cognitive,
        };
      });
    } else {
      // No human detected / out of frame: zero waveforms
      setPpgHistory([]);
      setRespHistory([]);
    }
  }, []);

  // Session duration timer
  useEffect(() => {
    if (isSessionActive) {
      sessionTimerRef.current = setInterval(() => {
        setSessionDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
      }
      setSessionDuration(0);
    }
    return () => {
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
      }
    };
  }, [isSessionActive]);

  const handleGrantConsent = async () => {
    try {
      const res = await fetch("/api/consent", {
        method: "POST",
        headers: apiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ granted: true }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.sdkMode || data.mode) setSdkMode(data.sdkMode || data.mode);
        setIsConsentGranted(true);
        // Prompt mandatory head & shoulder framing calibration right after granting consent
        setIsCalibrationModalOpen(true);
      }
    } catch (e) {
      console.error("Grant consent failed:", e);
    }
  };

  const handleRevokeConsent = async () => {
    try {
      await fetch("/api/consent", {
        method: "POST",
        headers: apiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ granted: false }),
      });
      setIsConsentGranted(false);
      setIsSessionActive(false);
      setIsHumanDetected(false);
      setPpgHistory([]);
      setRespHistory([]);
      setVitals({
        pulse_bpm: 0,
        pulse_confidence: 0,
        hrv_rmssd_ms: 0,
        respiration_rpm: 0,
        blink_rate_cpm: 0,
        blinks_total: 0,
        cognitive_state: "STANDBY",
        eye_strain_risk: false,
        is_talking: false,
      });
    } catch (e) {
      console.error("Revoke consent failed:", e);
    }
  };

  // Start Telemetry: Mandatory 5-Second Head & Shoulder Framing Scan
  const handleStartSession = async () => {
    if (!isConsentGranted) {
      setIsConsentModalOpen(true);
      return;
    }

    setIsCalibrationModalOpen(true);
  };

  const handleCalibrationComplete = async (profile) => {
    setCalibratedProfile(profile);
    try {
      const res = await fetch("/api/session/start", {
        method: "POST",
        headers: apiHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.mode) setSdkMode(data.mode);
        setIsSessionActive(true);
      }
    } catch (e) {
      console.error("Start session error:", e);
    }
  };

  const handleStopSession = async () => {
    try {
      const res = await fetch("/api/session/stop", {
        method: "POST",
        headers: apiHeaders(),
      });
      if (res.ok) {
        setIsSessionActive(false);
        setIsHumanDetected(false);
        setPpgHistory([]);
        setRespHistory([]);
        setVitals((prev) => ({
          ...prev,
          pulse_bpm: 0,
          pulse_confidence: 0,
          respiration_rpm: 0,
          blink_rate_cpm: 0,
          cognitive_state: "STANDBY",
        }));
      }
    } catch (e) {
      console.error("Stop session error:", e);
    }
  };

  const handleResetSession = async () => {
    try {
      await fetch("/api/session/reset", {
        method: "POST",
        headers: apiHeaders(),
      });
      setPpgHistory([]);
      setRespHistory([]);
      setIsHumanDetected(false);
      setVitals({
        pulse_bpm: 0,
        pulse_confidence: 0,
        hrv_rmssd_ms: 0,
        respiration_rpm: 0,
        blink_rate_cpm: 0,
        blinks_total: 0,
        cognitive_state: "STANDBY",
        eye_strain_risk: false,
        is_talking: false,
      });
    } catch (e) {
      console.error("Reset session error:", e);
    }
  };

  const isLiveNativeSdk = sdkMode === "native_smartspectra_v3.4";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
      <Navbar
        isConnected={isConnected}
        isSessionActive={isSessionActive}
        sessionDuration={sessionDuration}
        isConsentGranted={isConsentGranted}
        sdkMode={sdkMode}
        isHumanDetected={isHumanDetected}
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
              <h2 className="text-sm font-bold text-white flex flex-wrap items-center gap-2">
                <span>MindCalm Workspace</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${
                    isLiveNativeSdk
                      ? "bg-emerald-950/80 text-emerald-300 border-emerald-700/70"
                      : "bg-amber-950/80 text-amber-300 border-amber-700/70"
                  }`}
                >
                  {isLiveNativeSdk
                    ? "LIVE PRESAGE SDK v3.4"
                    : isSessionActive && isHumanDetected
                      ? "BROWSER OPTICAL + SIM SYNC"
                      : "DEMO / SIMULATED MODE"}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {validationHint && isSessionActive
                  ? validationHint
                  : "Contactless optical ergonomics & breathing pacer. Framing scan (5s) precedes a 15–30s signal warm-up."}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
            {isSessionActive && (
              <button
                onClick={() => setIsCalibrationModalOpen(true)}
                className="px-3 py-2 rounded-xl border border-cyan-700/60 bg-cyan-950/60 hover:bg-cyan-900/60 text-xs font-semibold text-cyan-300 flex items-center space-x-1.5 transition-colors shadow-sm"
                title="Recalibrate head, nose and shoulder framing"
              >
                <Scan className="h-4 w-4 text-cyan-400" />
                <span>Recalibrate Framing</span>
              </button>
            )}

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
                title="Perform 5s framing scan, then start 15–30s physiological signal warm-up"
              >
                <Play className="h-4 w-4" />
                <span>Start Session (15–30s Warm-up)</span>
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
        <VitalsHUD
          vitals={vitals}
          isSessionActive={isSessionActive}
          isHumanDetected={isHumanDetected}
          sdkMode={sdkMode}
        />

        {/* Center Grid: Optical Viewport (Left) & Dual-Waveform Visualizer (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-4 flex flex-col">
            <CameraPreviewHUD
              isConsentGranted={isConsentGranted}
              isSessionActive={isSessionActive}
              calibratedProfile={calibratedProfile}
              onOpenCalibration={() => setIsCalibrationModalOpen(true)}
              onOpticalTelemetry={handleOpticalTelemetry}
              onSendFrame={isLiveNativeSdk ? handleSendFrame : null}
            />
          </div>
          <div className="lg:col-span-8 flex flex-col">
            <WaveformVisualizer
              ppgHistory={ppgHistory}
              respHistory={respHistory}
              isConnected={isConnected}
              isSessionActive={isSessionActive}
              isHumanDetected={isHumanDetected}
            />
          </div>
        </div>

        {/* Lower Ergonomic Grid: Box Breathing Pacer (Left) & Adaptive Soundscape (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7 flex flex-col">
            <BoxBreathingPacer
              userRespirationRate={
                isHumanDetected && vitals.respiration_rpm > 0
                  ? vitals.respiration_rpm
                  : 14.0
              }
            />
          </div>
          <div className="lg:col-span-5 flex flex-col">
            <SoundscapeController
              stressIndex={
                vitals.cognitive_state === "COGNITIVE_STRAIN"
                  ? 80
                  : vitals.cognitive_state === "DEEP_FOCUS"
                    ? 45
                    : 20
              }
              isMuted={isMuted}
            />
          </div>
        </div>
      </main>

      {/* Always-Visible Non-Medical Ergonomic Wellness Disclaimer Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/90 py-3 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
            <span>
              <strong className="text-slate-300">
                Non-Medical Ergonomic Wellness Tool:
              </strong>{" "}
              Not a medical device. Does not provide diagnosis, treatment, or
              clinical advice.
            </span>
          </div>
          <span className="font-mono text-slate-500">
            100% Ephemeral In-RAM • enableTelemetry: false • Mode:{" "}
            {isLiveNativeSdk ? "LIVE SDK" : "DEMO/OPTICAL"}
          </span>
        </div>
      </footer>

      {/* Explicit Opt-In Consent Gate Modal */}
      <ConsentGateModal
        isOpen={isConsentModalOpen}
        onClose={() => setIsConsentModalOpen(false)}
        onGrantConsent={handleGrantConsent}
        onRevokeConsent={handleRevokeConsent}
        isConsentGranted={isConsentGranted}
      />

      {/* 5-Second Head, Nose & Shoulder Framing Calibration Modal */}
      <FaceCalibrationModal
        isOpen={isCalibrationModalOpen}
        onClose={() => setIsCalibrationModalOpen(false)}
        onCalibrationComplete={handleCalibrationComplete}
      />
    </div>
  );
}
