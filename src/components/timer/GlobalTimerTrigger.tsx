import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer as TimerIcon } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

// ─── Scale constants ───────────────────────────────────────────────────────────
const MIN_BLOCK = 60;    // 1 min
const MAX_BLOCK = 7200;  // 2 h
const TRACK_H = 480;     // physical drag height in px

// Three-segment piecewise scale:
//   Segment A: 1m – 10m  → progress 0.00 – 0.25  (dense zone for fine control)
//   Segment B: 10m – 30m → progress 0.25 – 0.50
//   Segment C: 30m – 2h  → progress 0.50 – 1.00
function durationToProgress(secs: number): number {
    secs = Math.max(MIN_BLOCK, Math.min(MAX_BLOCK, secs));
    if (secs <= 600) return ((secs - 60) / 540) * 0.25;
    if (secs <= 1800) return 0.25 + ((secs - 600) / 1200) * 0.25;
    return 0.5 + ((secs - 1800) / 5400) * 0.5;
}

function progressToDuration(p: number): number {
    p = Math.max(0, Math.min(1, p));
    if (p <= 0.25) return 60 + (p / 0.25) * 540;
    if (p <= 0.5) return 600 + ((p - 0.25) / 0.25) * 1200;
    return 1800 + ((p - 0.5) / 0.5) * 5400;
}

// ─── Magnetic snap ─────────────────────────────────────────────────────────────
// Major snaps: hardcoded "gravity wells". Snap radius scales with duration.
const MAJOR_SNAP_POINTS = [60, 300, 600, 900, 1200, 1800, 2700, 3600, 5400, 7200];
function snapRadius(secs: number) {
    if (secs <= 120) return 25;   // 25s  near 1m
    if (secs <= 600) return 45;   // 45s  near 5m & 10m
    if (secs <= 1800) return 90;  // 90s  near 15m, 20m, 30m
    return 150;                   // 2.5m near 45m, 1h, 1.5h, 2h
}

function smartSnap(raw: number): number {
    raw = Math.max(MIN_BLOCK, Math.min(MAX_BLOCK, raw));
    // Magnetic pull
    for (const major of MAJOR_SNAP_POINTS) {
        if (Math.abs(raw - major) <= snapRadius(major)) return major;
    }
    // Fine-grain fallback: 1-min below 10m, 5-min otherwise
    if (raw <= 600) return Math.round(raw / 60) * 60;
    return Math.round(raw / 300) * 300;
}

// ─── Tick definitions ──────────────────────────────────────────────────────────
type TickStyle = 'major' | 'minor' | 'micro';
interface Tick { secs: number; label: string | null; style: TickStyle; }

const TICKS: Tick[] = [
    // 1-min granularity from 1–10m
    { secs: 60, label: '1m', style: 'minor' },
    { secs: 120, label: null, style: 'micro' },
    { secs: 180, label: null, style: 'micro' },
    { secs: 240, label: null, style: 'micro' },
    { secs: 300, label: '5m', style: 'major' },
    { secs: 360, label: null, style: 'micro' },
    { secs: 420, label: null, style: 'micro' },
    { secs: 480, label: null, style: 'micro' },
    { secs: 540, label: null, style: 'micro' },
    { secs: 600, label: '10m', style: 'major' },
    // 5-min from 10–30m
    { secs: 900, label: '15m', style: 'major' },
    { secs: 1200, label: '20m', style: 'minor' },
    { secs: 1500, label: '25m', style: 'micro' },
    { secs: 1800, label: '30m', style: 'major' },
    // 15-min from 30m–2h
    { secs: 2700, label: '45m', style: 'minor' },
    { secs: 3600, label: '1h', style: 'major' },
    { secs: 5400, label: '1.5h', style: 'minor' },
    { secs: 7200, label: '2h', style: 'major' },
];

function formatLabel(secs: number) {
    if (secs >= 3600) {
        const h = Math.floor(secs / 3600);
        const m = Math.round((secs % 3600) / 60);
        return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    return `${Math.round(secs / 60)}m`;
}

// ─── Component ─────────────────────────────────────────────────────────────────
export function GlobalTimerTrigger() {
    const { timer, startTimer } = useAppStore();
    const [dragDuration, setDragDuration] = useState(1800); // default 30m
    const [isDragging, setIsDragging] = useState(false);
    const [isCanceling, setIsCanceling] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const trackRef = useRef<HTMLDivElement>(null);

    // Progress and pixel position of the grabber inside the track div
    const progress = durationToProgress(dragDuration);
    const grabberTop = (1 - progress) * TRACK_H; // px from top of track

    // Absolute screen Y of the grabber (for HUD positioning)
    const trackTopPx = typeof window !== 'undefined' ? window.innerHeight / 2 - TRACK_H / 2 : 0;
    const grabberScreenY = trackTopPx + grabberTop;

    const getProgressFromEvent = useCallback((e: PointerEvent | React.PointerEvent) => {
        const track = trackRef.current;
        if (!track) return 0.5;
        const rect = track.getBoundingClientRect();
        return 1 - (e.clientY - rect.top) / rect.height;
    }, []);

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        setIsDragging(true);
        setIsCanceling(false);
        const p = getProgressFromEvent(e);
        setDragDuration(smartSnap(progressToDuration(p)));
    }, [getProgressFromEvent]);

    const onPointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDragging) return;
        const track = trackRef.current;
        if (!track) return;
        const rect = track.getBoundingClientRect();
        if (e.clientY > rect.bottom + 60) {
            setIsCanceling(true);
            return;
        }
        setIsCanceling(false);
        const p = 1 - (e.clientY - rect.top) / rect.height;
        setDragDuration(smartSnap(progressToDuration(p)));
    }, [isDragging]);

    const onPointerUp = useCallback((_e: React.PointerEvent) => {
        if (!isDragging) return;
        setIsDragging(false);
        if (isCanceling) {
            setIsCanceling(false);
            setDragDuration(1800);
            return;
        }
        startTimer(dragDuration);
        setDragDuration(1800);
    }, [isDragging, isCanceling, dragDuration, startTimer]);

    // Hide the trigger while timer is active (overlay owns the screen)
    if (timer.active) return null;

    const accentColor = 'var(--accent)';

    return (
        <>
            {/* Backdrop blur during drag */}
            <AnimatePresence>
                {isDragging && (
                    <motion.div
                        key="backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.3)',
                            backdropFilter: 'blur(10px)',
                            zIndex: 9000,
                            pointerEvents: 'none',
                        }}
                    />
                )}
            </AnimatePresence>

            {/* ── The drag track ─────────────────────────────────────────── */}
            <div
                ref={trackRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onPointerEnter={() => setIsHovered(true)}
                onPointerLeave={() => setIsHovered(false)}
                style={{
                    position: 'fixed',
                    top: `calc(50vh - ${TRACK_H / 2}px)`,
                    right: 0,
                    width: isDragging ? 100 : (isHovered ? 32 : 24),
                    height: TRACK_H,
                    zIndex: 9500,
                    cursor: isDragging ? 'ns-resize' : 'grab',
                    touchAction: 'none',
                    userSelect: 'none',
                    transition: 'width 0.18s ease',
                }}
            >
                {/* Vertical rail */}
                <AnimatePresence>
                    {isDragging && (
                        <motion.div
                            key="rail"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{
                                position: 'absolute',
                                right: 20,
                                top: 0,
                                bottom: 0,
                                width: 1,
                                background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.08) 15%, rgba(255,255,255,0.08) 85%, transparent)',
                            }}
                        />
                    )}
                </AnimatePresence>

                {/* ── Ticks ──────────────────────────────────────────────── */}
                <AnimatePresence>
                    {isDragging && TICKS.map((tick) => {
                        const tp = durationToProgress(tick.secs);
                        const tickTop = (1 - tp) * TRACK_H;
                        const isActive = dragDuration >= tick.secs;
                        const isCurrent = dragDuration === tick.secs;

                        // Style variants
                        const isMajor = tick.style === 'major';
                        const isMinor = tick.style === 'minor';

                        const dashW = isMajor ? 18 : isMinor ? 12 : 6;
                        const dotH = isMajor ? 2.5 : isMinor ? 2 : 1.5;
                        const labelOpacity = isMajor ? 1 : isMinor ? 0.75 : 0;
                        const labelSize = isMajor ? 11 : 9;
                        const activeColor = isCanceling ? 'var(--danger)' : accentColor;

                        return (
                            <motion.div
                                key={tick.secs}
                                initial={{ opacity: 0, x: 6 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 6 }}
                                transition={{ delay: 0.03, duration: 0.12 }}
                                style={{
                                    position: 'absolute',
                                    right: 16, // Pad from edge
                                    top: tickTop,
                                    pointerEvents: 'none',
                                }}
                            >
                                {/* Tick mark / dot */}
                                <div style={{
                                    position: 'absolute',
                                    right: 0,
                                    top: 0,
                                    transform: 'translateY(-50%)',
                                    width: isActive ? dashW : Math.max(3, dashW * 0.5),
                                    height: dotH,
                                    borderRadius: 99,
                                    background: isActive
                                        ? (isCanceling ? 'rgba(255,100,100,0.7)' : activeColor)
                                        : 'rgba(255,255,255,0.18)',
                                    transition: 'width 0.15s, height 0.15s, background 0.15s',
                                    boxShadow: (isActive && isMajor) ? `0 0 8px ${activeColor}` : 'none',
                                }} />

                                {/* Label */}
                                {tick.label && (
                                    <span style={{
                                        position: 'absolute',
                                        right: dashW + 8, // Anchor right side next to the tick
                                        top: 0,
                                        transform: 'translateY(-50%)',
                                        fontSize: labelSize,
                                        fontWeight: isMajor ? 800 : 700,
                                        fontFamily: '"IBM Plex Mono", monospace',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.07em',
                                        whiteSpace: 'nowrap',
                                        transition: 'color 0.15s, text-shadow 0.15s',
                                        color: isActive
                                            ? (isCanceling ? 'rgba(255,100,100,0.9)' : 'rgba(255,255,255,0.95)')
                                            : 'rgba(255,255,255,0.35)',
                                        textShadow: (isActive && isMajor)
                                            ? `0 0 10px ${activeColor}`
                                            : 'none',
                                        opacity: labelOpacity,
                                    }}>
                                        {tick.label}
                                    </span>
                                )}
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                {/* ── Grabber ────────────────────────────────────────────── */}
                <div
                    style={{
                        position: 'absolute',
                        right: 0,
                        top: isDragging ? grabberTop : TRACK_H / 2,
                        pointerEvents: 'none',
                        transition: isDragging
                            ? 'none'
                            : 'top 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    }}
                >
                    <motion.div
                        animate={{
                            width: isDragging ? 44 : (isHovered ? 32 : 24),
                            height: isDragging ? 44 : (isHovered ? 68 : 56),
                            borderRadius: isDragging ? '22px' : '14px 0 0 14px',
                            right: isDragging ? 52 : 0,
                            background: isDragging
                                ? (isCanceling ? 'var(--danger)' : accentColor)
                                : (isHovered ? 'rgba(40,40,40,0.85)' : 'rgba(20,20,20,0.6)'),
                            border: isDragging
                                ? '1px solid transparent'
                                : `1px solid rgba(255,255,255,${isHovered ? 0.15 : 0.06})`,
                            borderRightWidth: 0,
                            boxShadow: isDragging
                                ? `0 0 24px ${isCanceling ? 'var(--danger)' : accentColor}60`
                                : `0 4px 12px rgba(0,0,0,0.${isHovered ? 4 : 2})`,
                            color: isDragging
                                ? 'var(--app-bg, #000)'
                                : (isHovered ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)'),
                        }}
                        transition={{
                            duration: 0.2, // Smooth layout animations
                        }}
                        style={{
                            position: 'absolute',
                            top: 0,
                            transform: 'translateY(-50%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backdropFilter: 'blur(16px)',
                        }}
                    >
                        <TimerIcon size={isDragging ? 20 : (isHovered ? 16 : 14)} strokeWidth={isDragging ? 2.5 : 2} style={{ transition: 'all 0.2s' }} />
                    </motion.div>
                </div>
            </div>

            {/* ── Floating HUD — follows grabber, clamped to viewport ─────── */}
            <AnimatePresence>
                {isDragging && (
                    <motion.div
                        key="hud"
                        initial={{ opacity: 0, scale: 0.92, x: 10 }}
                        animate={{
                            opacity: 1,
                            scale: 1,
                            x: 0,
                            top: Math.max(16, Math.min(grabberScreenY - 36, window.innerHeight - 100)),
                        }}
                        exit={{ opacity: 0, scale: 0.92, x: 10 }}
                        transition={{
                            opacity: { duration: 0.15 },
                            scale: { duration: 0.15 },
                            top: { type: 'spring', damping: 30, stiffness: 320, mass: 0.4 },
                        }}
                        style={{
                            position: 'fixed',
                            right: 120,
                            zIndex: 9600,
                            pointerEvents: 'none',
                        }}
                    >
                        <div style={{
                            background: 'rgba(10,10,10,0.92)',
                            backdropFilter: 'blur(24px)',
                            border: `1px solid ${isCanceling ? 'rgba(255,80,80,0.35)' : 'rgba(255,255,255,0.09)'}`,
                            borderRadius: 16,
                            padding: '10px 20px',
                            minWidth: 110,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            boxShadow: '0 16px 40px rgba(0,0,0,0.55)',
                            transition: 'border-color 0.2s',
                        }}>
                            {isCanceling ? (
                                <span style={{
                                    color: 'var(--danger)',
                                    fontWeight: 800,
                                    fontSize: 11,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.1em',
                                }}>
                                    Cancel
                                </span>
                            ) : (
                                <>
                                    <span style={{
                                        fontFamily: '"IBM Plex Mono", monospace',
                                        fontSize: 30,
                                        fontWeight: 800,
                                        color: '#fff',
                                        letterSpacing: '-0.04em',
                                        lineHeight: 1,
                                    }}>
                                        {formatLabel(dragDuration)}
                                    </span>
                                    <span style={{
                                        fontSize: 8,
                                        color: 'rgba(255,255,255,0.3)',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.14em',
                                        marginTop: 5,
                                    }}>
                                        Release to start
                                    </span>
                                </>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
