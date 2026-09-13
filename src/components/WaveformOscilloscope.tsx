import React, { useEffect, useRef } from 'react';
import { RPPGEngine } from '../lib/rppgEngine';
import type { TriageLevel } from '../lib/types';

interface WaveformOscilloscopeProps {
  engine: RPPGEngine;
  triageLevel: TriageLevel;
  heartRate: number;
}

export const WaveformOscilloscope: React.FC<WaveformOscilloscopeProps> = ({
  engine,
  triageLevel,
  heartRate,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dataPointsRef = useRef<number[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const maxPoints = Math.floor(rect.width);
    if (dataPointsRef.current.length === 0) {
      dataPointsRef.current = new Array(maxPoints).fill(0);
    }

    const render = () => {
      const sample = engine.getWaveformSample();
      dataPointsRef.current.push(sample);
      if (dataPointsRef.current.length > maxPoints) {
        dataPointsRef.current.shift();
      }

      ctx.clearRect(0, 0, rect.width, rect.height);

      // 1. Draw Medical Oscilloscope Background Grid
      ctx.strokeStyle = '#0f2922';
      ctx.lineWidth = 0.5;
      const gridSize = 20;

      for (let x = 0; x < rect.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, rect.height);
        ctx.stroke();
      }
      for (let y = 0; y < rect.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(rect.width, y);
        ctx.stroke();
      }

      // Center baseline
      ctx.strokeStyle = '#114a38';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, rect.height / 2);
      ctx.lineTo(rect.width, rect.height / 2);
      ctx.stroke();

      // 2. Determine Waveform Color by Triage Level
      let waveColor = '#10b981';
      let glowColor = 'rgba(16, 185, 129, 0.4)';
      if (triageLevel === 'yellow') {
        waveColor = '#f59e0b';
        glowColor = 'rgba(245, 158, 11, 0.4)';
      } else if (triageLevel === 'red') {
        waveColor = '#ef4444';
        glowColor = 'rgba(239, 68, 68, 0.5)';
      }

      // 3. Draw Continuous Arterial Pulse Waveform
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 10;
      ctx.strokeStyle = waveColor;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      const points = dataPointsRef.current;
      const midY = rect.height / 2;
      const amp = rect.height * 0.35;

      for (let i = 0; i < points.length; i++) {
        const x = i;
        const y = midY - points[i] * amp;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 4. Sweeping Scanhead Cursor
      const lastX = points.length - 1;
      const lastY = midY - points[lastX] * amp;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
      ctx.fill();

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [engine, triageLevel]);

  return (
    <div className="relative w-full bg-[#07130e] border border-[#143e2e] rounded-xl overflow-hidden shadow-inner p-3">
      <div className="flex items-center justify-between text-xs font-mono text-emerald-400 mb-2 border-b border-[#143e2e] pb-1.5">
        <div className="flex items-center space-x-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="font-semibold tracking-wider">CH1: OPTICAL ARTERIAL PPG (530nm)</span>
        </div>
        <div className="flex items-center space-x-4">
          <span>SPEED: 25 mm/s</span>
          <span>GAIN: ×1.0</span>
          <span className="text-white font-bold bg-[#143e2e] px-2 py-0.5 rounded">
            PULSE: {heartRate} BPM
          </span>
        </div>
      </div>

      <div className="relative w-full h-36">
        <canvas ref={canvasRef} className="w-full h-full block" />
        <div className="absolute top-2 right-3 pointer-events-none text-right font-mono">
          <span className="text-[10px] text-emerald-500/60 block">BANDPASS: 0.75Hz - 3.3Hz</span>
          <span className="text-[10px] text-emerald-500/60 block">ZERO-CROSSING DETECTOR</span>
        </div>
      </div>
    </div>
  );
};
