import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useAnimation } from 'motion/react';
import { Play, Pause, Settings, Volume2, VolumeX, Info, History, Hand } from 'lucide-react';

// --- Audio Synthesis ---
const createMuyuSound = (audioCtx: AudioContext) => {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();

  osc.type = 'triangle';
  
  const startTime = audioCtx.currentTime;
  osc.frequency.setValueAtTime(320, startTime);
  osc.frequency.exponentialRampToValueAtTime(180, startTime + 0.05);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1200, startTime);
  filter.frequency.exponentialRampToValueAtTime(400, startTime + 0.1);

  gain.gain.setValueAtTime(0.6, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(startTime);
  osc.stop(startTime + 0.3);
};

// --- Components ---

interface MeritTextProps {
  id: number;
  onComplete: (id: number) => void;
  key?: React.Key;
}

const MeritText = ({ id, onComplete }: MeritTextProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 0, scale: 0.8 }}
      animate={{ opacity: 1, y: -100, scale: 1.2 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.5, ease: "easeOut" }}
      onAnimationComplete={() => onComplete(id)}
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none text-[#5A5A40] font-serif italic text-xl whitespace-nowrap z-50"
    >
      Merit +1
    </motion.div>
  );
};

export default function App() {
  const [bpm, setBpm] = useState(60);
  const [isPlaying, setIsPlaying] = useState(false);
  const [merit, setMerit] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [meritPopups, setMeritPopups] = useState<{ id: number }[]>([]);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const nextPopupId = useRef(0);

  // Refs for collision detection
  const malletHeadRef = useRef<HTMLDivElement>(null);
  const muyuBodyRef = useRef<HTMLDivElement>(null);
  const isCollidingRef = useRef(false);

  const muyuControls = useAnimation();
  const malletControls = useAnimation();

  const strike = useCallback(() => {
    if (!isMuted) {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      createMuyuSound(audioCtxRef.current);
    }
    setMerit(prev => prev + 1);
    const id = nextPopupId.current++;
    setMeritPopups(prev => [...prev, { id }]);

    // Trigger Muyu impact animation
    muyuControls.start({
      scale: [1, 1.05, 1],
      rotate: [0, -2, 2, -2, 0],
      transition: { duration: 0.2, ease: "easeOut" }
    });

    // Trigger Mallet impact animation
    malletControls.start({
      y: [0, -20, 0],
      transition: { duration: 0.15, ease: "easeOut" }
    });
  }, [isMuted, muyuControls, malletControls]);

  const removePopup = useCallback((id: number) => {
    setMeritPopups(prev => prev.filter(p => p.id !== id));
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      malletControls.start({
        rotate: -45,
        y: [0, -10, 0],
        transition: { 
          y: { duration: 3, repeat: Infinity, ease: "easeInOut" },
          rotate: { duration: 0 }
        }
      });
    }
  }, [isPlaying, malletControls]);

  useEffect(() => {
    if (isPlaying) {
      const interval = (60 / bpm) * 1000;
      timerRef.current = setInterval(strike, interval);
      
      // Also start a rhythmic scale animation on the Muyu
      muyuControls.start({
        scale: [1, 1.03, 1],
        transition: { 
          duration: interval / 1000, 
          repeat: Infinity, 
          ease: "easeInOut" 
        }
      });
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      muyuControls.stop();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, bpm, strike, muyuControls]);

  // Collision detection logic during drag
  const handleDrag = () => {
    if (!malletHeadRef.current || !muyuBodyRef.current) return;

    const malletRect = malletHeadRef.current.getBoundingClientRect();
    const muyuRect = muyuBodyRef.current.getBoundingClientRect();

    // Check for overlap
    const isOverlapping = !(
      malletRect.right < muyuRect.left ||
      malletRect.left > muyuRect.right ||
      malletRect.bottom < muyuRect.top ||
      malletRect.top > muyuRect.bottom
    );

    if (isOverlapping && !isCollidingRef.current) {
      strike();
      isCollidingRef.current = true;
    } else if (!isOverlapping) {
      isCollidingRef.current = false;
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-8 md:p-12 max-w-4xl mx-auto overflow-hidden select-none">
      {/* Header */}
      <header className="w-full flex justify-between items-center">
        <div className="flex flex-col">
          <h1 className="serif text-4xl font-light tracking-tight text-[#3d3d2e]">Zen Muyu</h1>
          <p className="text-sm text-[#8a8a7a] uppercase tracking-widest mt-1">Wooden Fish Meditation</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-full hover:bg-[#e8e8df] transition-colors text-[#5A5A40]"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-full hover:bg-[#e8e8df] transition-colors text-[#5A5A40]"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center w-full relative">
        {/* Merit Counter */}
        <div className="mb-12 text-center">
          <span className="text-xs uppercase tracking-[0.3em] text-[#8a8a7a] block mb-2">Accumulated Merit</span>
          <motion.span 
            key={merit}
            initial={{ scale: 1.1, color: "#5A5A40" }}
            animate={{ scale: 1, color: "#3d3d2e" }}
            className="serif text-6xl font-medium"
          >
            {merit.toLocaleString()}
          </motion.span>
        </div>

        {/* The Wooden Fish Area */}
        <div className="relative w-full max-w-lg aspect-square flex items-center justify-center">
          <AnimatePresence>
            {meritPopups.map(p => (
              <MeritText key={p.id} id={p.id} onComplete={removePopup} />
            ))}
          </AnimatePresence>

          {/* Mallet / Striker - Draggable */}
          <motion.div
            drag
            dragConstraints={{ left: -200, right: 200, top: -200, bottom: 200 }}
            dragElastic={0.1}
            onDrag={handleDrag}
            animate={isPlaying ? {
              y: [0, -50, 0],
              x: 0,
              rotate: -45
            } : malletControls}
            initial={{ rotate: -45 }}
            transition={isPlaying ? {
              duration: (60 / bpm),
              repeat: Infinity,
              ease: "easeInOut"
            } : { 
              type: "spring", 
              stiffness: 300, 
              damping: 30 
            }}
            className="absolute z-20 cursor-grab active:cursor-grabbing"
            style={{ bottom: '-15%', left: '65%', x: '-50%', rotate: -45 }}
          >
            <div className="w-4 h-64 bg-[#4a3728] rounded-full origin-bottom relative">
              {/* Mallet Head - Now at the top for bottom-to-top strike */}
              <div 
                ref={malletHeadRef}
                className="absolute -top-4 -left-3 w-12 h-12 bg-[#d2b48c] rounded-full shadow-md flex items-center justify-center border-2 border-[#8b4513]/20"
              >
                <div className="w-2 h-2 bg-white/20 rounded-full" />
              </div>
              {/* Handle Grip at the bottom */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-12 bg-[#3e2723] rounded-b-full opacity-50" />
            </div>
            
            {/* Drag Indicator */}
            {!isPlaying && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -top-12 left-1/2 -translate-x-1/2 flex flex-col items-center"
              >
                <Hand size={16} className="text-[#5A5A40] rotate-180" />
                <span className="text-[10px] uppercase tracking-widest text-[#5A5A40] mt-1">Drag me</span>
              </motion.div>
            )}
          </motion.div>

          {/* Wooden Fish Body */}
          <motion.div
            ref={muyuBodyRef}
            whileTap={{ scale: 0.98 }}
            animate={muyuControls}
            onClick={() => !isPlaying && strike()}
            className="w-64 h-64 md:w-80 md:h-80 bg-[#5d4037] rounded-[60%_60%_40%_40%] shadow-[0_20px_50px_rgba(0,0,0,0.2)] flex items-center justify-center relative overflow-hidden border-b-8 border-[#3e2723] cursor-pointer"
          >
            <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]" />
            {/* The "Mouth" of the fish - now at the bottom */}
            <div className="absolute w-4 h-3/4 bg-[#2c1b18] rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 shadow-inner" />
            
            {/* Eye - now at the top */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#2c1b18] rounded-full" />
            
            {/* Decorative Scales/Pattern - now on the sides */}
            <div className="absolute bottom-1/4 left-1/4 flex flex-col gap-1">
              <div className="h-2 w-8 bg-[#4a3728] rounded-full opacity-50" />
              <div className="h-2 w-6 bg-[#4a3728] rounded-full opacity-50 ml-2" />
              <div className="h-2 w-4 bg-[#4a3728] rounded-full opacity-50 ml-4" />
            </div>
          </motion.div>
        </div>

        <p className="mt-8 text-[#8a8a7a] italic font-serif text-lg">
          {isPlaying ? "Chanting automatically..." : "Drag the stick to strike or tap the Muyu"}
        </p>
      </main>

      {/* Controls */}
      <footer className="w-full max-w-md bg-white/50 backdrop-blur-sm p-6 rounded-3xl shadow-sm border border-white/20">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-14 h-14 rounded-full bg-[#5A5A40] text-white flex items-center justify-center shadow-lg hover:bg-[#4a4a35] transition-all active:scale-95"
              >
                {isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" className="ml-1" />}
              </button>
              <div>
                <p className="text-xs uppercase tracking-widest text-[#8a8a7a] font-semibold">Auto Strike</p>
                <p className="text-sm text-[#3d3d2e]">{isPlaying ? "Enabled" : "Disabled"}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-[#8a8a7a] font-semibold">Rhythm</p>
              <p className="serif text-2xl text-[#3d3d2e]">{bpm} <span className="text-sm italic">bpm</span></p>
            </div>
          </div>

          <div className="space-y-2">
            <input
              type="range"
              min="20"
              max="240"
              value={bpm}
              onChange={(e) => setBpm(parseInt(e.target.value))}
              className="w-full h-1.5 bg-[#e8e8df] rounded-lg appearance-none cursor-pointer accent-[#5A5A40]"
            />
            <div className="flex justify-between text-[10px] uppercase tracking-tighter text-[#8a8a7a]">
              <span>Slow</span>
              <span>Fast</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#f5f5f0]/80 backdrop-blur-md"
          >
            <div className="bg-white p-8 rounded-[2rem] shadow-2xl max-w-sm w-full border border-[#e8e8df]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="serif text-2xl">Meditation Settings</h2>
                <button onClick={() => setShowSettings(false)} className="text-[#8a8a7a] hover:text-[#3d3d2e]">✕</button>
              </div>
              
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <span className="text-[#5A5A40] font-medium">Reset Merit</span>
                  <button 
                    onClick={() => { setMerit(0); setShowSettings(false); }}
                    className="px-4 py-2 rounded-full border border-[#e8e8df] text-sm hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    Clear History
                  </button>
                </div>
                
                <div className="pt-6 border-t border-[#e8e8df]">
                  <p className="text-xs text-[#8a8a7a] leading-relaxed">
                    The wooden fish (Muyu) is a ritual percussion instrument. You can now manually drag the mallet to strike it, or use the auto-play feature for a steady rhythm.
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setShowSettings(false)}
                className="w-full mt-8 py-3 bg-[#5A5A40] text-white rounded-2xl font-medium shadow-md"
              >
                Return to Zen
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
