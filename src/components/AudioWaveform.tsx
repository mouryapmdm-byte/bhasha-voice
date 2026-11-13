import React, { useEffect, useRef } from 'react';

interface AudioWaveformProps {
  isPlaying: boolean;
  audioElement?: HTMLAudioElement | null;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({ isPlaying, audioElement }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  useEffect(() => {
    if (isPlaying && audioElement && canvasRef.current) {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 256;
        }
        
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume();
        }

        if (!sourceRef.current) {
          // Check if it's already connected to an AudioContext
          try {
            sourceRef.current = audioContextRef.current.createMediaElementSource(audioElement);
            sourceRef.current.connect(analyserRef.current);
            analyserRef.current.connect(audioContextRef.current.destination);
          } catch (e) {
            console.error("Error connecting media element source:", e);
            // If already connected, do nothing or handle
          }
        }
      } catch (e) {
        console.error("Error initializing audio context:", e);
      }

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        if (!isPlaying) return;
        animationRef.current = requestAnimationFrame(draw);
        analyserRef.current?.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height;
          
          // Technical gradient
          const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
          gradient.addColorStop(0, '#6366f1'); // indigo-500
          gradient.addColorStop(0.5, '#a855f7'); // purple-500
          gradient.addColorStop(1, '#ec4899'); // pink-500
          
          ctx.fillStyle = gradient;
          ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

          x += barWidth + 1;
        }
      };

      draw();
    } else {
      cancelAnimationFrame(animationRef.current);
    }

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, audioElement]);

  return (
    <div className="h-10 w-full flex items-center justify-center bg-black/20 rounded-lg overflow-hidden border border-white/5">
      <canvas 
        ref={canvasRef} 
        width={300} 
        height={40} 
        className="w-full h-full opacity-80"
      />
    </div>
  );
};
