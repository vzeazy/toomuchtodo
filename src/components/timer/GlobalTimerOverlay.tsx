import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PictureInPicture2, Pause, Play, Square, Minimize2, Maximize2 } from 'lucide-react';
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
    const { timer, tickTimer, pauseTimer, resumeTimer, stopTimer, toggleTimerMinimized, activeTheme } = useAppStore();
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

    const isMinimized = timer.minimized;

    // Much denser gap for minimized vs before, plus slightly bigger dots for that specific tight view
    const actualDotGap = isMinimized ? 12 : DOT_GAP;

    // Grid bounded to either fullscreen or minimized box size
    const targetW = isMinimized ? 340 : dims.w;
    const targetH = isMinimized ? 260 : dims.h;

    const cols = Math.ceil(targetW / actualDotGap);
    const rows = Math.ceil(targetH / actualDotGap);
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

            // Global pulse for breathing - toned down the aggressive flashing
            const pulseAmount = timer.finished ? 0.15 * Math.sin(time / 400) : 0.05 * Math.sin(time / 800);
            const globalPulse = (timer.finished ? 0.8 : 0.95) + pulseAmount;

            // Use bands for performance
            const bands = 7;
            const paths = Array.from({ length: bands }, () => new Path2D());

            // Center of the screen for radial waves
            const cx = dims.w / 2;
            const cy = dims.h / 2;

            const gridW = cols * actualDotGap;
            const gridH = rows * actualDotGap;
            const offsetX = (dims.w - gridW) / 2;
            const offsetY = (dims.h - gridH) / 2;

            // clamp draw count bounds in case smoothed count is drastically larger during layout transition
            const safeDrawCount = Math.min(total, drawCount);

            for (let i = 0; i < safeDrawCount; i++) {
                const col = i % cols;
                const row = Math.floor(i / cols);
                const x = offsetX + col * actualDotGap + (actualDotGap - DOT_D) / 2;
                const y = offsetY + row * actualDotGap + (actualDotGap - DOT_D) / 2;

                // Create an interesting path movement / breathing feel
                // Distance from center
                const dx = x - cx;
                const dy = y - cy;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // A slow, gentle radial wave that breathes outward
                const wave = Math.sin(dist / 120 - time / 1000);

                // Add a gentle diagonal sweep to make it feel like "passage of time"
                const sweep = Math.sin((x + y) / 200 + time / 1500);

                // Combine them for an organic topographic feel
                const heat = (wave + sweep) * 0.5;

                // Base intensity 0.3, wave adds up to 0.7
                let intensity = 0.3 + ((heat + 1) / 2) * 0.7;

                // Highlight the "leading edge" of the timer dots
                const distFromFront = drawCount - i;
                if (!timer.paused && !timer.finished && distFromFront < cols * 2) {
                    intensity = Math.max(intensity, 0.8 + 0.2 * Math.sin(time / 200 + col * 0.1));
                }

                if (timer.paused && !timer.finished) {
                    intensity = 0.2 + ((heat + 1) / 2) * 0.3; // Dim down when paused, still breathing
                }

                const bandIndex = Math.min(bands - 1, Math.floor(clamp01(intensity) * bands));

                // Slightly vary size based on the breathing wave for extra tactility
                const sizeOffset = timer.paused ? 0 : heat * 0.5;
                const baseIdleD = isMinimized ? 4.5 : DOT_D_IDLE;
                const baseD = isMinimized ? 5.5 : DOT_D;
                const drawSize = (timer.paused && !timer.finished ? baseIdleD : baseD) + sizeOffset;

                paths[bandIndex].rect(x - sizeOffset / 2, y - sizeOffset / 2, drawSize, drawSize);
            }

            for (let b = 0; b < bands; b++) {
                // Opacity scales non-linearly to make the brighter parts pop
                const normalizedBand = (b + 1) / bands;
                let alpha = Math.pow(normalizedBand, 1.5) * globalPulse;

                if (timer.finished) {
                    // Flashier when done
                    alpha *= 1.2;
                }

                ctx.globalAlpha = clamp01(alpha);
                ctx.fillStyle = `rgb(${vividRgb.r}, ${vividRgb.g}, ${vividRgb.b})`;
                ctx.fill(paths[b]);
            }

            if (!timer.paused || timer.finished) {
                animationFrameId = requestAnimationFrame(render);
            }
        };

        if (timer.paused && !timer.finished) {
            // Render one frame for paused
            render(performance.now());
        } else {
            animationFrameId = requestAnimationFrame(render);
        }

        return () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [dims, litCount, isDanger, timer.active, timer.paused, timer.finished, cols, rows, actualDotGap, total, isPictureInPictureOpen]);

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
            if (event.key.toLowerCase() === 'm') {
                event.preventDefault();
                toggleTimerMinimized();
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
                        `0 0 ${6 * sizeScale}px ${accentColor}`,
                        `0 0 ${12 * sizeScale}px ${accentColor}`,
                        `0 0 ${6 * sizeScale}px ${accentColor}`
                    ]
                } : {
                    scale: 1,
                    textShadow: `0 0 ${4 * sizeScale}px ${accentColor}`
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

            {!isMinimized && (
                <>
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
                </>
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
                            onToggleMinimize={toggleTimerMinimized}
                            isMinimized={isMinimized}
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
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{
                            opacity: 1,
                            scale: 1,
                            ...(isMinimized ? {
                                top: 'auto',
                                bottom: 24,
                                left: 'auto',
                                right: 24,
                                width: 340,
                                height: 260,
                                borderRadius: 32,
                                boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                            } : {
                                top: 0,
                                bottom: 0,
                                left: 0,
                                right: 0,
                                width: '100%',
                                height: '100%',
                                borderRadius: 0,
                                boxShadow: 'none',
                            })
                        }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        style={{
                            position: 'fixed',
                            zIndex: 8000,
                            overflow: 'hidden',
                            // use absolute inset for non-minimized if needed, but framer-motion overrides it via top/bottom/left/right properties
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
                            width={dims.w} // keep full window dimensions for smooth transitions
                            height={dims.h}
                            style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
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
                            paddingBottom: isMinimized ? 44 : 0,
                            zIndex: 10,
                            pointerEvents: 'none',
                        }}>
                            <ClockView sizeScale={isMinimized ? 0.65 : 1} />
                        </div>

                        {/* 4. Controls HUD (Floating corner or bottom) */}
                        <div
                            style={{
                                position: 'absolute',
                                bottom: isMinimized ? 16 : 48,
                                right: isMinimized ? '50%' : 48,
                                transform: isMinimized ? 'translateX(50%) scale(0.85)' : 'none',
                                zIndex: 20,
                                pointerEvents: 'auto',
                                transformOrigin: 'bottom center',
                                transition: 'all 0.4s ease',
                            }}
                        >
                            <TimerHUD
                                isDanger={isDanger}
                                paused={timer.paused}
                                onPauseResume={timer.paused ? resumeTimer : pauseTimer}
                                onStop={stopTimer}
                                onTogglePIP={handleTogglePictureInPicture}
                                onToggleMinimize={toggleTimerMinimized}
                                isMinimized={isMinimized}
                                isPIP={false}
                                pipSupported={isPictureInPictureSupported}
                                shortcutsEnabled={!isMinimized}
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
    onToggleMinimize,
    isMinimized,
    isPIP,
    pipSupported,
    shortcutsEnabled,
}: {
    isDanger: boolean;
    paused: boolean;
    onPauseResume: () => void;
    onStop: () => void;
    onTogglePIP: () => void;
    onToggleMinimize?: () => void;
    isMinimized?: boolean;
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
            background: isMinimized ? 'rgba(10, 14, 20, 0.4)' : 'rgba(10, 14, 20, 0.72)',
            backdropFilter: 'blur(40px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: isMinimized ? 20 : 24,
            padding: isMinimized ? '6px 8px' : '10px 12px',
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
                        width: isMinimized ? 44 : 'auto',
                        borderRadius: 14,
                        padding: isMinimized ? 0 : '0 18px',
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        transition: 'background 0.2s, color 0.2s',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                    }}
                    title={paused ? 'Resume (Space)' : 'Pause (Space)'}
                >
                    {paused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
                    {!isMinimized && (paused ? 'Resume' : 'Pause')}
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

                {/* Minimize Button */}
                {onToggleMinimize && !isPIP && (
                    <motion.button
                        whileHover={{ scale: 1.06, backgroundColor: 'rgba(255,255,255,0.14)' }}
                        whileTap={{ scale: 0.94 }}
                        onClick={onToggleMinimize}
                        style={{
                            background: 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            color: 'rgba(255,255,255,0.85)',
                            width: 44,
                            height: 44,
                            borderRadius: 14,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                        }}
                        title={isMinimized ? 'Fullscreen (M)' : 'Minimize (M)'}
                    >
                        {isMinimized ? <Maximize2 size={18} strokeWidth={2.2} /> : <Minimize2 size={18} strokeWidth={2.2} />}
                    </motion.button>
                )}

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
                        width: isMinimized ? 44 : 'auto',
                        borderRadius: 14,
                        padding: isMinimized ? 0 : '0 16px',
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        transition: 'all 0.2s',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                    }}
                    title='Stop timer (Esc)'
                >
                    <Square size={14} fill="currentColor" />
                    {!isMinimized && 'Stop'}
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
                    Space Pause • Esc Stop • M Min/Max • P PIP
                </div>
            )}
        </div>
    );
}
