import React, { useRef, useEffect, useState } from "react";
import {
  Camera,
  CameraOff,
  ShieldCheck,
  Eye,
  Activity,
  Wind,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  Scan,
  Target,
} from "lucide-react";
import { OpticalEngine } from "../services/opticalEngine";

export default function CameraPreviewHUD({
  isConsentGranted,
  isSessionActive,
  calibratedProfile,
  onOpenCalibration,
  onOpticalTelemetry,
  onSendFrame = null,
}) {
  const videoRef = useRef(null);
  const frameCanvasRef = useRef(null);
  const lastWsFrameRef = useRef(0);
  const [stream, setStream] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [isMutedVideo, setIsMutedVideo] = useState(false);

  // Optical HUD Visual Feedback States
  const [opticalStats, setOpticalStats] = useState({
    faceDetected: false,
    isAligned: false,
    isCalibrated: false,
    calibrationProgress: 0,
    faceBox: null,
    rois: null,
    isBlink: false,
    justBlinked: false,
    totalBlinks: 0,
    blinkRateCpm: 0,
    pulseBpm: 0,
    respirationRpm: 0,
    isTalking: false,
    respPhase: "Standby",
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
        isAligned: false,
        isCalibrated: false,
        calibrationProgress: 0,
        faceBox: null,
        rois: null,
        isBlink: false,
        justBlinked: false,
        totalBlinks: 0,
        blinkRateCpm: 0,
        pulseBpm: 0,
        respirationRpm: 0,
        isTalking: false,
        respPhase: "Standby",
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
            if (telemetry.justBlinked) {
              setBlinkFlash(true);
              setTimeout(() => setBlinkFlash(false), 220);
            }

            const respPhase = !telemetry.isAligned
              ? "Standby"
              : telemetry.respWave > 0.15
                ? "Inhale (Rising)"
                : telemetry.respWave < -0.15
                  ? "Exhale (Falling)"
                  : "Hold / Neutral";

            setOpticalStats({
              faceDetected: telemetry.faceDetected,
              isAligned: telemetry.isAligned,
              isCalibrated: telemetry.isCalibrated,
              calibrationProgress: telemetry.calibrationProgress,
              faceBox: telemetry.rois?.face || null,
              rois: telemetry.rois || null,
              isBlink: telemetry.isBlink,
              justBlinked: telemetry.justBlinked,
              totalBlinks: telemetry.totalBlinks,
              blinkRateCpm: telemetry.isAligned ? telemetry.blinkRateCpm : 0,
              pulseBpm: telemetry.isAligned ? telemetry.pulseBpm : 0,
              respirationRpm: telemetry.isAligned
                ? telemetry.respirationRpm
                : 0,
              isTalking: telemetry.isAligned && telemetry.isTalking,
              respPhase,
            });

            if (onOpticalTelemetry) {
              onOpticalTelemetry(telemetry);
            }
          }

          // Stream downscaled 160x120 RGB frame (~10Hz) when Native SDK custom-input mode is active
          if (
            onSendFrame &&
            videoRef.current.readyState >= 2 &&
            timestamp - lastWsFrameRef.current >= 100
          ) {
            lastWsFrameRef.current = timestamp;
            try {
              if (!frameCanvasRef.current) {
                frameCanvasRef.current = document.createElement("canvas");
                frameCanvasRef.current.width = 160;
                frameCanvasRef.current.height = 120;
              }
              const fCtx = frameCanvasRef.current.getContext("2d", {
                willReadFrequently: true,
              });
              fCtx.drawImage(videoRef.current, 0, 0, 160, 120);
              const rgba = fCtx.getImageData(0, 0, 160, 120).data;
              const rgb = new Uint8Array(160 * 120 * 3);
              for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
                rgb[j] = rgba[i];
                rgb[j + 1] = rgba[i + 1];
                rgb[j + 2] = rgba[i + 2];
              }
              let bin = "";
              for (let i = 0; i < rgb.length; i++) {
                bin += String.fromCharCode(rgb[i]);
              }
              onSendFrame(
                btoa(bin),
                160,
                120,
                Math.round(performance.now() * 1000),
              );
            } catch {
              // Ignore frame serialization errors
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
  }, [isSessionActive, stream, isMutedVideo, onOpticalTelemetry, onSendFrame]);

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

  // Dynamic face scaling based on live camera detection and user's calibrated profile
  const currentRatio =
    calibratedProfile?.headRatio ||
    (opticalStats.faceBox
      ? Math.round((opticalStats.faceBox.h / opticalStats.faceBox.w) * 100) /
        100
      : 1.35);

  const baseWidth = opticalStats.faceBox?.w
    ? opticalStats.faceBox.w * 1.15
    : calibratedProfile?.headWidthPx
      ? calibratedProfile.headWidthPx * 1.15
      : 145;

  const customGuideWidth = Math.round(Math.min(210, Math.max(115, baseWidth)));
  const customGuideHeight = Math.round(
    customGuideWidth * Math.max(1.22, Math.min(1.45, currentRatio)),
  );

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-xl flex flex-col justify-between">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
        <div className="flex items-center space-x-2">
          <Camera className="h-4 w-4 text-cyan-400" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-white">
            Optical Framing Viewport
          </h3>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={onOpenCalibration}
            className="flex items-center space-x-1 text-[10px] font-mono text-cyan-300 bg-cyan-950/70 border border-cyan-700/60 hover:bg-cyan-900/80 px-2 py-0.5 rounded-full transition-colors"
            title="Open 5-Second Head & Shoulder Framing Calibration"
          >
            <Scan className="h-3 w-3 text-cyan-400" />
            <span>
              {calibratedProfile ? "Recalibrate Framing" : "Framing Scan"}
            </span>
          </button>

          {stream && (
            <span
              className={`flex items-center space-x-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                opticalStats.isAligned
                  ? "text-emerald-400 bg-emerald-950/60 border-emerald-800/60"
                  : "text-rose-400 bg-rose-950/70 border-rose-700/60 animate-pulse"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  opticalStats.isAligned
                    ? "bg-emerald-400 animate-pulse"
                    : "bg-rose-400"
                }`}
              />
              <span>{opticalStats.isAligned ? "LOCKED" : "ALIGN ALERT"}</span>
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
          <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2 select-none">
            {/* Top Status Bar */}
            <div
              className={`flex justify-between items-center text-[10px] font-mono backdrop-blur-sm px-2.5 py-1 rounded-lg border shadow-lg transition-colors duration-200 ${
                opticalStats.isAligned
                  ? "bg-slate-950/80 border-emerald-600/60"
                  : "bg-rose-950/80 border-rose-500/80 shadow-rose-950/50"
              }`}
            >
              <div className="flex items-center space-x-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${
                    opticalStats.isAligned
                      ? "bg-emerald-400 animate-ping"
                      : "bg-rose-400 animate-bounce"
                  }`}
                />
                <span
                  className={`font-semibold ${
                    opticalStats.isAligned
                      ? "text-emerald-300 font-bold"
                      : "text-rose-300 font-bold"
                  }`}
                >
                  {opticalStats.isAligned
                    ? "HEAD, NOSE & SHOULDERS LOCKED • READY"
                    : "ALERT: FIT HEAD, NOSE & SHOULDERS IN GUIDE"}
                </span>
              </div>
              <span className="text-slate-400 font-mono">
                {calibratedProfile
                  ? `RATIO: ${calibratedProfile.headRatio}`
                  : opticalStats.faceBox
                    ? `RATIO: ${Math.round((opticalStats.faceBox.h / opticalStats.faceBox.w) * 100) / 100}`
                    : "30Hz OPTICAL"}
              </span>
            </div>

            {/* Central Anatomical Target Silhouette */}
            <div className="relative w-full h-full my-auto flex flex-col items-center justify-end pb-0">
              {opticalStats.isAligned ? (
                <div className="relative w-full flex flex-col items-center justify-end">
                  <div
                    style={{
                      width: `${customGuideWidth}px`,
                      height: `${customGuideHeight}px`,
                    }}
                    className={`relative border-2 rounded-full transition-all duration-200 bg-emerald-500/10 shadow-[0_0_25px_rgba(16,185,129,0.4)] ${
                      blinkFlash
                        ? "border-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.6)]"
                        : "border-emerald-400"
                    }`}
                  >
                    {/* 1. Forehead rPPG Region */}
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-5 border border-emerald-400 bg-emerald-950/70 rounded flex items-center justify-center text-[7.5px] font-mono text-emerald-300 font-bold z-10">
                      <span className="animate-pulse">FOREHEAD rPPG</span>
                    </div>

                    {/* 2. Bilateral Eye Symbols Reticle (46%) */}
                    <div className="absolute top-[46%] left-0 right-0 -translate-y-1/2 flex justify-between px-2.5 z-10">
                      <div
                        className={`flex items-center space-x-1 px-1.5 py-0.5 border rounded-full text-[7.5px] font-mono transition-all duration-150 ${
                          blinkFlash || opticalStats.isBlink
                            ? "border-amber-400 bg-amber-500/50 text-amber-200 font-bold scale-110 shadow-[0_0_12px_#f59e0b]"
                            : "border-cyan-400/90 bg-cyan-950/70 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.4)]"
                        }`}
                      >
                        <Eye
                          className={`h-3 w-3 ${
                            blinkFlash || opticalStats.isBlink
                              ? "text-amber-300 animate-pulse"
                              : "text-cyan-400"
                          }`}
                        />
                        <span>
                          {blinkFlash || opticalStats.isBlink
                            ? "BLINK"
                            : "EYE-L"}
                        </span>
                      </div>

                      <div
                        className={`flex items-center space-x-1 px-1.5 py-0.5 border rounded-full text-[7.5px] font-mono transition-all duration-150 ${
                          blinkFlash || opticalStats.isBlink
                            ? "border-amber-400 bg-amber-500/50 text-amber-200 font-bold scale-110 shadow-[0_0_12px_#f59e0b]"
                            : "border-cyan-400/90 bg-cyan-950/70 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.4)]"
                        }`}
                      >
                        <Eye
                          className={`h-3 w-3 ${
                            blinkFlash || opticalStats.isBlink
                              ? "text-amber-300 animate-pulse"
                              : "text-cyan-400"
                          }`}
                        />
                        <span>
                          {blinkFlash || opticalStats.isBlink
                            ? "BLINK"
                            : "EYE-R"}
                        </span>
                      </div>
                    </div>

                    {/* 3. Precision Nose Airflow Marker (64%) */}
                    <div className="absolute top-[64%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center z-10">
                      <div className="w-5 h-5 border border-cyan-400 rounded-full flex items-center justify-center bg-cyan-950/80 shadow-[0_0_8px_rgba(6,182,212,0.6)]">
                        <Target
                          className="h-3.5 w-3.5 text-cyan-300 animate-spin"
                          style={{ animationDuration: "8s" }}
                        />
                      </div>
                      <span className="text-[6.5px] font-mono text-cyan-300 bg-slate-950/90 px-1 py-0.2 rounded border border-cyan-700/60 mt-0.5 font-bold whitespace-nowrap">
                        NOSE / AIRFLOW
                      </span>
                    </div>

                    {/* 4. Mouth / Speech Motion Reticle (80%) */}
                    <div className="absolute top-[80%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 whitespace-nowrap">
                      <div
                        className={`px-2 py-0.5 border rounded text-[7px] font-mono transition-all duration-150 ${
                          opticalStats.isTalking
                            ? "border-indigo-400 bg-indigo-950/80 text-indigo-200 font-bold shadow-[0_0_10px_#818cf8]"
                            : "border-slate-500/50 bg-slate-900/60 text-slate-300"
                        }`}
                      >
                        {opticalStats.isTalking ? "MOUTH OPEN" : "MOUTH REST"}
                      </div>
                    </div>
                  </div>

                  {/* Neck / Clavicle Guide */}
                  <div
                    style={{
                      width: `${Math.round(customGuideWidth * 0.48)}px`,
                    }}
                    className="h-6 -mt-1.5 border-x-2 border-b-2 border-emerald-400/70 bg-emerald-950/20 rounded-b-xl flex items-center justify-center z-10"
                  >
                    <span className="text-[6.5px] font-mono text-emerald-300 font-semibold tracking-wider">
                      NECK / CLAVICLE
                    </span>
                  </div>

                  {/* Natural Sloping Trapezius Shoulders */}
                  <div className="w-full relative -mt-3 pointer-events-none z-0 px-1">
                    <svg
                      className="w-full h-12 overflow-visible"
                      viewBox="0 0 320 48"
                      preserveAspectRatio="none"
                    >
                      <path
                        d="M 125 4 C 100 8, 45 22, 0 38"
                        fill="none"
                        stroke="rgba(16, 185, 129, 0.85)"
                        strokeWidth="2.5"
                      />
                      <path
                        d="M 195 4 C 220 8, 275 22, 320 38"
                        fill="none"
                        stroke="rgba(16, 185, 129, 0.85)"
                        strokeWidth="2.5"
                      />
                    </svg>

                    <div className="absolute left-2 bottom-2 bg-slate-950/90 text-emerald-300 text-[7px] font-mono font-bold px-2 py-0.5 rounded border border-emerald-500/60 shadow-md">
                      SHOULDER-L
                    </div>
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-1 bg-emerald-950/80 text-emerald-300 text-[6.5px] font-mono font-bold px-2 py-0.5 rounded border border-emerald-600/60">
                      THORACIC
                    </div>
                    <div className="absolute right-2 bottom-2 bg-slate-950/90 text-emerald-300 text-[7px] font-mono font-bold px-2 py-0.5 rounded border border-emerald-500/60 shadow-md">
                      SHOULDER-R
                    </div>
                  </div>

                  <div className="mt-1 bg-emerald-950/90 text-emerald-200 px-3 py-0.5 rounded-full text-[9px] font-mono border border-emerald-500/50 flex items-center space-x-1 shadow-lg">
                    <CheckCircle className="h-3 w-3 text-emerald-400" />
                    <span>LOCKED • BREATHE WITH PACER</span>
                  </div>
                </div>
              ) : (
                <div className="relative w-full flex flex-col items-center justify-end animate-pulse">
                  <div
                    style={{
                      width: `${customGuideWidth + 10}px`,
                      height: `${customGuideHeight + 10}px`,
                    }}
                    className="relative border-2 border-dashed border-rose-500 bg-rose-950/30 rounded-full flex flex-col items-center justify-center p-3 shadow-[0_0_30px_rgba(244,63,94,0.6)]"
                  >
                    <AlertTriangle className="h-8 w-8 text-rose-400 mb-1 animate-bounce" />
                    <span className="text-[11px] text-rose-300 font-mono font-extrabold text-center tracking-wide">
                      ALIGNMENT ALERT
                    </span>
                    <span className="text-[8.5px] text-rose-200 font-mono text-center mt-1 bg-rose-950/90 px-2 py-0.5 rounded border border-rose-500/60 font-semibold">
                      FIT HEAD, NOSE & SHOULDERS IN GUIDE
                    </span>
                  </div>

                  <div
                    style={{
                      width: `${Math.round((customGuideWidth + 10) * 0.48)}px`,
                    }}
                    className="h-6 -mt-1.5 border-x-2 border-b-2 border-dashed border-rose-500/70 bg-rose-950/20 rounded-b-xl flex items-center justify-center"
                  >
                    <span className="text-[6.5px] font-mono text-rose-300">
                      NECK BASE
                    </span>
                  </div>

                  <div className="w-full relative -mt-3 pointer-events-none px-1">
                    <svg
                      className="w-full h-12 overflow-visible"
                      viewBox="0 0 320 48"
                      preserveAspectRatio="none"
                    >
                      <path
                        d="M 125 4 C 100 8, 45 22, 0 38"
                        fill="none"
                        stroke="rgba(244, 63, 94, 0.8)"
                        strokeWidth="2.5"
                        strokeDasharray="5 3"
                      />
                      <path
                        d="M 195 4 C 220 8, 275 22, 320 38"
                        fill="none"
                        stroke="rgba(244, 63, 94, 0.8)"
                        strokeWidth="2.5"
                        strokeDasharray="5 3"
                      />
                    </svg>
                    <div className="absolute left-2 bottom-2 bg-slate-950/90 text-rose-300 text-[7px] font-mono font-bold px-2 py-0.5 rounded border border-rose-500/60">
                      SHOULDER-L
                    </div>
                    <div className="absolute right-2 bottom-2 bg-slate-950/90 text-rose-300 text-[7px] font-mono font-bold px-2 py-0.5 rounded border border-rose-500/60">
                      SHOULDER-R
                    </div>
                  </div>
                </div>
              )}

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
                  {opticalStats.isAligned
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
                  {opticalStats.isAligned && opticalStats.pulseBpm
                    ? `${opticalStats.pulseBpm} BPM`
                    : "0 BPM"}
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
                  ? "Camera Standby (Click Start Session)"
                  : "Camera Preview Muted"}
            </p>
            <p className="text-[11px] text-slate-400 max-w-[200px] mx-auto">
              {cameraError ||
                "Optical signals stream only when consent is granted and a session starts."}
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
          Optical Face & Shoulder Framing Guide
        </span>
      </div>
    </div>
  );
}
