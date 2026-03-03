import React, { useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';

const DEFAULT_BLOCK = 1800; // 30 min
const MAX_BLOCK = 7200;     // 120 min
const MIN_BLOCK = 300;      // 5 min
const SNAP_SECS = 300;      // snap to 5-min intervals
const TRACK_HEIGHT = 480;   // px height of the drag track

const MARKERS = [
    { secs: 300, label: '5m' },
    { secs: 900, label: '15m' },
    { secs: 1800, label: '30m' },
    { secs: 3600, label: '1h' },
    { secs: 5400, label: '1.5h' },
    { secs: 7200, label: '2h' }
];

function snapDuration(secs: number) {
    return Math.max(MIN_BLOCK, Math.min(MAX_BLOCK, Math.round(secs / SNAP_SECS) * SNAP_SECS));
}

function formatMins(secs: number) {
    if (secs >= 3600) {
        const h = Math.floor(secs / 3600);
        const m = Math.round((secs % 3600) / 60);
        return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    const m = Math.round(secs / 60);
    return `${m}m`;
}

export function GlobalTimerTrigger() {
    const { timer, startTimer, stopTimer } = useAppStore();
    const [expanded, setExpanded] = useState(false);
    const [dragDuration, setDragDuration] = useState(DEFAULT_BLOCK);
    const [isDragging, setIsDragging] = useState(false);
    const [isCanceling, setIsCanceling] = useState(false);
    const trackRef = useRef<HTMLDivElement>(null);
    const startYRef = useRef<number>(0);
    const startDurationRef = useRef<number>(DEFAULT_BLOCK);

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        startYRef.current = e.clientY;
        startDurationRef.current = DEFAULT_BLOCK;
        setIsDragging(true);
        setExpanded(true);
        setDragDuration(DEFAULT_BLOCK);
        setIsCanceling(false);
    }, []);

    const onPointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDragging) return;

        // Relative drag logic: map pixels to seconds
        // We want dragging up to increase time.
        const deltaY = startYRef.current - e.clientY; // positive = drag up

        // Map deltaY pixels to seconds. 
        // Let's say 400 pixels = full range of MAX_BLOCK - MIN_BLOCK
        const pxPerSec = (TRACK_HEIGHT * 0.8) / (MAX_BLOCK - MIN_BLOCK);
        const extraSecs = deltaY / pxPerSec;

        let raw = startDurationRef.current + extraSecs;
        raw = Math.max(MIN_BLOCK, Math.min(MAX_BLOCK, raw));
        const snapped = snapDuration(raw);

        setDragDuration(snapped);

        // Cancel if dragging far down (pull-to-cancel)
        if (e.clientY - startYRef.current > 120) {
            setIsCanceling(true);
        } else {
            setIsCanceling(false);
        }
    }, [isDragging]);

    const onPointerUp = useCallback((e: React.PointerEvent) => {
        if (!isDragging) return;
        setIsDragging(false);
        setExpanded(false);

        if (isCanceling) {
            setIsCanceling(false);
            setDragDuration(DEFAULT_BLOCK);
            return;
        }

        const movedY = Math.abs(startYRef.current - e.clientY);
        if (movedY < 10) {
            startTimer(DEFAULT_BLOCK);
        } else {
            startTimer(dragDuration);
        }
        setDragDuration(DEFAULT_BLOCK);
    }, [isDragging, isCanceling, dragDuration, startTimer]);

    // Progress for visual placement of the grabber.
    // 0 = bottom (MIN_BLOCK), 1 = top (MAX_BLOCK)
    const progress = (dragDuration - MIN_BLOCK) / (MAX_BLOCK - MIN_BLOCK);

    if (timer.active) {
        return (
            <motion.button
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={stopTimer}
                title="Stop timer"
                style={{
                    position: 'fixed',
                    top: '50%',
                    right: 0,
                    transform: 'translateY(-50%)',
                    zIndex: 9500,
                    height: 60,
                    width: 4,
                    background: 'var(--danger)',
                    border: 'none',
                    borderRadius: '4px 0 0 4px',
                    cursor: 'pointer',
                    padding: 0,
                    boxShadow: '0 0 15px var(--danger)',
                }}
                whileHover={{ width: 12, opacity: 1 }}
            />
        );
    }

    return (
        <>
            {/* The Trigger "Horizontal Pin" */}
            <div
                ref={trackRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                style={{
                    position: 'fixed',
                    top: '50%',
                    right: 0,
                    transform: 'translateY(-50%)',
                    zIndex: 9500,
                    width: isDragging ? 120 : 40,
                    height: isDragging ? TRACK_HEIGHT : 80,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    cursor: isDragging ? 'grabbing' : 'pointer',
                    touchAction: 'none',
                    // Using a container to hold the markers relative to the track
                }}
            >
                {/* Horizontal Grabber Element */}
                <motion.div
                    animate={{
                        y: isDragging ? -(progress - 0.5) * (TRACK_HEIGHT - 60) : 0,
                        x: isDragging ? -10 : 0,
                        backgroundColor: isCanceling ? 'var(--danger)' : 'transparent',
                    }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300, mass: 0.5 }}
                    style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0,
                        paddingRight: 0,
                    }}
                >
                    {/* Circle at the LEFT end */}
                    <div
                        style={{
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            backgroundColor: isCanceling ? '#fff' : 'var(--accent)',
                            boxShadow: isDragging
                                ? `0 0 20px ${isCanceling ? 'var(--danger)' : 'var(--accent)'}`
                                : '0 4px 12px rgba(0,0,0,0.2)',
                            zIndex: 10,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: isCanceling ? 'var(--danger)' : '#fff', opacity: 1 }} />
                    </div>

                    {/* Horizontal Line extending to the right */}
                    <motion.div
                        animate={{
                            width: isDragging ? 32 : 16,
                            opacity: isDragging ? 0.8 : 0.4
                        }}
                        style={{
                            height: 2,
                            background: isCanceling ? '#fff' : 'var(--accent)',
                            borderRadius: 1,
                        }}
                    />
                </motion.div>
            </div>

            {/* Backdrop Blur Overlay during Drag */}
            <AnimatePresence>
                {isDragging && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.2)',
                            backdropFilter: 'blur(8px)',
                            zIndex: 9000,
                            pointerEvents: 'none',
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Time Markers along the edge — perfectly mapped to progress */}
            <AnimatePresence>
                {isDragging && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        style={{
                            position: 'fixed',
                            top: '50%',
                            right: 4,
                            transform: 'translateY(-50%)',
                            height: TRACK_HEIGHT - 60,
                            zIndex: 9400,
                            pointerEvents: 'none',
                        }}
                    >
                        {MARKERS.map((m) => {
                            const markerProgress = (m.secs - MIN_BLOCK) / (MAX_BLOCK - MIN_BLOCK);
                            const isActive = dragDuration >= m.secs;
                            // markerProgress goes from 0 (bottom) to 1 (top)
                            return (
                                <motion.div
                                    key={m.secs}
                                    style={{
                                        position: 'absolute',
                                        // bottom: 0 is MIN_BLOCK, bottom: TRACK_HEIGHT-60 is MAX_BLOCK
                                        bottom: markerProgress * (TRACK_HEIGHT - 60),
                                        right: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                    }}
                                >
                                    <span style={{
                                        fontSize: 9,
                                        lineHeight: 1,
                                        fontWeight: 800,
                                        color: isActive ? 'var(--accent)' : 'rgba(255,255,255,0.2)',
                                        fontFamily: '"IBM Plex Mono", monospace',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.1em',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        textShadow: isActive ? '0 0 8px var(--accent)' : 'none',
                                    }}>
                                        {m.label}
                                    </span>
                                    <div style={{
                                        width: isActive ? 12 : 6,
                                        height: 1.5,
                                        borderRadius: 1,
                                        background: isActive ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    }} />
                                </motion.div>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Floating duration label / HUD */}
            <AnimatePresence>
                {isDragging && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, x: 10 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.9, x: 10 }}
                        style={{
                            position: 'fixed',
                            top: '50%',
                            right: 90,
                            transform: 'translateY(-50%)',
                            zIndex: 9600,
                            pointerEvents: 'none',
                        }}
                    >
                        <div style={{
                            background: 'rgba(15, 15, 15, 0.9)',
                            backdropFilter: 'blur(20px)',
                            border: `1px solid ${isCanceling ? 'var(--danger)' : 'rgba(255,255,255,0.1)'}`,
                            borderRadius: 20,
                            padding: '16px 28px',
                            boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            minWidth: 140,
                        }}>
                            {isCanceling ? (
                                <span style={{ color: 'var(--danger)', fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                                    Pull to Cancel
                                </span>
                            ) : (
                                <>
                                    <span style={{
                                        fontFamily: '"IBM Plex Mono", monospace',
                                        fontSize: 36,
                                        fontWeight: 700,
                                        color: '#fff',
                                        letterSpacing: '-0.03em',
                                        lineHeight: 1
                                    }}>
                                        {formatMins(dragDuration)}
                                    </span>
                                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 8 }}>
                                        Setting Timer
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
