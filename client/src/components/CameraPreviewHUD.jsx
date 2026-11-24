import React, { useRef, useEffect, useState, useCallback } from "react";
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
} from "lucide-react";
import { OpticalEngine } from "../services/opticalEngine";

export default function CameraPreviewHUD({
  isConsentGranted,
  isSessionActive,
  calibratedProfile,
  onOpenCalibration,
  onOpticalTelemetry,
}) {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [isMutedVideo, setIsMutedVideo] = useState(false);

  // Optical HUD Visual Feedback States
  const [opticalStats, setOpticalStats] = useState({
    faceDetected: false,
    isAligned: false,
    isCalibrated: false,
    calibrationProgress: 0,
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
            // Flash on genuine blink
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

  // Dynamic custom silhouette size based on user's calibrated head ratio
  const customGuideWidth = calibratedProfile?.headWidthPx
    ? Math.min(180, Math.max(130, calibratedProfile.headWidthPx))
    : 150;
  const customGuideHeight = calibratedProfile?.headHeightPx
    ? Math.min(230, Math.max(170, calibratedProfile.headHeightPx))
    : 195;

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
          {/* Scan Head Calibration Trigger Button */}
          <button
            onClick={onOpenCalibration}
            className="flex items-center space-x-1 text-[10px] font-mono text-cyan-300 bg-cyan-950/70 border border-cyan-700/60 hover:bg-cyan-900/80 px-2 py-0.5 rounded-full transition-colors"
            title="Open 5-Second Head Scan Calibration"
          >
            <Scan className="h-3 w-3 text-cyan-400" />
            <span>{calibratedProfile ? "Recalibrate Head" : "Scan Head"}</span>
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
                    ? "HEAD & NECK LOCKED • READY TO BREATHE"
                    : "ALERT: FIT HEAD IN SCANNED GUIDE"}
                </span>
              </div>
              <span className="text-slate-400 font-mono">
                {calibratedProfile
                  ? `RATIO: ${calibratedProfile.headRatio}`
                  : "30Hz OPTICAL"}
              </span>
            </div>

            {/* Central Anatomical Target Silhouette (Head + Neck Guide) */}
            <div className="relative w-full h-full my-auto flex items-center justify-center">
              {opticalStats.isAligned ? (
                /* Aligned Head + Neck Silhouette Guide scaled to user's head */
                <div className="relative flex flex-col items-center justify-center">
                  {/* Head Oval Custom-Sized */}
                  <div
                    style={{
                      width: `${customGuideWidth}px`,
                      height: `${customGuideHeight}px`,
                    }}
                    className={`border-2 rounded-full transition-all duration-200 flex flex-col items-center justify-between py-2 bg-emerald-500/10 shadow-[0_0_25px_rgba(16,185,129,0.4)] ${
                      blinkFlash
                        ? "border-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.6)]"
                        : "border-emerald-400"
                    }`}
                  >
                    {/* Forehead rPPG Region */}
                    <div className="w-20 h-6 border border-emerald-400 bg-emerald-950/40 rounded flex items-center justify-center text-[8px] font-mono text-emerald-300 font-bold">
                      <span className="animate-pulse">FOREHEAD rPPG</span>
                    </div>

                    {/* Bilateral Eye Zone Reticle */}
                    <div className="w-32 flex justify-between items-center px-1">
                      <div
                        className={`w-11 h-5 border rounded flex items-center justify-center text-[7px] font-mono transition-all duration-150 ${
                          blinkFlash || opticalStats.isBlink
                            ? "border-amber-400 bg-amber-500/40 text-amber-200 font-bold scale-110 shadow-[0_0_10px_#f59e0b]"
                            : "border-cyan-400/70 bg-cyan-950/30 text-cyan-300"
                        }`}
                      >
                        {blinkFlash || opticalStats.isBlink ? "BLINK" : "EYE-L"}
                      </div>
                      <div
                        className={`w-11 h-5 border rounded flex items-center justify-center text-[7px] font-mono transition-all duration-150 ${
                          blinkFlash || opticalStats.isBlink
                            ? "border-amber-400 bg-amber-500/40 text-amber-200 font-bold scale-110 shadow-[0_0_10px_#f59e0b]"
                            : "border-cyan-400/70 bg-cyan-950/30 text-cyan-300"
                        }`}
                      >
                        {blinkFlash || opticalStats.isBlink ? "BLINK" : "EYE-R"}
                      </div>
                    </div>

                    {/* Mouth / Speech Motion Reticle */}
                    <div
                      className={`w-16 h-5 border rounded flex items-center justify-center text-[7px] font-mono transition-all duration-150 ${
                        opticalStats.isTalking
                          ? "border-indigo-400 bg-indigo-950/70 text-indigo-200 font-bold shadow-[0_0_10px_#818cf8]"
                          : "border-slate-500/50 bg-slate-900/40 text-slate-300"
                      }`}
                    >
                      {opticalStats.isTalking ? "MOUTH OPEN" : "MOUTH REST"}
                    </div>
                  </div>

                  {/* Neck & Clavicle Guide (ঘাড় গাইড) */}
                  <div className="w-20 h-10 -mt-2 border-x-2 border-b-2 border-emerald-400/70 bg-emerald-950/20 rounded-b-xl flex items-center justify-center">
                    <span className="text-[7px] font-mono text-emerald-300 font-semibold tracking-wider">
                      NECK / THORACIC
                    </span>
                  </div>

                  {/* Ready Cue Badge */}
                  <div className="absolute -bottom-6 bg-emerald-950/90 text-emerald-200 px-3 py-0.5 rounded-full text-[9px] font-mono border border-emerald-500/50 flex items-center space-x-1 shadow-lg">
                    <CheckCircle className="h-3 w-3 text-emerald-400" />
                    <span>READY • BREATHE WITH PACER</span>
                  </div>
                </div>
              ) : (
                /* Red Alert Silhouette Guide: Head & Neck Out of Bounds */
                <div className="relative flex flex-col items-center justify-center animate-pulse">
                  {/* Head Oval Out of Guide */}
                  <div
                    style={{
                      width: `${customGuideWidth + 10}px`,
                      height: `${customGuideHeight + 10}px`,
                    }}
                    className="border-2 border-dashed border-rose-500 bg-rose-950/30 rounded-full flex flex-col items-center justify-center p-3 shadow-[0_0_30px_rgba(244,63,94,0.6)]"
                  >
                    <AlertTriangle className="h-9 w-9 text-rose-400 mb-1.5 animate-bounce" />
                    <span className="text-[11px] text-rose-300 font-mono font-extrabold text-center tracking-wide">
                      ALIGNMENT ALERT
                    </span>
                    <span className="text-[9px] text-rose-200 font-mono text-center mt-1 bg-rose-950/90 px-2 py-0.5 rounded border border-rose-500/60 font-semibold">
                      FIT HEAD & NECK IN GUIDE
                    </span>
                  </div>

                  {/* Neck Guide Box */}
                  <div className="w-22 h-10 -mt-2 border-x-2 border-b-2 border-dashed border-rose-500/70 bg-rose-950/20 rounded-b-xl flex items-center justify-center">
                    <span className="text-[7px] font-mono text-rose-300">
                      NECK BASE
                    </span>
                  </div>
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
          Custom Morphological Mesh
        </span>
      </div>
    </div>
  );
}
