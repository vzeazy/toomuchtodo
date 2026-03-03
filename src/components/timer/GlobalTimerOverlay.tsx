import React, { useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PictureInPicture2, Pause, Play, Square } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { TaskPanelPictureInPictureBridge, TaskPanelPictureInPictureBridgeHandle } from '../../features/tasks/TaskPanelPictureInPictureBridge';
import { getThemeVariables } from '../../lib/theme';

// Dots grid size in px (diameter + gap)
const DOT_D = 3;
const DOT_GAP = 12; // slightly wider for better aesthetic and performance

export function GlobalTimerOverlay() {
    const { timer, tickTimer, pauseTimer, resumeTimer, stopTimer, activeTheme } = useAppStore();
    const [dims, setDims] = useState({ w: window.innerWidth, h: window.innerHeight });
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const smoothedLitCountRef = useRef(0);
    const [isPictureInPictureOpen, setIsPictureInPictureOpen] = useState(false);
    const pictureInPictureBridgeRef = useRef<TaskPanelPictureInPictureBridgeHandle>(null);
    const isPictureInPictureSupported = typeof window !== 'undefined' && Boolean(window.documentPictureInPicture);

    const themeVariables = useMemo(() => getThemeVariables(activeTheme), [activeTheme]);

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

    // Canvas effect for dots
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !timer.active || isPictureInPictureOpen) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;

        const style = getComputedStyle(document.documentElement);
        const actualAccent = style.getPropertyValue('--accent').trim() || '#5ea1ff';
        const actualDanger = style.getPropertyValue('--danger').trim() || '#ff4757';

        const dotColor = isDanger ? actualDanger : actualAccent;

        if (Math.abs(litCount - smoothedLitCountRef.current) > total * 0.5 && litCount === 0) {
            smoothedLitCountRef.current = 0; // Snap to 0 on hard reset
        }

        const render = (time: number) => {
            ctx.clearRect(0, 0, dims.w, dims.h);

            // Smoothly interpolate the lit dots count
            if (!timer.paused) {
                smoothedLitCountRef.current += (litCount - smoothedLitCountRef.current) * 0.05;
            }
            const drawCount = Math.floor(smoothedLitCountRef.current);

            ctx.fillStyle = dotColor;

            // Global pulse effect for glowing without expensive shadowBlur
            const pulse = 0.85 + 0.15 * Math.sin(time / 400); // 0.7 to 1.0 opacity
            ctx.globalAlpha = timer.paused ? 0.3 : pulse;

            ctx.beginPath();

            // Draw squares for maximum performance. At 3px they look soft enough.
            for (let i = 0; i < drawCount; i++) {
                const col = i % cols;
                const row = Math.floor(i / cols);
                const x = col * DOT_GAP + (DOT_GAP - DOT_D) / 2;
                const y = row * DOT_GAP + (DOT_GAP - DOT_D) / 2;

                // Add a very subtle wave effect based on coordinates
                const wave = Math.sin((x + y) / 120 - time / 600);
                const sizeOffset = timer.paused ? 0 : wave * 0.6; // slightly grow and shrink

                ctx.rect(x - sizeOffset, y - sizeOffset, DOT_D + sizeOffset * 2, DOT_D + sizeOffset * 2);
            }
            ctx.fill();

            if (!timer.paused) {
                animationFrameId = requestAnimationFrame(render);
            }
        };

        if (timer.paused) {
            // Render a static frame if paused
            render(0);
        } else {
            animationFrameId = requestAnimationFrame(render);
        }

        return () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [dims, litCount, isDanger, timer.active, timer.paused, cols, isPictureInPictureOpen]);

    const handleTogglePictureInPicture = async () => {
        if (!isPictureInPictureSupported) return;
        if (isPictureInPictureOpen) {
            pictureInPictureBridgeRef.current?.close();
            return;
        }
        await pictureInPictureBridgeRef.current?.open();
    };

    // Sub-renderers to share logic between main view and PIP
    const ClockView = ({ sizeScale = 1 }: { sizeScale?: number }) => (
        <motion.div
            animate={{
                scale: timer.paused ? 0.95 * sizeScale : 1 * sizeScale,
                opacity: timer.paused ? 0.4 : 1,
            }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12 * sizeScale,
            }}
        >
            <span style={{
                fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace',
                fontSize: 140 * sizeScale,
                fontWeight: 800,
                color: 'white',
                lineHeight: 1,
                letterSpacing: '-0.06em',
                textShadow: `0 0 ${60 * sizeScale}px ${accentColor}, 0 0 ${100 * sizeScale}px ${accentColor}`,
            }}>
                {timeStr}
            </span>

            <div style={{
                fontSize: 15 * sizeScale,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.6)',
                textTransform: 'uppercase',
                letterSpacing: '0.3em',
                marginTop: -8 * sizeScale,
            }}>
                {timer.paused ? 'Timer Paused' : (timer.sessionTitle || 'Deep Focus')}
            </div>
        </motion.div>
    );

    // IMPORTANT: Early return *after* all hooks!
    if (!timer.active) return null;

    return (
        <>
            <TaskPanelPictureInPictureBridge
                ref={pictureInPictureBridgeRef}
                title="Timer • Too Much Todo"
                themeVariables={themeVariables}
                onOpenChange={setIsPictureInPictureOpen}
            >
                <div style={{
                    width: '100%',
                    height: '100%',
                    background: 'var(--app-bg)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 24,
                    overflow: 'hidden',
                }}>
                    <ClockView sizeScale={0.5} />
                    <div style={{ marginTop: 40 }}>
                        <TimerHUD
                            isDanger={isDanger}
                            paused={timer.paused}
                            onPauseResume={timer.paused ? resumeTimer : pauseTimer}
                            onStop={stopTimer}
                            onTogglePIP={handleTogglePictureInPicture}
                            isPIP={true}
                            pipSupported={isPictureInPictureSupported}
                        />
                    </div>
                </div>
            </TaskPanelPictureInPictureBridge>

            <AnimatePresence>
                {!isPictureInPictureOpen && (
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
                            background: 'rgba(0, 0, 0, 0.45)',
                            backdropFilter: 'blur(24px)',
                            zIndex: 1,
                        }} />

                        {/* 2. Timer Matrix (Canvas) */}
                        <canvas
                            ref={canvasRef}
                            width={dims.w}
                            height={dims.h}
                            style={{
                                position: 'absolute',
                                inset: 0,
                                zIndex: 2,
                                transition: 'opacity 0.5s ease',
                            }}
                        />

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
                            <ClockView />
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
                                onTogglePIP={handleTogglePictureInPicture}
                                isPIP={false}
                                pipSupported={isPictureInPictureSupported}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

function TimerHUD({
    isDanger,
    paused,
    onPauseResume,
    onStop,
    onTogglePIP,
    isPIP,
    pipSupported,
}: {
    isDanger: boolean;
    paused: boolean;
    onPauseResume: () => void;
    onStop: () => void;
    onTogglePIP: () => void;
    isPIP: boolean;
    pipSupported: boolean;
}) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'rgba(20, 20, 20, 0.65)',
            backdropFilter: 'blur(40px)',
            border: `1px solid rgba(255,255,255,0.12)`,
            borderRadius: 24,
            padding: '8px 12px',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5), inset 0 0 20px rgba(0,0,0,0.3)',
        }}>
            {/* Pause/Resume Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onPauseResume}
                style={{
                    background: paused ? 'white' : 'rgba(255,255,255,0.08)',
                    border: 'none',
                    color: paused ? 'black' : 'white',
                    height: 44,
                    borderRadius: 18,
                    padding: '0 20px',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'background 0.2s, color 0.2s',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                }}
            >
                {paused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
                {paused ? 'Resume' : 'Pause'}
            </motion.button>

            {/* PiP Button — always rendered, disabled on non-HTTPS */}
            <motion.button
                whileHover={pipSupported ? { scale: 1.1, backgroundColor: 'rgba(255,255,255,0.15)' } : {}}
                whileTap={pipSupported ? { scale: 0.9 } : {}}
                onClick={pipSupported ? onTogglePIP : undefined}
                disabled={!pipSupported}
                style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: 'none',
                    color: pipSupported ? 'white' : 'rgba(255,255,255,0.3)',
                    width: 44,
                    height: 44,
                    borderRadius: 18,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: pipSupported ? 'pointer' : 'not-allowed',
                    transition: 'background 0.2s',
                    opacity: pipSupported ? 1 : 0.4,
                }}
                title={pipSupported
                    ? (isPIP ? "Return to Fullscreen" : "Pop Out · Always on Top")
                    : "Picture-in-Picture requires HTTPS"}
            >
                <PictureInPicture2 size={18} strokeWidth={2.2} />
            </motion.button>

            {/* Separator */}
            <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)' }} />

            {/* Stop Button */}
            <motion.button
                whileHover={{ scale: 1.05, background: 'rgba(215, 60, 60, 0.3)', borderColor: 'rgba(255, 107, 107, 0.5)' }}
                whileTap={{ scale: 0.95 }}
                onClick={onStop}
                style={{
                    background: 'rgba(215, 60, 60, 0.15)',
                    border: '1px solid rgba(215, 60, 60, 0.2)',
                    color: '#ff8a8a',
                    height: 44,
                    borderRadius: 18,
                    padding: '0 20px',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'all 0.2s',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                }}
            >
                <Square size={14} fill="currentColor" />
                Stop
            </motion.button>
        </div>
    );
}
