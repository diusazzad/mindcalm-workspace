import React, { useState, useEffect, useRef } from "react";
import { Volume2, VolumeX, Sparkles, Sliders, Play, Pause } from "lucide-react";

export default function SoundscapeController({ isMuted, cognitiveState }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [soundMode, setSoundMode] = useState("binaural"); // 'binaural' | 'brown' | 'rain'
  const [volume, setVolume] = useState(0.35);

  const audioCtxRef = useRef(null);
  const gainNodeRef = useRef(null);
  const osc1Ref = useRef(null);
  const osc2Ref = useRef(null);
  const noiseSourceRef = useRef(null);

  // Setup / Clean Audio Nodes
  const stopAllAudioNodes = () => {
    if (osc1Ref.current) {
      try {
        osc1Ref.current.stop();
        osc1Ref.current.disconnect();
      } catch (e) {}
      osc1Ref.current = null;
    }
    if (osc2Ref.current) {
      try {
        osc2Ref.current.stop();
        osc2Ref.current.disconnect();
      } catch (e) {}
      osc2Ref.current = null;
    }
    if (noiseSourceRef.current) {
      try {
        noiseSourceRef.current.stop();
        noiseSourceRef.current.disconnect();
      } catch (e) {}
      noiseSourceRef.current = null;
    }
  };

  // Start specific audio mode
  const startMode = (mode, ctx, masterGain) => {
    stopAllAudioNodes();

    if (mode === "binaural") {
      // Create Stereo Panner or 2 separate oscillators for Left & Right ear
      let baseFreq = 216;
      let beatDiff = 10; // Alpha 10Hz
      if (cognitiveState === "COGNITIVE_STRAIN") {
        beatDiff = 4; // Theta 4Hz
      } else if (cognitiveState === "DEEP_FOCUS") {
        beatDiff = 14; // Low-beta 14Hz
      }

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = "sine";
      osc2.type = "sine";
      osc1.frequency.setValueAtTime(baseFreq, ctx.currentTime);
      osc2.frequency.setValueAtTime(baseFreq + beatDiff, ctx.currentTime);

      const merger = ctx.createChannelMerger(2);
      osc1.connect(merger, 0, 0); // Left channel
      osc2.connect(merger, 0, 1); // Right channel
      merger.connect(masterGain);

      osc1.start();
      osc2.start();
      osc1Ref.current = osc1;
      osc2Ref.current = osc2;
    } else if (mode === "brown" || mode === "rain") {
      // 5-second looping buffer of Brownian / Pink noise
      const bufferSize = ctx.sampleRate * 4;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0.0;

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        if (mode === "brown") {
          // Brownian noise (integrated white noise)
          lastOut = (lastOut + 0.02 * white) / 1.02;
          data[i] = lastOut * 3.5;
        } else {
          // Gentle Rain (pink-filtered noise)
          const b0 = white * 0.1;
          data[i] = b0;
        }
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      // Filter to smooth soundscape
      const filter = ctx.createBiquadFilter();
      filter.type = mode === "brown" ? "lowpass" : "bandpass";
      filter.frequency.setValueAtTime(
        mode === "brown" ? 400 : 1200,
        ctx.currentTime,
      );

      noise.connect(filter);
      filter.connect(masterGain);
      noise.start();
      noiseSourceRef.current = noise;
    }
  };

  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContextClass();
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(isMuted ? 0 : volume, ctx.currentTime);
      masterGain.connect(ctx.destination);

      audioCtxRef.current = ctx;
      gainNodeRef.current = masterGain;
    }
    return { ctx: audioCtxRef.current, masterGain: gainNodeRef.current };
  };

  const handleTogglePlay = () => {
    const { ctx, masterGain } = getAudioContext();
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    if (isPlaying) {
      stopAllAudioNodes();
      setIsPlaying(false);
    } else {
      startMode(soundMode, ctx, masterGain);
      setIsPlaying(true);
    }
  };

  const handleSwitchMode = (newMode) => {
    setSoundMode(newMode);
    if (isPlaying) {
      const { ctx, masterGain } = getAudioContext();
      startMode(newMode, ctx, masterGain);
    }
  };

  // Adjust volume & mute state
  useEffect(() => {
    if (gainNodeRef.current && audioCtxRef.current) {
      const targetGain = isMuted || !isPlaying ? 0 : volume;
      gainNodeRef.current.gain.setTargetAtTime(
        targetGain,
        audioCtxRef.current.currentTime,
        0.08,
      );
    }
  }, [isMuted, volume, isPlaying]);

  // Modulate frequency based on cognitiveState dynamically
  useEffect(() => {
    if (!audioCtxRef.current || !isPlaying || soundMode !== "binaural") return;

    if (osc1Ref.current && osc2Ref.current) {
      const baseFreq = 216;
      let beatDiff = 10;
      if (cognitiveState === "COGNITIVE_STRAIN") {
        beatDiff = 4;
      } else if (cognitiveState === "DEEP_FOCUS") {
        beatDiff = 14;
      }
      osc1Ref.current.frequency.setTargetAtTime(
        baseFreq,
        audioCtxRef.current.currentTime,
        0.5,
      );
      osc2Ref.current.frequency.setTargetAtTime(
        baseFreq + beatDiff,
        audioCtxRef.current.currentTime,
        0.5,
      );
    }
  }, [cognitiveState, isPlaying, soundMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllAudioNodes();
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-cyan-400" />
            <h3 className="font-bold text-sm text-white uppercase tracking-wider">
              Adaptive Soundscape Generator
            </h3>
          </div>
          <span className="text-xs font-mono text-emerald-400">
            Web Audio API Native
          </span>
        </div>

        <p className="text-xs text-slate-300 mb-4 leading-relaxed">
          Generates synthesized neuro-acoustic frequencies modulated dynamically
          by your autonomic cognitive state.
        </p>

        {/* Play / Pause Toggle Button */}
        <div className="mb-4">
          <button
            onClick={handleTogglePlay}
            className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition-all shadow-md ${
              isPlaying
                ? "bg-rose-600/90 hover:bg-rose-500 text-white shadow-rose-600/20"
                : "bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-white shadow-cyan-500/20"
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="h-4 w-4" />
                <span>Pause Soundscape Generator</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                <span>Play Adaptive Audio Synthesis</span>
              </>
            )}
          </button>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { id: "binaural", label: "Binaural Flow" },
            { id: "brown", label: "Brownian Noise" },
            { id: "rain", label: "Gentle Rain" },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => handleSwitchMode(mode.id)}
              className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                soundMode === mode.id
                  ? "bg-cyan-950/60 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-500/10"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {/* Volume Slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-slate-400">
            <span className="flex items-center space-x-1">
              <Sliders className="h-3.5 w-3.5" />
              <span>Ambient Volume</span>
            </span>
            <span className="font-mono text-slate-200">
              {Math.round(volume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <span>Modulation Target:</span>
        <span className="font-mono text-cyan-300">
          {cognitiveState === "COGNITIVE_STRAIN"
            ? "Theta 4Hz (De-stress)"
            : "Alpha 10Hz (Flow)"}
        </span>
      </div>
    </div>
  );
}
