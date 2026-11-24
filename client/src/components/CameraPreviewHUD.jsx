import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  Camera,
  CameraOff,
  ShieldCheck,
  Eye,
  Activity,
  Wind,
  Sparkles,
  UserX,
  CheckCircle,
} from "lucide-react";
import { OpticalEngine } from "../services/opticalEngine";

export default function CameraPreviewHUD({
  isConsentGranted,
  isSessionActive,
  onOpticalTelemetry,
}) {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [isMutedVideo, setIsMutedVideo] = useState(false);

  // Optical HUD Visual Feedback States
  const [opticalStats, setOpticalStats] = useState({
    faceDetected: false,
    isBlink: false,
    justBlinked: false,
    totalBlinks: 0,
    blinkRateCpm: 16,
    pulseBpm: null,
    respirationRpm: null,
    isTalking: false,
    respPhase: "Awaiting",
  });

  const [blinkFlash, setBlinkFlash] = useState(false);
  const engineRef = useRef(null);
  const animFrameRef = useRef(null);

  // Initialize Optical Engine
  useEffect(() => {
    engineRef.current = new OpticalEngine();
    return () => {
      if (engineRef.current) {
        engineRef.current.reset();
      }
    };
  }, []);

  // Reset engine counters when session is stopped/reset
  useEffect(() => {
    if (!isSessionActive && engineRef.current) {
      engineRef.current.reset();
      setOpticalStats({
        faceDetected: false,
        isBlink: false,
        justBlinked: false,
        totalBlinks: 0,
        blinkRateCpm: 16,
        pulseBpm: null,
        respirationRpm: null,
        isTalking: false,
        respPhase: "Awaiting",
      });
    }
  }, [isSessionActive]);

  // Optical Processing Loop (30Hz requestAnimationFrame)
  useEffect(() => {
    if (!isSessionActive || !stream || isMutedVideo) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }

    let lastTick = 0;
    const processLoop = (timestamp) => {
      // Throttle to ~30 FPS (33ms) to maintain smooth telemetry
      if (timestamp - lastTick >= 30) {
        lastTick = timestamp;

        if (videoRef.current && engineRef.current) {
          const telemetry = engineRef.current.processFrame(videoRef.current);

          if (telemetry) {
            // Flash on genuine blink
            if (telemetry.justBlinked) {
              setBlinkFlash(true);
              setTimeout(() => setBlinkFlash(false), 220);
            }

            const respPhase = !telemetry.faceDetected
              ? "Awaiting Torso"
              : telemetry.respWave > 0.15
                ? "Inhale (Rising)"
                : telemetry.respWave < -0.15
                  ? "Exhale (Falling)"
                  : "Hold / Neutral";

            setOpticalStats({
              faceDetected: telemetry.faceDetected,
              isBlink: telemetry.isBlink,
              justBlinked: telemetry.justBlinked,
              totalBlinks: telemetry.totalBlinks,
              blinkRateCpm: telemetry.blinkRateCpm,
              pulseBpm: telemetry.pulseBpm,
              respirationRpm: telemetry.respirationRpm,
              isTalking: telemetry.isTalking,
              respPhase,
            });

            // Stream live telemetry up to App.jsx for waveforms & vitals cards
            if (onOpticalTelemetry) {
              onOpticalTelemetry(telemetry);
            }
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(processLoop);
    };

    animFrameRef.current = requestAnimationFrame(processLoop);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [isSessionActive, stream, isMutedVideo, onOpticalTelemetry]);

  // Webcam stream management
  useEffect(() => {
    let activeStream = null;

    if (isConsentGranted && isSessionActive && !isMutedVideo) {
      navigator.mediaDevices
        ?.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user",
          },
          audio: false,
        })
        .then((mediaStream) => {
          activeStream = mediaStream;
          setStream(mediaStream);
          setCameraError(null);
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
            videoRef.current.onloadedmetadata = () => {
              videoRef.current
                .play()
                .catch((e) => console.warn("Video play error:", e));
            };
          }
        })
        .catch((err) => {
          console.warn("Webcam access error:", err.message);
          setCameraError(err.message || "Camera permission denied");
        });
    } else {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isConsentGranted, isSessionActive, isMutedVideo]);

  // Stream play safety
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch((e) => console.warn("Play error:", e));
    }
  }, [stream]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-xl flex flex-col justify-between">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
        <div className="flex items-center space-x-2">
          <Camera className="h-4 w-4 text-cyan-400" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-white">
            SmartSpectra Optical Viewport
          </h3>
        </div>
        <div className="flex items-center space-x-2">
          {stream && (
            <span
              className={`flex items-center space-x-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                opticalStats.faceDetected
                  ? "text-emerald-400 bg-emerald-950/60 border-emerald-800/60"
                  : "text-amber-400 bg-amber-950/60 border-amber-800/60"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  opticalStats.faceDetected
                    ? "bg-emerald-400 animate-pulse"
                    : "bg-amber-400"
                }`}
              />
              <span>
                {opticalStats.faceDetected ? "30 FPS LOCAL" : "SEEKING SUBJECT"}
              </span>
            </span>
          )}
          {isSessionActive && (
            <button
              onClick={() => setIsMutedVideo(!isMutedVideo)}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
              title={
                isMutedVideo ? "Enable Camera Preview" : "Mute Camera Preview"
              }
            >
              {isMutedVideo ? (
                <CameraOff className="h-3.5 w-3.5" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Video Box */}
      <div className="relative aspect-[4/3] w-full rounded-xl bg-slate-950 border border-slate-800/80 overflow-hidden flex items-center justify-center">
        {/* Mirror video for natural reflection */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transform -scale-x-100 ${
            stream && !isMutedVideo ? "block" : "hidden"
          }`}
        />

        {stream && !isMutedVideo ? (
          /* HUD Interactive Optical Vision Mesh Overlay */
          <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 select-none">
            {/* Top Status Bar */}
            <div
              className={`flex justify-between items-center text-[10px] font-mono backdrop-blur-sm px-2.5 py-1 rounded-lg border shadow-lg transition-colors duration-200 ${
                opticalStats.faceDetected
                  ? "bg-slate-950/80 border-cyan-900/60"
                  : "bg-amber-950/70 border-amber-600/70"
              }`}
            >
              <div className="flex items-center space-x-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${
                    opticalStats.faceDetected
                      ? "bg-emerald-400 animate-ping"
                      : "bg-amber-400 animate-pulse"
                  }`}
                />
                <span
                  className={`font-semibold ${
                    opticalStats.faceDetected
                      ? "text-cyan-300"
                      : "text-amber-300 font-bold"
                  }`}
                >
                  {opticalStats.faceDetected
                    ? "FACE LOCKED • 30Hz rPPG"
                    : "NO HUMAN DETECTED"}
                </span>
              </div>
              <span className="text-slate-400">
                {opticalStats.faceDetected
                  ? "rPPG GREEN 30Hz"
                  : "POSITION FACE IN VIEWPORT"}
              </span>
            </div>

            {/* Central Anatomical Target Reticles */}
            <div className="relative w-full h-full my-auto flex items-center justify-center">
              {opticalStats.faceDetected ? (
                /* Locked Human Reticle with Anatomical Zones */
                <div
                  className={`w-36 h-48 border-2 border-dashed rounded-full transition-colors duration-200 flex flex-col items-center justify-between py-2 ${
                    blinkFlash
                      ? "border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.5)]"
                      : "border-cyan-400/50 shadow-[0_0_12px_rgba(6,182,212,0.2)]"
                  }`}
                >
                  {/* 1. Forehead rPPG Region */}
                  <div className="w-16 h-6 border border-emerald-400/70 bg-emerald-950/30 rounded flex items-center justify-center text-[8px] font-mono text-emerald-300">
                    <span className="animate-pulse">FOREHEAD rPPG</span>
                  </div>

                  {/* 2. Eye Zone Reticle with Real Blink Flash Indicator */}
                  <div className="w-28 flex justify-between items-center px-1">
                    <div
                      className={`w-10 h-5 border rounded flex items-center justify-center text-[7px] font-mono transition-all duration-150 ${
                        blinkFlash || opticalStats.isBlink
                          ? "border-amber-400 bg-amber-500/40 text-amber-200 font-bold scale-110 shadow-[0_0_10px_#f59e0b]"
                          : "border-cyan-400/60 bg-cyan-950/20 text-cyan-300"
                      }`}
                    >
                      {blinkFlash || opticalStats.isBlink ? "BLINK" : "EYE-L"}
                    </div>
                    <div
                      className={`w-10 h-5 border rounded flex items-center justify-center text-[7px] font-mono transition-all duration-150 ${
                        blinkFlash || opticalStats.isBlink
                          ? "border-amber-400 bg-amber-500/40 text-amber-200 font-bold scale-110 shadow-[0_0_10px_#f59e0b]"
                          : "border-cyan-400/60 bg-cyan-950/20 text-cyan-300"
                      }`}
                    >
                      {blinkFlash || opticalStats.isBlink ? "BLINK" : "EYE-R"}
                    </div>
                  </div>

                  {/* 3. Mouth / Speech Motion Reticle */}
                  <div
                    className={`w-14 h-5 border rounded flex items-center justify-center text-[7px] font-mono transition-all duration-150 ${
                      opticalStats.isTalking
                        ? "border-indigo-400 bg-indigo-950/60 text-indigo-200 font-bold shadow-[0_0_10px_#818cf8]"
                        : "border-slate-500/40 bg-slate-900/30 text-slate-400"
                    }`}
                  >
                    {opticalStats.isTalking ? "MOUTH OPEN" : "MOUTH REST"}
                  </div>
                </div>
              ) : (
                /* No Human Detected - Seeking Target Animation */
                <div className="w-40 h-52 border-2 border-dashed border-amber-500/50 rounded-full flex flex-col items-center justify-center p-3 animate-pulse bg-amber-950/10">
                  <UserX className="h-8 w-8 text-amber-400 mb-2 opacity-80" />
                  <span className="text-[10px] text-amber-300 font-mono font-bold text-center">
                    NO HUMAN DETECTED
                  </span>
                  <span className="text-[8px] text-amber-200/70 font-mono text-center mt-1">
                    POSITION FACE HERE
                  </span>
                </div>
              )}

              {/* Real Blink Flash Screen Toast */}
              {blinkFlash && (
                <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-amber-500/90 text-slate-950 px-3 py-1 rounded-full text-[10px] font-extrabold font-mono shadow-lg flex items-center space-x-1 animate-bounce">
                  <Sparkles className="h-3 w-3 text-slate-950" />
                  <span>BLINK REGISTERED! (#{opticalStats.totalBlinks})</span>
                </div>
              )}
            </div>

            {/* Bottom Optical HUD Metrics Strip */}
            <div className="flex justify-between items-center text-[9px] font-mono bg-slate-950/85 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-slate-800 text-slate-300">
              <span className="flex items-center space-x-1 text-amber-300">
                <Eye className="h-3 w-3 text-amber-400" />
                <span>
                  Blinks: {opticalStats.totalBlinks}{" "}
                  {opticalStats.faceDetected
                    ? `(${opticalStats.blinkRateCpm}/m)`
                    : "(Paused)"}
                </span>
              </span>
              <span className="flex items-center space-x-1 text-emerald-300">
                <Wind className="h-3 w-3 text-emerald-400" />
                <span>{opticalStats.respPhase}</span>
              </span>
              <span className="flex items-center space-x-1 text-cyan-300">
                <Activity className="h-3 w-3 text-cyan-400" />
                <span>
                  rPPG:{" "}
                  {opticalStats.faceDetected && opticalStats.pulseBpm
                    ? `${opticalStats.pulseBpm} BPM`
                    : "--"}
                </span>
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center p-6 space-y-2">
            <div className="h-10 w-10 mx-auto rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
              <CameraOff className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold text-slate-300">
              {!isConsentGranted
                ? "Camera Locked (Consent Required)"
                : !isSessionActive
                  ? "Camera Standby (Click Start Telemetry)"
                  : "Camera Preview Muted"}
            </p>
            <p className="text-[11px] text-slate-400 max-w-[200px] mx-auto">
              {cameraError ||
                "Optical signals will stream only when telemetry session is started."}
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 text-[10px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800">
        <span className="flex items-center space-x-1">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          <span>Zero Video Recording Guarantee</span>
        </span>
        <span className="text-cyan-400 font-mono">
          rPPG Photoplethysmography
        </span>
      </div>
    </div>
  );
}
