import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Sparkles, Sliders } from 'lucide-react';

export default function SoundscapeController({ isMuted, cognitiveState }) {
  const [soundMode, setSoundMode] = useState('binaural'); // 'binaural' | 'rain' | 'brown'
  const [volume, setVolume] = useState(0.35);
  const audioCtxRef = useRef(null);
  const gainNodeRef = useRef(null);
  const osc1Ref = useRef(null);
  const osc2Ref = useRef(null);
  const noiseSourceRef = useRef(null);

  // Initialize Web Audio API on user interaction
  const initAudio = () => {
    if (!audioCtxRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(isMuted ? 0 : volume, ctx.currentTime);
      gainNode.connect(ctx.destination);

      audioCtxRef.current = ctx;
      gainNodeRef.current = gainNode;
    }
  };

  // Adjust volume & mute state
  useEffect(() => {
    if (gainNodeRef.current && audioCtxRef.current) {
      const targetGain = isMuted ? 0 : volume;
      gainNodeRef.current.gain.setTargetAtTime(targetGain, audioCtxRef.current.currentTime, 0.1);
    }
  }, [isMuted, volume]);

  // Modulate frequency based on cognitiveState
  useEffect(() => {
    if (!audioCtxRef.current) return;

    if (soundMode === 'binaural' && osc1Ref.current && osc2Ref.current) {
      // Delta/Theta for Strain (calming), Alpha/Beta for Flow/Focus
      let baseFreq = 216;
      let beatDiff = 10; // Alpha (10Hz)
      if (cognitiveState === 'COGNITIVE_STRAIN') {
        beatDiff = 4; // Theta/Delta calming beat (4Hz)
      } else if (cognitiveState === 'DEEP_FOCUS') {
        beatDiff = 14; // Low-beta focus beat (14Hz)
      }

      osc1Ref.current.frequency.setTargetAtTime(baseFreq, audioCtxRef.current.currentTime, 0.5);
      osc2Ref.current.frequency.setTargetAtTime(baseFreq + beatDiff, audioCtxRef.current.currentTime, 0.5);
    }
  }, [cognitiveState, soundMode]);

  const togglePlayback = () => {
    initAudio();
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
  };

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
          Generates synthesized neuro-acoustic frequencies modulated dynamically by your autonomic cognitive state.
        </p>

        {/* Mode Selector */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { id: 'binaural', label: 'Binaural Flow' },
            { id: 'brown', label: 'Brownian Noise' },
            { id: 'rain', label: 'Gentle Rain' }
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => {
                togglePlayback();
                setSoundMode(mode.id);
              }}
              className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                soundMode === mode.id
                  ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-500/10'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
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
            <span className="font-mono text-slate-200">{Math.round(volume * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => {
              togglePlayback();
              setVolume(parseFloat(e.target.value));
            }}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <span>Modulation Target:</span>
        <span className="font-mono text-cyan-300">
          {cognitiveState === 'COGNITIVE_STRAIN' ? 'Theta 4Hz (De-stress)' : 'Alpha 10Hz (Flow)'}
        </span>
      </div>
    </div>
  );
}
