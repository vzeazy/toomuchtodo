import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';

const DEFAULT_BLOCK = 1800; // 30 min
const MAX_BLOCK = 7200;     // 120 min
const MIN_BLOCK = 300;      // 5 min
const SNAP_SECS = 300;      // snap to 5-min intervals
const TRACK_HEIGHT = 320;   // px height of the drag track

function snapDuration(secs: number) {
    return Math.max(MIN_BLOCK, Math.min(MAX_BLOCK, Math.round(secs / SNAP_SECS) * SNAP_SECS));
}

function formatMins(secs: number) {
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
    const lastSnappedRef = useRef<number>(DEFAULT_BLOCK);

    // --- Drag logic (pointer events, no framer-motion drag) ---
    // NOTE: all hooks must be declared before any conditional return
    const onPointerDown = useCallback((e: React.PointerEvent) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        startYRef.current = e.clientY;
        setIsDragging(true);
        setExpanded(true);
        setDragDuration(DEFAULT_BLOCK);
        lastSnappedRef.current = DEFAULT_BLOCK;
        setIsCanceling(false);
    }, []);

    const onPointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDragging) return;
        const deltaY = startYRef.current - e.clientY; // positive = drag up

        // Drag up = increase time  |  drag down past start = cancel
        if (e.clientY - startYRef.current > 60) {
            setIsCanceling(true);
            return;
        }
        setIsCanceling(false);

        // Map deltaY [0 → TRACK_HEIGHT] → [DEFAULT_BLOCK → MAX_BLOCK]
        const extra = (deltaY / TRACK_HEIGHT) * (MAX_BLOCK - DEFAULT_BLOCK);
        const raw = DEFAULT_BLOCK + Math.max(0, extra);
        const snapped = snapDuration(raw);
        if (snapped !== lastSnappedRef.current) {
            // tiny haptic-like CSS flash
            lastSnappedRef.current = snapped;
        }
        setDragDuration(snapped);
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

        // check if it was just a tap (tiny movement)
        const movedY = Math.abs(startYRef.current - e.clientY);
        const movedX = Math.abs(e.clientX - (trackRef.current?.getBoundingClientRect().right ?? e.clientX));
        if (movedY < 10) {
            startTimer(DEFAULT_BLOCK);
        } else {
            startTimer(dragDuration);
        }
        setDragDuration(DEFAULT_BLOCK);
    }, [isDragging, isCanceling, dragDuration, startTimer]);

    const progress = (dragDuration - DEFAULT_BLOCK) / (MAX_BLOCK - DEFAULT_BLOCK); // 0–1

    // If timer is active, show a minimal stop button on the edge instead
    if (timer.active) {
        return (
            <button
                onClick={stopTimer}
                title="Stop timer"
                style={{
                    position: 'fixed',
                    top: '50%',
                    right: 0,
                    transform: 'translateY(-50%)',
                    zIndex: 9500,
                    height: 48,
                    width: 6,
                    background: 'var(--danger)',
                    border: 'none',
                    borderRadius: '4px 0 0 4px',
                    cursor: 'pointer',
                    opacity: 0.7,
                    transition: 'opacity 0.2s, width 0.2s',
                    padding: 0,
                }}
                onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.opacity = '1';
                    (e.currentTarget as HTMLButtonElement).style.width = '20px';
                }}
                onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.opacity = '0.7';
                    (e.currentTarget as HTMLButtonElement).style.width = '6px';
                }}
            />
        );
    }

    return (
        <>
            {/* The edge sliver — always present, flush right */}
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
                    width: expanded ? 56 : 6,
                    height: expanded ? TRACK_HEIGHT : 56,
                    background: expanded
                        ? 'color-mix(in srgb, var(--accent) 14%, var(--panel-bg))'
                        : 'color-mix(in srgb, var(--accent) 70%, transparent)',
                    borderRadius: expanded ? '12px 0 0 12px' : '3px 0 0 3px',
                    cursor: isDragging ? 'grabbing' : 'grab',
                    touchAction: 'none',
                    transition: 'width 0.22s cubic-bezier(.4,0,.2,1), height 0.22s cubic-bezier(.4,0,.2,1), border-radius 0.22s, background 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    overflow: 'hidden',
                    boxShadow: expanded
                        ? '-4px 0 24px rgba(0,0,0,0.3), inset 1px 0 0 rgba(255,255,255,0.06)'
                        : '-2px 0 12px rgba(0,0,0,0.2)',
                    userSelect: 'none',
                }}
            >
                {/* Progress fill inside track */}
                {expanded && (
                    <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: `${progress * 100}%`,
                        background: `linear-gradient(to top, var(--accent), color-mix(in srgb, var(--accent) 40%, transparent))`,
                        borderRadius: '12px 12px 0 0',
                        transition: 'height 0.1s',
                        opacity: 0.5,
                    }} />
                )}

                {/* Grip lines */}
                {!expanded && (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        opacity: 0.6,
                    }}>
                        {[0, 1, 2].map(i => (
                            <div key={i} style={{ width: 2, height: 2, borderRadius: 1, background: 'white' }} />
                        ))}
                    </div>
                )}
            </div>

            {/* Floating duration label — appears while dragging */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        key="label"
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 12 }}
                        transition={{ duration: 0.18 }}
                        style={{
                            position: 'fixed',
                            top: '50%',
                            right: 72,
                            transform: 'translateY(-50%)',
                            zIndex: 9600,
                            pointerEvents: 'none',
                            background: 'color-mix(in srgb, var(--panel-bg) 92%, transparent)',
                            border: `1px solid ${isCanceling ? 'var(--danger)' : 'var(--accent)'}`,
                            borderRadius: 12,
                            padding: '10px 18px',
                            backdropFilter: 'blur(16px)',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 4,
                        }}
                    >
                        {isCanceling ? (
                            <span style={{ color: 'var(--danger)', fontWeight: 700, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                Cancel
                            </span>
                        ) : (
                            <>
                                <span style={{
                                    fontFamily: '"IBM Plex Mono", monospace',
                                    fontSize: 22,
                                    fontWeight: 700,
                                    color: 'var(--text-primary)',
                                    letterSpacing: '-0.02em',
                                }}>
                                    {formatMins(dragDuration)}
                                </span>
                                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                    {isDragging ? 'drag up for more' : 'tap or drag'}
                                </span>
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
