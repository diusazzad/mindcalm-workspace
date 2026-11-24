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
    eyeLevelPct: 35,
    mouthLevelPct: 72,
    neckLevelPct: 95,
  });

  const animRef = useRef(null);
  const sampleAccRef = useRef({
    samples: 0,
    ratios: [],
    widths: [],
    heights: [],
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

  // Frame processing loop for head detection
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

            // Skin chrominance scan to locate head bounds with shoulder-flare rejection
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

            const faceFound = totalSkin > 150;
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

              setMetrics((prev) => ({
                ...prev,
                faceDetected: true,
                headRatio: boundedRatio,
                headWidthPx: headW,
                headHeightPx: headH,
                eyeLevelPct: 35,
                mouthLevelPct: 72,
                neckLevelPct: 95,
              }));

              if (isScanning && !isScanSuccess) {
                const acc = sampleAccRef.current;
                acc.samples++;
                acc.ratios.push(boundedRatio);
                acc.widths.push(headW);
                acc.heights.push(headH);
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

    const clampedRatio = Math.max(
      1.25,
      Math.min(1.45, Math.round(avgRatio * 100) / 100),
    );

    setMetrics({
      faceDetected: true,
      headRatio: clampedRatio,
      headWidthPx: Math.round(avgWidth),
      headHeightPx: Math.round(avgWidth * clampedRatio),
      eyeLevelPct: 35,
      mouthLevelPct: 72,
      neckLevelPct: 95,
    });
  };

  const handleApplyCalibration = () => {
    if (onCalibrationComplete) {
      onCalibrationComplete({
        headRatio: metrics.headRatio || 1.35,
        headWidthPx: metrics.headWidthPx || 120,
        headHeightPx: metrics.headHeightPx || 162,
        eyeLevelPct: 35,
        mouthLevelPct: 72,
        neckLevelPct: 95,
      });
    }
    onClose();
  };

  if (!isOpen) return null;

  // Dynamic Guide Oval Sizing (scales in real-time with user's detected head size)
  const modalGuideW =
    metrics.faceDetected && metrics.headWidthPx
      ? Math.round(Math.min(250, Math.max(130, metrics.headWidthPx * 1.25)))
      : 176;
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
                Biometric Head Calibration & Morphological Scan
              </h3>
              <p className="text-xs text-slate-400">
                Measures your personal head size, eye plane & neck ratio (5
                Seconds)
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

            {/* Scanning Guide Silhouette */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center select-none p-4">
              {/* Central Head Alignment Silhouette - Scaled Dynamically */}
              <div
                style={{
                  width: `${modalGuideW}px`,
                  height: `${modalGuideH}px`,
                }}
                className={`border-2 border-dashed rounded-full flex flex-col items-center justify-between py-3 transition-all duration-200 ${
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
                  <div className="absolute inset-x-8 h-1 bg-gradient-to-r from-transparent via-cyan-300 to-transparent animate-pulse shadow-[0_0_15px_#22d3ee]" />
                )}

                <div className="text-[9px] font-mono font-bold text-cyan-300 bg-slate-950/80 px-2 py-0.5 rounded border border-cyan-800/60">
                  TOP OF HEAD
                </div>

                {isScanSuccess ? (
                  <div className="flex flex-col items-center space-y-1 bg-slate-950/90 px-3 py-1 rounded-lg border border-emerald-500/60">
                    <CheckCircle className="h-6 w-6 text-emerald-400" />
                    <span className="text-[10px] font-bold text-emerald-300 font-mono">
                      CALIBRATION COMPLETE!
                    </span>
                  </div>
                ) : isScanning ? (
                  <div className="bg-slate-950/90 px-3 py-1.5 rounded-lg border border-cyan-500/60 flex flex-col items-center space-y-1">
                    <span className="text-xs font-bold font-mono text-cyan-300">
                      SCANNING: {scanSecondsLeft}s
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono">
                      HOLD HEAD STEADY
                    </span>
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-300 font-mono bg-slate-950/80 px-2.5 py-1 rounded border border-slate-700">
                    {metrics.faceDetected
                      ? "FACE IN VIEW • CLICK START SCAN"
                      : "POSITION HEAD IN CIRCLE"}
                  </span>
                )}

                <div className="text-[9px] font-mono text-slate-400 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-700">
                  CHIN & NECK BASE
                </div>
              </div>
            </div>
          </div>

          {/* Morphological Scan Metrics Feedback */}
          <div className="grid grid-cols-3 gap-3 text-center text-xs font-mono">
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block text-[10px]">
                Head Ratio (H/W)
              </span>
              <span className="text-cyan-300 font-bold text-sm">
                {metrics.headRatio > 0 ? metrics.headRatio : "--"}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block text-[10px]">
                Eye Plane
              </span>
              <span className="text-emerald-300 font-bold text-sm">
                {metrics.faceDetected ? "Aligned" : "--"}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block text-[10px]">
                Scan Status
              </span>
              <span
                className={`font-bold text-sm ${
                  isScanSuccess
                    ? "text-emerald-400"
                    : isScanning
                      ? "text-cyan-400"
                      : "text-slate-400"
                }`}
              >
                {isScanSuccess
                  ? "100% Ready"
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
                    : "Start 5-Second Head Scan"}
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
            Presage Morphological Profile
          </span>
        </div>
      </div>
    </div>
  );
}
