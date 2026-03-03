import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';

// Dots grid size in px (diameter + gap)
const DOT_D = 3;
const DOT_GAP = 10; // slightly wider for better aesthetic

export function GlobalTimerOverlay() {
    const { timer, tickTimer, pauseTimer, resumeTimer, stopTimer } = useAppStore();
    const [dims, setDims] = useState({ w: window.innerWidth, h: window.innerHeight });

    // Timer tick
    useEffect(() => {
        if (!timer.active || timer.paused) return;
        const id = window.setInterval(() => tickTimer(), 1000);
        return () => clearInterval(id);
    }, [timer.active, timer.paused, tickTimer]);

    // Track viewport
    useEffect(() => {
        const onResize = () => setDims({ w: window.innerWidth, h: window.innerHeight });
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    if (!timer.active) return null;

    const cols = Math.ceil(dims.w / DOT_GAP);
    const rows = Math.ceil(dims.h / DOT_GAP);
    const total = cols * rows;

    // fraction of time ELAPSED (not remaining) — dots light up as time passes
    const elapsed = timer.duration - timer.remaining;
    const fraction = timer.duration > 0 ? Math.max(0, Math.min(1, elapsed / timer.duration)) : 0;
    const litCount = Math.floor(fraction * total);

    // Once < 10% remaining, shift to danger colour
    const remainFraction = timer.duration > 0 ? timer.remaining / timer.duration : 0;
    const isDanger = remainFraction < 0.1 && timer.active;

    // Format counter
    const hh = Math.floor(timer.remaining / 3600);
    const mm = Math.floor((timer.remaining % 3600) / 60);
    const ss = timer.remaining % 60;

    const timeStr = hh > 0
        ? `${hh}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`
        : `${mm}:${ss.toString().padStart(2, '0')}`;

    const accentColor = isDanger ? 'var(--danger)' : 'var(--accent)';

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 8000,
                    overflow: 'hidden',
                }}
            >
                {/* 1. Backdrop Blur & Faded Layer */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.25)',
                    backdropFilter: 'blur(16px)',
                    zIndex: 1,
                }} />

                {/* 2. Timer Matrix (Dot Grid) */}
                <svg
                    width={dims.w}
                    height={dims.h}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 2,
                        opacity: timer.paused ? 0.2 : 0.5,
                        transition: 'opacity 0.5s ease',
                    }}
                >
                    <defs>
                        <radialGradient id="lit-glow" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor={accentColor} stopOpacity="1" />
                            <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
                        </radialGradient>
                    </defs>
                    {/* Render dots in groups or use a pattern for performance.
                        For a truly high-end feel with individual dot lighting, 
                        we iterate up to litCount.
                    */}
                    {Array.from({ length: Math.min(litCount, 5000) }).map((_, i) => {
                        const col = i % cols;
                        const row = Math.floor(i / cols);
                        const cx = col * DOT_GAP + DOT_GAP / 2;
                        const cy = row * DOT_GAP + DOT_GAP / 2;
                        return (
                            <circle
                                key={i}
                                cx={cx}
                                cy={cy}
                                r={DOT_D / 2}
                                fill={accentColor}
                                style={{ opacity: 1 }}
                            />
                        );
                    })}
                </svg>

                {/* 3. Central Timer Clock / HUD (Most prominent) */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                    pointerEvents: 'none',
                }}>
                    <motion.div
                        animate={{
                            scale: timer.paused ? 0.95 : 1,
                            opacity: timer.paused ? 0.6 : 1,
                        }}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 12,
                        }}
                    >
                        <span style={{
                            fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace',
                            fontSize: 120,
                            fontWeight: 700,
                            color: 'white',
                            lineHeight: 1,
                            letterSpacing: '-0.05em',
                            textShadow: `0 0 40px ${accentColor}`,
                        }}>
                            {timeStr}
                        </span>

                        <div style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: 'rgba(255,255,255,0.4)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.2em',
                        }}>
                            {timer.paused ? 'Paused' : 'Keep Focused'}
                        </div>
                    </motion.div>
                </div>

                {/* 4. Controls HUD (Floating corner) */}
                <div
                    style={{
                        position: 'absolute',
                        bottom: 48,
                        right: 48,
                        zIndex: 20,
                        pointerEvents: 'auto'
                    }}
                >
                    <TimerHUD
                        isDanger={isDanger}
                        paused={timer.paused}
                        onPauseResume={timer.paused ? resumeTimer : pauseTimer}
                        onStop={stopTimer}
                    />
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

function TimerHUD({
    isDanger,
    paused,
    onPauseResume,
    onStop,
}: {
    isDanger: boolean;
    paused: boolean;
    onPauseResume: () => void;
    onStop: () => void;
}) {
    const accentColor = isDanger ? 'var(--danger)' : 'var(--accent)';

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            background: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(30px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 24,
            padding: '12px 24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        }}>
            <button
                onClick={onPauseResume}
                style={{
                    background: paused ? 'white' : 'rgba(255,255,255,0.1)',
                    border: 'none',
                    color: paused ? 'black' : 'white',
                    padding: '10px 24px',
                    borderRadius: 16,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                }}
            >
                {paused ? 'Resume' : 'Pause'}
            </button>
            <button
                onClick={onStop}
                style={{
                    background: 'rgba(215, 60, 60, 0.2)',
                    border: '1px solid rgba(215, 60, 60, 0.3)',
                    color: '#ff6b6b',
                    padding: '10px 24px',
                    borderRadius: 16,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                }}
            >
                Stop
            </button>
        </div>
    );
}
