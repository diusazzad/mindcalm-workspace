import React, { useRef, useEffect, useState } from "react";
import { Camera, CameraOff, ShieldCheck, Video } from "lucide-react";

export default function CameraPreviewHUD({
  isConsentGranted,
  isSessionActive,
}) {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [isMutedVideo, setIsMutedVideo] = useState(false);

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

  // When stream changes, ensure videoRef plays immediately
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
            <span className="flex items-center space-x-1.5 text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>30 FPS LOCAL</span>
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
        {/* Keep video element in DOM so ref is always mounted */}
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
          /* HUD Optical Mesh Overlay */
          <div className="absolute inset-0 border border-cyan-500/20 rounded-xl pointer-events-none flex flex-col justify-between p-3">
            <div className="flex justify-between items-center text-[10px] font-mono text-cyan-400 bg-slate-950/70 px-2 py-0.5 rounded border border-cyan-900/50">
              <span>FACIAL ROI DETECTED</span>
              <span>PPG SAMPLING: 30Hz</span>
            </div>
            <div className="self-center w-28 h-36 border-2 border-dashed border-cyan-400/40 rounded-full animate-pulse-subtle flex items-center justify-center">
              <span className="text-[9px] text-cyan-300/60 font-mono">
                POSITION FACE
              </span>
            </div>
            <div className="text-[9px] font-mono text-slate-400 text-center bg-slate-950/70 px-2 py-0.5 rounded">
              100% Ephemeral • RAM Memory Only
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
