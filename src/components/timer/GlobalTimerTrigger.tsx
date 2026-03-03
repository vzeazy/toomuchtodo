import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';

const DEFAULT_BLOCK = 1800; // 30 min
const MAX_BLOCK = 7200;     // 120 min
const MIN_BLOCK = 300;      // 5 min
const SNAP_SECS = 300;

// Physical track dimensions
const TRACK_H = 400; // px — actual usable drag height
const TRACK_TOP_OFFSET = TRACK_H / 2; // track is vertically centered (top: 50vh - TRACK_TOP_OFFSET)

const MARKERS = [
    { secs: 300, label: '5m' },
    { secs: 900, label: '15m' },
    { secs: 1800, label: '30m' },
    { secs: 3600, label: '1h' },
    { secs: 5400, label: '1.5h' },
    { secs: 7200, label: '2h' },
];

function snapDuration(secs: number) {
    return Math.max(MIN_BLOCK, Math.min(MAX_BLOCK, Math.round(secs / SNAP_SECS) * SNAP_SECS));
}

// Piecewise: 5m-30m = bottom-half, 30m-2h = top-half
function durationToProgress(secs: number): number {
    secs = Math.max(MIN_BLOCK, Math.min(MAX_BLOCK, secs));
    if (secs <= 1800) {
        return ((secs - 300) / 1500) * 0.5;
    }
    return 0.5 + ((secs - 1800) / 5400) * 0.5;
}

function progressToDuration(p: number): number {
    p = Math.max(0, Math.min(1, p));
    if (p <= 0.5) return 300 + (p / 0.5) * 1500;
    return 1800 + ((p - 0.5) / 0.5) * 5400;
}

function formatMins(secs: number) {
    if (secs >= 3600) {
        const h = Math.floor(secs / 3600);
        const m = Math.round((secs % 3600) / 60);
        return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    return `${Math.round(secs / 60)}m`;
}

export function GlobalTimerTrigger() {
    const { timer, startTimer, stopTimer } = useAppStore();
    const [dragDuration, setDragDuration] = useState(DEFAULT_BLOCK);
    const [isDragging, setIsDragging] = useState(false);
    const [isCanceling, setIsCanceling] = useState(false);
    const trackRef = useRef<HTMLDivElement>(null);

    // progress 0 = bottom (5m), progress 1 = top (2h)
    const progress = durationToProgress(dragDuration);

    // Grabber top position inside the track div (progress=1 → top=0, progress=0 → top=TRACK_H)
    const grabberTop = (1 - progress) * TRACK_H;

    const getProgressFromEvent = useCallback((e: React.PointerEvent) => {
        const track = trackRef.current;
        if (!track) return 0.5;
        const rect = track.getBoundingClientRect();
        // p=1 at top of rect, p=0 at bottom
        const p = 1 - (e.clientY - rect.top) / rect.height;
        return Math.max(0, Math.min(1, p));
    }, []);

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        setIsDragging(true);
        setIsCanceling(false);
        // Snap immediately to where user clicked
        const p = getProgressFromEvent(e);
        setDragDuration(snapDuration(progressToDuration(p)));
    }, [getProgressFromEvent]);

    const onPointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDragging) return;
        const track = trackRef.current;
        if (!track) return;
        const rect = track.getBoundingClientRect();
        // Cancel zone: significantly below the track bottom
        if (e.clientY > rect.bottom + 60) {
            setIsCanceling(true);
            return;
        }
        setIsCanceling(false);
        const p = 1 - (e.clientY - rect.top) / rect.height;
        setDragDuration(snapDuration(progressToDuration(p)));
    }, [isDragging]);

    const onPointerUp = useCallback((e: React.PointerEvent) => {
        if (!isDragging) return;
        setIsDragging(false);
        if (isCanceling) {
            setIsCanceling(false);
            setDragDuration(DEFAULT_BLOCK);
            return;
        }
        startTimer(dragDuration);
        setDragDuration(DEFAULT_BLOCK);
    }, [isDragging, isCanceling, dragDuration, startTimer]);

    // While timer is active: show a minimal red strip (timer overlay handles the rest)
    if (timer.active) {
        return null; // GlobalTimerOverlay owns the UI when active
    }

    return (
        <>
            {/* Backdrop blur when dragging */}
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
                            background: 'rgba(0,0,0,0.25)',
                            backdropFilter: 'blur(8px)',
                            zIndex: 9000,
                            pointerEvents: 'none',
                        }}
                    />
                )}
            </AnimatePresence>

            {/* The drag track — vertically centered on screen, on the right edge */}
            <div
                ref={trackRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                style={{
                    position: 'fixed',
                    // Vertically center the track
                    top: `calc(50vh - ${TRACK_TOP_OFFSET}px)`,
                    right: 0,
                    width: isDragging ? 64 : 28,
                    height: TRACK_H,
                    zIndex: 9500,
                    cursor: isDragging ? 'ns-resize' : 'pointer',
                    touchAction: 'none',
                    transition: 'width 0.2s',
                    userSelect: 'none',
                }}
            >
                {/* Rail line (only when dragging) */}
                <AnimatePresence>
                    {isDragging && (
                        <motion.div
                            key="rail"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{
                                position: 'absolute',
                                right: 18,
                                top: 0,
                                bottom: 0,
                                width: 1.5,
                                background: 'rgba(255,255,255,0.08)',
                                borderRadius: 99,
                            }}
                        />
                    )}
                </AnimatePresence>

                {/* Markers (only when dragging) */}
                <AnimatePresence>
                    {isDragging && MARKERS.map((m) => {
                        const mp = durationToProgress(m.secs);
                        const mt = (1 - mp) * TRACK_H;
                        const isActive = dragDuration >= m.secs;
                        return (
                            <motion.div
                                key={m.secs}
                                initial={{ opacity: 0, x: 8 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 8 }}
                                transition={{ delay: 0.05 }}
                                style={{
                                    position: 'absolute',
                                    right: 0,
                                    top: mt,
                                    transform: 'translateY(-50%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    pointerEvents: 'none',
                                }}
                            >
                                <span style={{
                                    fontSize: 9,
                                    fontWeight: 800,
                                    color: isActive ? 'var(--accent)' : 'rgba(255,255,255,0.2)',
                                    fontFamily: '"IBM Plex Mono", monospace',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.1em',
                                    transition: 'color 0.2s, text-shadow 0.2s',
                                    textShadow: isActive ? '0 0 8px var(--accent)' : 'none',
                                    whiteSpace: 'nowrap',
                                }}>
                                    {m.label}
                                </span>
                                <div style={{
                                    width: isActive ? 10 : 5,
                                    height: 1.5,
                                    borderRadius: 1,
                                    background: isActive ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
                                    transition: 'all 0.2s',
                                }} />
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                {/* Grabber dot — positioned absolutely inside the track */}
                <motion.div
                    animate={{ top: isDragging ? grabberTop : TRACK_H / 2 }}
                    transition={{ type: 'spring', damping: 28, stiffness: 340, mass: 0.4 }}
                    style={{
                        position: 'absolute',
                        right: 10,
                        // top set by animate above
                        transform: 'translateY(-50%)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        pointerEvents: 'none',
                    }}
                >
                    {/* The circle */}
                    <div style={{
                        width: isDragging ? 14 : 8,
                        height: isDragging ? 14 : 8,
                        borderRadius: '50%',
                        background: isCanceling ? 'var(--danger)' : 'var(--accent)',
                        boxShadow: isDragging
                            ? `0 0 16px ${isCanceling ? 'var(--danger)' : 'var(--accent)'}, 0 0 40px ${isCanceling ? 'var(--danger)' : 'var(--accent)'}40`
                            : '0 2px 8px rgba(0,0,0,0.3)',
                        transition: 'width 0.15s, height 0.15s, background 0.2s, box-shadow 0.2s',
                        flexShrink: 0,
                    }} />
                    {/* Short horizontal tail */}
                    <div style={{
                        width: isDragging ? 24 : 12,
                        height: 2,
                        borderRadius: 1,
                        background: isCanceling ? 'var(--danger)' : 'var(--accent)',
                        opacity: isDragging ? 0.8 : 0.4,
                        transition: 'width 0.2s, opacity 0.2s, background 0.2s',
                    }} />
                </motion.div>
            </div>

            {/* HUD: Duration display to the left of the track */}
            <AnimatePresence>
                {isDragging && (
                    <motion.div
                        key="hud"
                        initial={{ opacity: 0, scale: 0.9, x: 10 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.9, x: 10 }}
                        style={{
                            position: 'fixed',
                            // Vertically follow the grabber
                            top: `calc(50vh - ${TRACK_TOP_OFFSET}px + ${grabberTop}px)`,
                            right: 76,
                            transform: 'translateY(-50%)',
                            zIndex: 9600,
                            pointerEvents: 'none',
                            transition: 'top 0s', // animate top via framer-motion separately below
                        }}
                    >
                        <div style={{
                            background: 'rgba(12, 12, 12, 0.92)',
                            backdropFilter: 'blur(20px)',
                            border: `1px solid ${isCanceling ? 'var(--danger)' : 'rgba(255,255,255,0.1)'}`,
                            borderRadius: 18,
                            padding: '12px 22px',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            minWidth: 120,
                            transition: 'border-color 0.2s',
                        }}>
                            {isCanceling ? (
                                <span style={{
                                    color: 'var(--danger)',
                                    fontWeight: 800,
                                    fontSize: 12,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.12em',
                                }}>
                                    Cancel
                                </span>
                            ) : (
                                <>
                                    <span style={{
                                        fontFamily: '"IBM Plex Mono", monospace',
                                        fontSize: 32,
                                        fontWeight: 800,
                                        color: '#fff',
                                        letterSpacing: '-0.04em',
                                        lineHeight: 1,
                                    }}>
                                        {formatMins(dragDuration)}
                                    </span>
                                    <span style={{
                                        fontSize: 9,
                                        color: 'rgba(255,255,255,0.35)',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.12em',
                                        marginTop: 6,
                                    }}>
                                        Set Timer · Release
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
