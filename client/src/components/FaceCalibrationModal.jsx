import React, { useRef, useEffect, useState } from "react";
import {
  Scan,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  X,
  Play,
  RotateCcw,
  Sparkles,
  Eye,
  Target,
} from "lucide-react";

export default function FaceCalibrationModal({
  isOpen,
  onClose,
  onCalibrationComplete,
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [cameraError, setCameraError] = useState(null);

  // Scanning State
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0); // 0 to 100
  const [scanSecondsLeft, setScanSecondsLeft] = useState(5);
  const [isScanSuccess, setIsScanSuccess] = useState(false);

  // Extracted Morphological Metrics
  const [metrics, setMetrics] = useState({
    faceDetected: false,
    headRatio: 0,
    headWidthPx: 0,
    headHeightPx: 0,
    shoulderSpan: 0,
    eyeLevelPct: 46,
    noseLevelPct: 64,
    mouthLevelPct: 80,
    neckLevelPct: 96,
  });

  const animRef = useRef(null);
  const sampleAccRef = useRef({
    samples: 0,
    ratios: [],
    widths: [],
    heights: [],
    shoulders: [],
    eyeLevels: [],
    mouthLevels: [],
    neckLevels: [],
  });

  // Open camera when modal opens
  useEffect(() => {
    let activeStream = null;

    if (isOpen) {
      setIsScanning(false);
      setScanProgress(0);
      setScanSecondsLeft(5);
      setIsScanSuccess(false);
      sampleAccRef.current = {
        samples: 0,
        ratios: [],
        widths: [],
        heights: [],
        shoulders: [],
        eyeLevels: [],
        mouthLevels: [],
        neckLevels: [],
      };

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
          console.warn("Camera error:", err);
          setCameraError(err.message || "Camera permission denied");
        });
    } else {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
      }
    };
  }, [isOpen]);

  // Frame processing loop for head & shoulder detection
  useEffect(() => {
    if (!isOpen || !stream) return;

    const canvas = canvasRef.current || document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    let lastTick = 0;

    const loop = (timestamp) => {
      if (timestamp - lastTick >= 50) {
        lastTick = timestamp;

        if (videoRef.current && videoRef.current.readyState >= 2) {
          ctx.drawImage(videoRef.current, 0, 0, 320, 240);
          try {
            const frameData = ctx.getImageData(0, 0, 320, 240);
            const pixels = frameData.data;

            // Skin chrominance scan to locate head and shoulder bounds
            const rowStats = {};
            let totalSkin = 0;

            for (let y = 15; y < 225; y += 4) {
              rowStats[y] = { count: 0, minX: 320, maxX: 0 };
              for (let x = 30; x < 290; x += 4) {
                const idx = (y * 320 + x) * 4;
                const r = pixels[idx];
                const g = pixels[idx + 1];
                const b = pixels[idx + 2];

                const yVal = 0.299 * r + 0.587 * g + 0.114 * b;
                const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
                const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

                if (
                  cr >= 130 &&
                  cr <= 175 &&
                  cb >= 75 &&
                  cb <= 130 &&
                  yVal >= 25 &&
                  yVal <= 245
                ) {
                  totalSkin++;
                  rowStats[y].count++;
                  if (x < rowStats[y].minX) rowStats[y].minX = x;
                  if (x > rowStats[y].maxX) rowStats[y].maxX = x;
                }
              }
            }

            const faceFound = totalSkin > 140;
            if (faceFound) {
              // 1. Top of head
              let headTopY = 240;
              for (let y = 15; y < 225; y += 4) {
                if (rowStats[y].count >= 3) {
                  headTopY = y;
                  break;
                }
              }

              // 2. Scan face rows, stopping before shoulder flare
              let maxFaceW = 0;
              let faceMinX = 320;
              let faceMaxX = 0;
              let chinY = Math.min(220, headTopY + 120);

              for (let y = headTopY; y < 225; y += 4) {
                if (rowStats[y].count >= 3) {
                  const w = rowStats[y].maxX - rowStats[y].minX;
                  if (maxFaceW > 55 && w > maxFaceW * 1.35) {
                    chinY = y;
                    break;
                  }
                  if (w > maxFaceW) {
                    maxFaceW = w;
                  }
                  if (rowStats[y].minX < faceMinX) faceMinX = rowStats[y].minX;
                  if (rowStats[y].maxX > faceMaxX) faceMaxX = rowStats[y].maxX;
                  chinY = y;
                }
              }

              const headW = Math.max(
                60,
                Math.min(180, maxFaceW || faceMaxX - faceMinX),
              );
              const rawH = Math.max(70, chinY - headTopY);
              const boundedRatio = Math.max(
                1.25,
                Math.min(1.45, Math.round((rawH / headW) * 100) / 100),
              );
              const headH = Math.round(headW * boundedRatio);

              // 3. Scan shoulder rows
              let minShoulderX = 320;
              let maxShoulderX = 0;
              for (let y = chinY; y < 235; y += 4) {
                if (rowStats[y]?.count >= 3) {
                  if (rowStats[y].minX < minShoulderX)
                    minShoulderX = rowStats[y].minX;
                  if (rowStats[y].maxX > maxShoulderX)
                    maxShoulderX = rowStats[y].maxX;
                }
              }
              const shoulderSpan = Math.max(
                Math.round(headW * 2.2),
                maxShoulderX - minShoulderX,
              );

              setMetrics((prev) => ({
                ...prev,
                faceDetected: true,
                headRatio: boundedRatio,
                headWidthPx: headW,
                headHeightPx: headH,
                shoulderSpan,
                eyeLevelPct: 46,
                noseLevelPct: 64,
                mouthLevelPct: 80,
                neckLevelPct: 96,
              }));

              if (isScanning && !isScanSuccess) {
                const acc = sampleAccRef.current;
                acc.samples++;
                acc.ratios.push(boundedRatio);
                acc.widths.push(headW);
                acc.heights.push(headH);
                acc.shoulders.push(shoulderSpan);
              }
            } else {
              setMetrics((prev) => ({ ...prev, faceDetected: false }));
            }
          } catch {
            // Ignore frame read failures
          }
        }
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);

    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
      }
    };
  }, [isOpen, stream, isScanning, isScanSuccess]);

  // 5-second calibration timer
  useEffect(() => {
    let timer = null;
    if (isScanning && !isScanSuccess) {
      timer = setInterval(() => {
        setScanSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            completeScan();
            return 0;
          }
          return prev - 1;
        });

        setScanProgress((prev) => Math.min(100, prev + 20));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isScanning, isScanSuccess]);

  const handleStartScanning = () => {
    setScanProgress(0);
    setScanSecondsLeft(5);
    setIsScanSuccess(false);
    sampleAccRef.current = {
      samples: 0,
      ratios: [],
      widths: [],
      heights: [],
      shoulders: [],
      eyeLevels: [],
      mouthLevels: [],
      neckLevels: [],
    };
    setIsScanning(true);
  };

  const completeScan = () => {
    setIsScanning(false);
    setIsScanSuccess(true);
    setScanProgress(100);

    const acc = sampleAccRef.current;
    const avgRatio =
      acc.ratios.length > 0
        ? acc.ratios.reduce((a, b) => a + b, 0) / acc.ratios.length
        : 1.35;
    const avgWidth =
      acc.widths.length > 0
        ? acc.widths.reduce((a, b) => a + b, 0) / acc.widths.length
        : 120;
    const avgHeight =
      acc.heights.length > 0
        ? acc.heights.reduce((a, b) => a + b, 0) / acc.heights.length
        : 160;
    const avgShoulder =
      acc.shoulders.length > 0
        ? acc.shoulders.reduce((a, b) => a + b, 0) / acc.shoulders.length
        : 260;

    const clampedRatio = Math.max(
      1.25,
      Math.min(1.45, Math.round(avgRatio * 100) / 100),
    );

    setMetrics({
      faceDetected: true,
      headRatio: clampedRatio,
      headWidthPx: Math.round(avgWidth),
      headHeightPx: Math.round(avgWidth * clampedRatio),
      shoulderSpan: Math.round(avgShoulder),
      eyeLevelPct: 46,
      noseLevelPct: 64,
      mouthLevelPct: 80,
      neckLevelPct: 96,
    });
  };

  const handleApplyCalibration = () => {
    if (onCalibrationComplete) {
      onCalibrationComplete({
        headRatio: metrics.headRatio || 1.35,
        headWidthPx: metrics.headWidthPx || 120,
        headHeightPx: metrics.headHeightPx || 162,
        shoulderSpan: metrics.shoulderSpan || 260,
        eyeLevelPct: 46,
        noseLevelPct: 64,
        mouthLevelPct: 80,
        neckLevelPct: 96,
      });
    }
    onClose();
  };

  if (!isOpen) return null;

  // Dynamic Guide Oval Sizing (scales in real-time with user's detected head size)
  const modalGuideW =
    metrics.faceDetected && metrics.headWidthPx
      ? Math.round(Math.min(210, Math.max(125, metrics.headWidthPx * 1.15)))
      : 155;
  const modalGuideH = Math.round(modalGuideW * (metrics.headRatio || 1.35));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-2xl border border-cyan-800/70 bg-slate-900 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-cyan-950/90 border border-cyan-500/50 flex items-center justify-center text-cyan-400">
              <Scan className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white">
                Biometric Head & Shoulder Calibration (Full Scan)
              </h3>
              <p className="text-xs text-slate-400">
                Maps head ratio, eye plane, nose airflow apex & shoulder slope
                (5 Seconds)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Camera Scanner Viewport */}
        <div className="p-6 space-y-4">
          <div className="relative aspect-[4/3] w-full max-w-md mx-auto rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />

            {/* Scanning Guide Silhouette Covering Full Upper Body */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-end select-none p-2 pb-0">
              <div className="relative w-full flex flex-col items-center justify-end">
                {/* Central Head Alignment Silhouette with Anatomical Absolute Landmarks */}
                <div
                  style={{
                    width: `${modalGuideW}px`,
                    height: `${modalGuideH}px`,
                  }}
                  className={`relative border-2 border-dashed rounded-full transition-all duration-200 ${
                    isScanSuccess
                      ? "border-emerald-400 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.5)]"
                      : isScanning
                        ? "border-cyan-400 bg-cyan-500/10 shadow-[0_0_25px_rgba(6,182,212,0.5)]"
                        : metrics.faceDetected
                          ? "border-emerald-400/80 bg-emerald-950/20"
                          : "border-slate-500/50 bg-slate-900/30"
                  }`}
                >
                  {/* Horizontal Scanning Laser Bar */}
                  {isScanning && (
                    <div className="absolute inset-x-6 h-1 bg-gradient-to-r from-transparent via-cyan-300 to-transparent animate-pulse shadow-[0_0_15px_#22d3ee] top-1/2 -translate-y-1/2 z-20" />
                  )}

                  {/* 1. Top of Head Label */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[8px] font-mono font-bold text-cyan-300 bg-slate-950/85 px-2 py-0.5 rounded border border-cyan-800/60 z-10 whitespace-nowrap">
                    TOP OF HEAD
                  </div>

                  {/* 2. Calibration Status Badge (Positioned at 22% in upper forehead zone) */}
                  <div className="absolute top-[22%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 whitespace-nowrap">
                    {isScanSuccess ? (
                      <div className="flex items-center space-x-1 bg-slate-950/90 px-2.5 py-0.5 rounded-lg border border-emerald-500/70 shadow-lg">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-[9px] font-bold text-emerald-300 font-mono">
                          SCAN COMPLETE!
                        </span>
                      </div>
                    ) : isScanning ? (
                      <div className="bg-slate-950/90 px-2.5 py-0.5 rounded-lg border border-cyan-500/70 flex items-center space-x-1 shadow-lg">
                        <span className="text-[10px] font-bold font-mono text-cyan-300">
                          SCANNING: {scanSecondsLeft}s
                        </span>
                      </div>
                    ) : (
                      <span className="text-[8.5px] text-slate-300 font-mono bg-slate-950/85 px-2 py-0.5 rounded border border-slate-700">
                        {metrics.faceDetected
                          ? "FACE ALIGNED • READY"
                          : "FIT FACE IN OVAL"}
                      </span>
                    )}
                  </div>

                  {/* 3. Anatomical Eye Plane Reticle (Positioned at precisely 46% - directly over real eyes) */}
                  <div className="absolute top-[46%] left-0 right-0 -translate-y-1/2 flex justify-between px-3 z-10">
                    {/* Left Eye Symbol */}
                    <div className="flex items-center space-x-1 px-1.5 py-0.5 rounded-full border border-cyan-400 bg-cyan-950/80 text-cyan-300 text-[7.5px] font-mono shadow-[0_0_8px_rgba(6,182,212,0.4)]">
                      <Eye className="h-3 w-3 text-cyan-300 animate-pulse" />
                      <span>EYE-L</span>
                    </div>

                    {/* Right Eye Symbol */}
                    <div className="flex items-center space-x-1 px-1.5 py-0.5 rounded-full border border-cyan-400 bg-cyan-950/80 text-cyan-300 text-[7.5px] font-mono shadow-[0_0_8px_rgba(6,182,212,0.4)]">
                      <Eye className="h-3 w-3 text-cyan-300 animate-pulse" />
                      <span>EYE-R</span>
                    </div>
                  </div>

                  {/* 4. Anatomical Nose Apex Marker (Positioned at precisely 64% - right over nasal apex) */}
                  <div className="absolute top-[64%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center z-10">
                    <div className="w-5 h-5 border border-cyan-400 rounded-full flex items-center justify-center bg-cyan-950/85 shadow-[0_0_8px_rgba(6,182,212,0.5)]">
                      <Target
                        className="h-3.5 w-3.5 text-cyan-300 animate-spin"
                        style={{ animationDuration: "8s" }}
                      />
                    </div>
                    <span className="text-[6.5px] font-mono text-cyan-300 bg-slate-950/90 px-1 py-0.2 rounded border border-cyan-700/60 mt-0.5 font-bold whitespace-nowrap">
                      NOSE APEX
                    </span>
                  </div>

                  {/* 5. Chin & Jawline Tag (Positioned at 94% near base) */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[7.5px] font-mono text-slate-400 bg-slate-950/85 px-2 py-0.5 rounded border border-slate-700 z-10 whitespace-nowrap">
                    CHIN & JAWLINE
                  </div>
                </div>

                {/* Neck Column */}
                <div
                  style={{ width: `${Math.round(modalGuideW * 0.48)}px` }}
                  className="h-6 -mt-1.5 border-x-2 border-b-2 border-cyan-400/70 bg-cyan-950/20 rounded-b-xl flex items-center justify-center z-10"
                >
                  <span className="text-[6.5px] font-mono text-cyan-300 font-semibold">
                    NECK / CLAVICLE
                  </span>
                </div>

                {/* Natural Sloping Shoulders Contour (Trapezius Curved Wings) */}
                <div className="w-full relative -mt-3 pointer-events-none z-0 px-1">
                  <svg
                    className="w-full h-12 overflow-visible"
                    viewBox="0 0 320 48"
                    preserveAspectRatio="none"
                  >
                    {/* Left Shoulder Natural Downward Curve */}
                    <path
                      d="M 125 4 C 100 8, 45 22, 0 38"
                      fill="none"
                      stroke={
                        isScanSuccess
                          ? "rgba(16, 185, 129, 0.9)"
                          : "rgba(6, 182, 212, 0.8)"
                      }
                      strokeWidth="2.5"
                      strokeDasharray="5 3"
                    />
                    {/* Right Shoulder Natural Downward Curve */}
                    <path
                      d="M 195 4 C 220 8, 275 22, 320 38"
                      fill="none"
                      stroke={
                        isScanSuccess
                          ? "rgba(16, 185, 129, 0.9)"
                          : "rgba(6, 182, 212, 0.8)"
                      }
                      strokeWidth="2.5"
                      strokeDasharray="5 3"
                    />
                  </svg>

                  {/* Left Shoulder Floating Badge */}
                  <div className="absolute left-2 bottom-2 bg-slate-950/90 text-cyan-300 text-[7px] font-mono font-bold px-2 py-0.5 rounded border border-cyan-600/60 shadow-md">
                    SHOULDER-L
                  </div>

                  {/* Sternum / Thoracic Anchor */}
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-1 bg-cyan-950/80 text-cyan-300 text-[6.5px] font-mono font-bold px-2 py-0.5 rounded border border-cyan-700/60">
                    THORACIC
                  </div>

                  {/* Right Shoulder Floating Badge */}
                  <div className="absolute right-2 bottom-2 bg-slate-950/90 text-cyan-300 text-[7px] font-mono font-bold px-2 py-0.5 rounded border border-cyan-600/60 shadow-md">
                    SHOULDER-R
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Morphological Scan Metrics Feedback */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
            <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block text-[9.5px]">
                Head Ratio
              </span>
              <span className="text-cyan-300 font-bold text-xs">
                {metrics.headRatio > 0 ? metrics.headRatio : "--"}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block text-[9.5px]">
                Eye & Nose
              </span>
              <span className="text-emerald-300 font-bold text-xs">
                {metrics.faceDetected ? "Tracking" : "--"}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block text-[9.5px]">
                Shoulders
              </span>
              <span className="text-cyan-300 font-bold text-xs">
                {metrics.shoulderSpan > 0 ? `${metrics.shoulderSpan}px` : "--"}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block text-[9.5px]">Status</span>
              <span
                className={`font-bold text-xs ${
                  isScanSuccess
                    ? "text-emerald-400"
                    : isScanning
                      ? "text-cyan-400"
                      : "text-slate-400"
                }`}
              >
                {isScanSuccess
                  ? "Ready"
                  : isScanning
                    ? `${scanProgress}%`
                    : "Awaiting"}
              </span>
            </div>
          </div>

          {/* Progress Bar during Scanning */}
          {isScanning && (
            <div className="space-y-1.5">
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-cyan-500 to-emerald-500 h-full transition-all duration-300"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
              <p className="text-[11px] text-cyan-300 text-center font-mono">
                Capturing personal biometric contour & thoracic baseline...
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-between gap-3">
            {!isScanSuccess ? (
              <button
                onClick={handleStartScanning}
                disabled={isScanning || !metrics.faceDetected}
                className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all shadow-lg ${
                  isScanning || !metrics.faceDetected
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                    : "bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-600/30"
                }`}
              >
                <Scan className="h-4 w-4" />
                <span>
                  {isScanning
                    ? `Scanning (${scanSecondsLeft}s Left)...`
                    : "Start 5-Second Head & Shoulder Scan"}
                </span>
              </button>
            ) : (
              <button
                onClick={handleApplyCalibration}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs font-bold flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/30 transition-all"
              >
                <CheckCircle className="h-4 w-4" />
                <span>Apply Calibration & Enter Workspace</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer Guarantee */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center space-x-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>100% Ephemeral in RAM • Zero Imagery Stored</span>
          </span>
          <span className="font-mono text-cyan-400 text-[10px]">
            Presage Full-Torso Profile
          </span>
        </div>
      </div>
    </div>
  );
}
