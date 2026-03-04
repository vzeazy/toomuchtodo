import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PictureInPicture2, Pause, Play, Square } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { TaskPanelPictureInPictureBridge, TaskPanelPictureInPictureBridgeHandle } from '../../features/tasks/TaskPanelPictureInPictureBridge';
import { getThemeVariables } from '../../lib/theme';
import motivationalQuotes from '../../data/motivationalQuotes.json';

// Dots grid size in px (diameter + gap)
const DOT_D = 4;
const DOT_D_IDLE = 3;
const DOT_GAP = 12; // slightly wider for better aesthetic and performance

type RGB = { r: number; g: number; b: number };

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const parseCssColor = (value: string): RGB | null => {
    const raw = value.trim();
    if (!raw) return null;

    if (raw.startsWith('#')) {
        const hex = raw.slice(1);
        if (hex.length === 3) {
            const [r, g, b] = hex.split('').map((part) => Number.parseInt(part + part, 16));
            return { r, g, b };
        }
        if (hex.length >= 6) {
            return {
                r: Number.parseInt(hex.slice(0, 2), 16),
                g: Number.parseInt(hex.slice(2, 4), 16),
                b: Number.parseInt(hex.slice(4, 6), 16),
            };
        }
    }

    const rgbMatch = raw.match(/^rgba?\(([^)]+)\)$/i);
    if (!rgbMatch) return null;
    const channels = rgbMatch[1].split(',').slice(0, 3).map((part) => Number.parseFloat(part.trim()));
    if (channels.length !== 3 || channels.some(Number.isNaN)) return null;

    return {
        r: Math.round(channels[0]),
        g: Math.round(channels[1]),
        b: Math.round(channels[2]),
    };
};



export function GlobalTimerOverlay() {
    const { timer, tickTimer, pauseTimer, resumeTimer, stopTimer, activeTheme } = useAppStore();
    const [dims, setDims] = useState({ w: window.innerWidth, h: window.innerHeight });
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const smoothedLitCountRef = useRef(0);
    const [isPictureInPictureOpen, setIsPictureInPictureOpen] = useState(false);
    const [sessionQuote, setSessionQuote] = useState<string | null>(null);
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

    useEffect(() => {
        if (!timer.active) {
            setSessionQuote(null);
            return;
        }
        if (timer.linkedTaskId || timer.sessionTitle) {
            setSessionQuote(null);
            return;
        }
        setSessionQuote((current) => current ?? motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)] ?? null);
    }, [timer.active, timer.linkedTaskId, timer.sessionTitle]);

    const cols = Math.ceil(dims.w / DOT_GAP);
    const rows = Math.ceil(dims.h / DOT_GAP);
    const total = cols * rows;

    // fraction of time ELAPSED (not remaining) — dots light up as time passes
    const elapsed = timer.duration - timer.remaining;
    const fraction = timer.duration > 0 ? Math.max(0, Math.min(1, elapsed / timer.duration)) : 0;
    const litCount = Math.floor(fraction * total);

    // Once < 10% remaining, shift to danger colour
    const remainFraction = timer.duration > 0 ? timer.remaining / timer.duration : 0;
    const isDanger = (remainFraction < 0.1 && timer.active) || timer.finished;

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

        // Read CSS vars from canvas itself — it inherits from div.app-frame (where vars are scoped)
        const style = getComputedStyle(canvas);
        const actualAccent = style.getPropertyValue('--accent').trim() || '#5ea1ff';
        const actualDanger = style.getPropertyValue('--danger').trim() || '#ff4757';

        const accentRgb = parseCssColor(actualAccent) ?? { r: 94, g: 161, b: 255 };
        const dangerRgb = parseCssColor(actualDanger) ?? { r: 255, g: 80, b: 96 };
        const vividRgb = isDanger ? dangerRgb : accentRgb;

        if (Math.abs(litCount - smoothedLitCountRef.current) > total * 0.5 && litCount === 0) {
            smoothedLitCountRef.current = 0; // Snap to 0 on hard reset
        }

        const render = (time: number) => {
            ctx.clearRect(0, 0, dims.w, dims.h);

            // Smoothly interpolate the lit dots count
            if (!timer.paused) {
                smoothedLitCountRef.current += (litCount - smoothedLitCountRef.current) * 0.08;
            }
            const drawCount = Math.floor(smoothedLitCountRef.current);

            // Global pulse effect for glowing
            const pulseAmount = timer.finished ? 0.3 * Math.sin(time / 250) : 0.1 * Math.sin(time / 500);
            const globalPulse = (timer.finished ? 0.7 : 0.9) + pulseAmount;

            // 5 intensity bands for performance
            const bands = 5;
            const paths = Array.from({ length: bands }, () => new Path2D());

            for (let i = 0; i < drawCount; i++) {
                const col = i % cols;
                const row = Math.floor(i / cols);
                const x = col * DOT_GAP + (DOT_GAP - DOT_D) / 2;
                const y = row * DOT_GAP + (DOT_GAP - DOT_D) / 2;

                // Slow diagonal cascading wave across the matrix
                const wave = (Math.sin(col * 0.1 + row * 0.1 - time * 0.002) + 1) / 2;

                // Add a gentle shimmer
                const shimmer = Math.sin(time * 0.005 + i * 0.01) * 0.1;

                let intensity = clamp01(0.4 + wave * 0.5 + shimmer);

                // Highlight the "leading edge" of the timer dots brightly
                const distFromFront = drawCount - i;
                if (!timer.paused && !timer.finished && distFromFront < cols * 3) {
                    intensity = 1.0;
                }

                if (timer.paused && !timer.finished) {
                    intensity = 0.3 + wave * 0.2; // Dim down when paused
                }

                const bandIndex = Math.min(bands - 1, Math.floor(intensity * bands));
                const drawSize = timer.paused && !timer.finished ? DOT_D_IDLE : DOT_D;
                paths[bandIndex].rect(x, y, drawSize, drawSize);
            }

            for (let b = 0; b < bands; b++) {
                // Minimum opacity base, scaled linearly per band, then multiplied by global pulse
                const alpha = (0.2 + 0.8 * ((b + 1) / bands)) * globalPulse;
                ctx.globalAlpha = clamp01(alpha);
                ctx.fillStyle = `rgb(${vividRgb.r}, ${vividRgb.g}, ${vividRgb.b})`;
                ctx.fill(paths[b]);
            }

            if (!timer.paused || timer.finished) {
                animationFrameId = requestAnimationFrame(render);
            }
        };

        if (timer.paused && !timer.finished) {
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
    }, [dims, litCount, isDanger, timer.active, timer.paused, timer.finished, cols, rows, isPictureInPictureOpen]);

    const handleTogglePictureInPicture = useCallback(async () => {
        if (!isPictureInPictureSupported) return;
        if (isPictureInPictureOpen) {
            pictureInPictureBridgeRef.current?.close();
            return;
        }
        await pictureInPictureBridgeRef.current?.open();
    }, [isPictureInPictureOpen, isPictureInPictureSupported]);

    useEffect(() => {
        if (!timer.active || isPictureInPictureOpen) return;
        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            const isTypingTarget = !!target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable);
            if (isTypingTarget) return;

            if (event.code === 'Space') {
                event.preventDefault();
                if (timer.finished) return;
                if (timer.paused) resumeTimer();
                else pauseTimer();
                return;
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                stopTimer();
                return;
            }
            if (event.key.toLowerCase() === 'p' && isPictureInPictureSupported) {
                event.preventDefault();
                void handleTogglePictureInPicture();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [timer.active, timer.finished, timer.paused, pauseTimer, resumeTimer, stopTimer, isPictureInPictureOpen, isPictureInPictureSupported, handleTogglePictureInPicture]);

    // Sub-renderers to share logic between main view and PIP
    const ClockView = ({ sizeScale = 1 }: { sizeScale?: number }) => (
        <motion.div
            animate={{
                scale: (timer.paused && !timer.finished) ? 0.97 * sizeScale : 1 * sizeScale,
                opacity: (timer.paused && !timer.finished) ? 0.45 : 1,
            }}
            transition={{ duration: 0.45, ease: 'easeInOut' }}
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12 * sizeScale,
            }}
        >
            <motion.span
                animate={timer.finished ? {
                    scale: [1, 1.01, 1],
                    textShadow: [
                        `0 0 ${12 * sizeScale}px ${accentColor}`,
                        `0 0 ${18 * sizeScale}px ${accentColor}`,
                        `0 0 ${12 * sizeScale}px ${accentColor}`
                    ]
                } : {
                    scale: 1,
                    textShadow: `0 0 ${8 * sizeScale}px ${accentColor}`
                }}
                transition={{ duration: 2.8, repeat: timer.finished ? Infinity : 0, ease: 'easeInOut' }}
                style={{
                    fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace',
                    fontSize: 140 * sizeScale,
                    fontWeight: 800,
                    color: 'rgba(255,255,255,0.95)',
                    lineHeight: 1,
                    letterSpacing: '-0.06em',
                }}
            >
                {timer.finished ? '00:00' : timeStr}
            </motion.span>

            <div style={{
                fontSize: 20 * sizeScale,
                fontWeight: 800,
                color: 'rgba(255,255,255,0.6)',
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
                marginTop: -4 * sizeScale,
                maxWidth: 1000 * sizeScale,
                textAlign: 'center',
            }}>
                {timer.finished ? 'SESSION COMPLETE' : (timer.paused ? 'Timer Paused' : (timer.sessionTitle || 'Deep Focus'))}
            </div>
            {!timer.finished && !timer.sessionTitle && !timer.linkedTaskId && sessionQuote && (
                <div style={{
                    marginTop: 10 * sizeScale,
                    maxWidth: 820 * sizeScale,
                    textAlign: 'center',
                    fontSize: 17 * sizeScale,
                    fontWeight: 600,
                    lineHeight: 1.35,
                    color: 'rgba(255,255,255,0.72)',
                    letterSpacing: '-0.01em',
                }}>
                    “{sessionQuote}”
                </div>
            )}
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
                            shortcutsEnabled={false}
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
                            background: 'rgba(0,0,0,0.52)',
                            backdropFilter: 'blur(24px)',
                            WebkitBackdropFilter: 'blur(24px)', // iPad fix
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
                                shortcutsEnabled={true}
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
    shortcutsEnabled,
}: {
    isDanger: boolean;
    paused: boolean;
    onPauseResume: () => void;
    onStop: () => void;
    onTogglePIP: () => void;
    isPIP: boolean;
    pipSupported: boolean;
    shortcutsEnabled: boolean;
}) {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: 8,
            background: 'rgba(10, 14, 20, 0.72)',
            backdropFilter: 'blur(40px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 24,
            padding: '10px 12px',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5), inset 0 0 20px rgba(0,0,0,0.3)',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Pause/Resume Button */}
                <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={onPauseResume}
                    style={{
                        background: paused ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        color: paused ? 'var(--accent-contrast)' : 'rgba(255,255,255,0.9)',
                        height: 44,
                        borderRadius: 14,
                        padding: '0 18px',
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
                    title={paused ? 'Resume (Space)' : 'Pause (Space)'}
                >
                    {paused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
                    {paused ? 'Resume' : 'Pause'}
                </motion.button>

                {/* PiP Button — always rendered, disabled on non-HTTPS */}
                <motion.button
                    whileHover={pipSupported ? { scale: 1.06, backgroundColor: 'rgba(255,255,255,0.14)' } : {}}
                    whileTap={pipSupported ? { scale: 0.94 } : {}}
                    onClick={pipSupported ? onTogglePIP : undefined}
                    disabled={!pipSupported}
                    style={{
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        color: pipSupported ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)',
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: pipSupported ? 'pointer' : 'not-allowed',
                        transition: 'background 0.2s',
                        opacity: pipSupported ? 1 : 0.45,
                    }}
                    title={pipSupported
                        ? (isPIP ? 'Return to Fullscreen (P)' : 'Pop Out · Always on Top (P)')
                        : 'Picture-in-Picture requires HTTPS'}
                >
                    <PictureInPicture2 size={18} strokeWidth={2.2} />
                </motion.button>

                {/* Stop Button */}
                <motion.button
                    whileHover={{ scale: 1.03, background: 'rgba(215, 60, 60, 0.32)', borderColor: 'rgba(255, 107, 107, 0.55)' }}
                    whileTap={{ scale: 0.97 }}
                    onClick={onStop}
                    style={{
                        background: isDanger ? 'rgba(215, 60, 60, 0.24)' : 'rgba(215, 60, 60, 0.15)',
                        border: '1px solid rgba(215, 60, 60, 0.3)',
                        color: '#ff8a8a',
                        height: 44,
                        borderRadius: 14,
                        padding: '0 16px',
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
                    title='Stop timer (Esc)'
                >
                    <Square size={14} fill="currentColor" />
                    Stop
                </motion.button>
            </div>
            {shortcutsEnabled && (
                <div style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.4)',
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase',
                    textAlign: 'center',
                    paddingBottom: 2,
                }}>
                    Space Pause • Esc Stop • P Pop-out
                </div>
            )}
        </div>
    );
}
