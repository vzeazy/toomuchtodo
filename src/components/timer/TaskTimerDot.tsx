import React, { useState, useRef, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';

const DEFAULT_BLOCK = 1800; // 30 min
const MAX_BLOCK = 7200;
const SNAP_SECS = 300;

function snapDuration(secs: number) {
    return Math.max(300, Math.min(MAX_BLOCK, Math.round(secs / SNAP_SECS) * SNAP_SECS));
}

export function TaskTimerDot({ taskId }: { taskId: string }) {
    const { startTimer, stopTimer, timer } = useAppStore();
    const [isDragging, setIsDragging] = useState(false);
    const [dragDuration, setDragDuration] = useState(DEFAULT_BLOCK);
    const [isCanceling, setIsCanceling] = useState(false);
    const [showLabel, setShowLabel] = useState(false);
    const startXRef = useRef(0);
    const startYRef = useRef(0);

    const isActiveForTask = timer.active && timer.linkedTaskId === taskId;
    const isActive = timer.active; // A timer is running (possibly for another task)

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        // If this task's timer is running, clicking stops it
        if (isActiveForTask) {
            stopTimer();
            return;
        }
        // If another timer is running, do nothing (or maybe block)
        if (isActive) return;

        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        startXRef.current = e.clientX;
        startYRef.current = e.clientY;
        setIsDragging(true);
        setDragDuration(DEFAULT_BLOCK);
        setIsCanceling(false);
        setShowLabel(true);
    }, [isActiveForTask, isActive, stopTimer]);

    const onPointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDragging) return;
        e.stopPropagation();
        const deltaX = e.clientX - startXRef.current; // right = more time
        const deltaY = e.clientY - startYRef.current; // down = cancel

        if (deltaY > 50) {
            setIsCanceling(true);
            return;
        }
        setIsCanceling(false);

        const extra = (Math.max(0, deltaX) / 200) * (MAX_BLOCK - DEFAULT_BLOCK);
        const snapped = snapDuration(DEFAULT_BLOCK + extra);
        setDragDuration(snapped);
    }, [isDragging]);

    const onPointerUp = useCallback((e: React.PointerEvent) => {
        if (!isDragging) return;
        e.stopPropagation();
        setIsDragging(false);
        setShowLabel(false);

        if (isCanceling) {
            setIsCanceling(false);
            return;
        }

        const deltaX = e.clientX - startXRef.current;
        const deltaY = e.clientY - startYRef.current;
        const moved = Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10;

        if (moved) {
            startTimer(dragDuration, taskId);
        } else {
            startTimer(DEFAULT_BLOCK, taskId);
        }
        setDragDuration(DEFAULT_BLOCK);
    }, [isDragging, isCanceling, dragDuration, taskId, startTimer]);

    // Hide dot entirely if the timer is active for a different task
    if (isActive && !isActiveForTask) return null;

    const dotColor = isActiveForTask
        ? 'var(--accent)'
        : isCanceling
            ? 'var(--danger)'
            : 'var(--text-muted)';

    return (
        <div
            style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
            onClick={e => e.stopPropagation()}
        >
            {/* The dot */}
            <div
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                title={isActiveForTask ? 'Stop timer' : 'Start timer (drag right = custom time)'}
                style={{
                    width: isActiveForTask || isDragging ? 10 : 7,
                    height: isActiveForTask || isDragging ? 10 : 7,
                    borderRadius: 999,
                    backgroundColor: dotColor,
                    cursor: isDragging ? 'grabbing' : 'pointer',
                    flexShrink: 0,
                    transition: 'width 0.15s, height 0.15s, background-color 0.2s',
                    touchAction: 'none',
                    animation: isActiveForTask ? 'timerPulse 1.8s ease-in-out infinite' : 'none',
                }}
            />

            {/* Drag label */}
            {showLabel && (
                <div style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginBottom: 8,
                    padding: '4px 10px',
                    background: 'var(--elevated-bg)',
                    border: `1px solid ${isCanceling ? 'var(--danger)' : 'var(--accent)'}`,
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 700,
                    color: isCanceling ? 'var(--danger)' : 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    zIndex: 9999,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                    fontFamily: '"IBM Plex Mono", monospace',
                }}>
                    {isCanceling ? 'cancel' : `${Math.round(dragDuration / 60)}m`}
                </div>
            )}

            {/* Active time badge */}
            {isActiveForTask && (
                <span style={{
                    marginLeft: 6,
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--accent)',
                    fontFamily: '"IBM Plex Mono", monospace',
                    letterSpacing: '0.03em',
                    cursor: 'pointer',
                }}
                    onClick={e => { e.stopPropagation(); stopTimer(); }}
                    title="Stop timer"
                >
                    {Math.floor(timer.remaining / 60)}:{(timer.remaining % 60).toString().padStart(2, '0')}
                </span>
            )}
        </div>
    );
}
