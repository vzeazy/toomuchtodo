import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer as TimerIcon } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

const DEFAULT_BLOCK = 1800; // 30 min
const MAX_BLOCK = 7200; // 2 hours

function snapDuration(secs: number) {
    if (secs <= 3600) {
        // under an hour, snap to 5 mins
        return Math.max(300, Math.round(secs / 300) * 300);
    }
    // over an hour, snap to 15 mins
    return Math.min(MAX_BLOCK, Math.round(secs / 900) * 900);
}

export function TaskTimerDot({ taskId, taskTitle }: { taskId: string, taskTitle: string }) {
    const { startTimer, stopTimer, timer } = useAppStore();

    const [isDragging, setIsDragging] = useState(false);
    const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });
    const [dragDuration, setDragDuration] = useState(DEFAULT_BLOCK);

    // Track distance to distinguish click vs. intentional drag
    const startPosRef = useRef({ x: 0, y: 0 });
    const maxDistRef = useRef(0);

    const isActiveForTask = timer.active && timer.linkedTaskId === taskId;
    const isActive = timer.active;

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        if (isActiveForTask) { stopTimer(); return; }
        if (isActive) return;

        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        startPosRef.current = { x: e.clientX, y: e.clientY };
        maxDistRef.current = 0;
        setCurrentPos({ x: 0, y: 0 });
        setIsDragging(true);
        setDragDuration(DEFAULT_BLOCK);
    }, [isActiveForTask, isActive, stopTimer]);

    const onPointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDragging) return;
        e.stopPropagation();

        const dx = e.clientX - startPosRef.current.x;
        const dy = e.clientY - startPosRef.current.y;

        setCurrentPos({ x: dx, y: dy });
        const dist = Math.sqrt(dx * dx + dy * dy);
        maxDistRef.current = Math.max(maxDistRef.current, dist);

        // Increase time linearly with distance, max at dist = ~250px
        if (dist > 20) {
            const extra = ((dist - 20) / 250) * MAX_BLOCK;
            const snapped = snapDuration(extra);
            setDragDuration(Math.max(300, Math.min(MAX_BLOCK, snapped))); // Clamp 5m to 2h
        } else {
            setDragDuration(DEFAULT_BLOCK);
        }
    }, [isDragging]);

    const onPointerUp = useCallback((e: React.PointerEvent) => {
        if (!isDragging) return;
        e.stopPropagation();
        setIsDragging(false);

        const dist = Math.sqrt(currentPos.x * currentPos.x + currentPos.y * currentPos.y);

        if (maxDistRef.current < 15) {
            // Under drag threshold -> treat as simple click
            startTimer(DEFAULT_BLOCK, taskId, taskTitle);
        } else {
            // Intentional drag
            if (dist < 20) {
                // Dragged out but scrubbed back to origin -> cancel intention
                // Do nothing
            } else {
                startTimer(dragDuration, taskId, taskTitle);
            }
        }

        setCurrentPos({ x: 0, y: 0 });
    }, [isDragging, currentPos, dragDuration, taskId, taskTitle, startTimer]);

    const onPointerCancel = useCallback((e: React.PointerEvent) => {
        e.stopPropagation();
        setIsDragging(false);
        setCurrentPos({ x: 0, y: 0 });
    }, []);

    // Hide for other tasks if one is running
    if (isActive && !isActiveForTask) return null;

    const dist = Math.sqrt(currentPos.x * currentPos.x + currentPos.y * currentPos.y);
    const angle = Math.atan2(currentPos.y, currentPos.x);

    const isIntentionalDrag = isDragging && maxDistRef.current >= 15;
    const isCancelingDrag = isIntentionalDrag && dist < 20;

    const dotColor = isActiveForTask
        ? 'var(--accent)'
        : isCancelingDrag
            ? 'var(--danger)'
            : 'var(--text-muted)';

    const activeColor = isCancelingDrag ? 'var(--danger)' : 'var(--accent)';

    return (
        <div
            draggable
            onDragStart={e => { e.preventDefault(); e.stopPropagation(); }}
            style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
            onClick={e => e.stopPropagation()}
        >
            {/* ── DRAG VISUALS ── */}
            {isIntentionalDrag && (
                <div style={{ position: 'absolute', left: '50%', top: '50%', zIndex: 9999, pointerEvents: 'none' }}>

                    {/* The elastic stretch line */}
                    <motion.div
                        animate={{ width: dist, rotate: angle * (180 / Math.PI) }}
                        transition={{ type: 'spring', damping: 30, stiffness: 450, mass: 0.5 }}
                        style={{
                            position: 'absolute', left: 0, top: 0,
                            height: 2.5,
                            background: `linear-gradient(90deg, transparent 0%, ${activeColor} 30%, ${activeColor} 100%)`,
                            transformOrigin: '0% 50%',
                            translateY: '-50%',
                            borderRadius: 99,
                            opacity: isCancelingDrag ? 0.3 : 0.75,
                            zIndex: 1, // Stay beneath pill
                        }}
                    />

                    {/* The floating timer pill */}
                    <motion.div
                        animate={{ x: currentPos.x, y: currentPos.y }}
                        transition={{ type: 'spring', damping: 25, stiffness: 400, mass: 0.5 }}
                        style={{ position: 'absolute', left: 0, top: 0, zIndex: 2 }}
                    >
                        <motion.div
                            animate={{ scale: isCancelingDrag ? 0.85 : 1 }}
                            transition={{ duration: 0.15 }}
                            style={{
                                transform: 'translate(-50%, -50%)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'rgba(20, 20, 24, 0.95)',
                                backdropFilter: 'blur(12px)',
                                color: '#ffffff',
                                border: `1px solid ${isCancelingDrag ? 'rgba(255,50,50,0.3)' : 'rgba(255,255,255,0.08)'}`,
                                borderRadius: 99,
                                padding: '6px 14px',
                                fontWeight: 700,
                                fontFamily: '"IBM Plex Mono", monospace',
                                fontSize: 13,
                                boxShadow: `0 8px 32px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.03)`,
                                textShadow: isCancelingDrag ? '0 0 10px rgba(255,50,50,0.5)' : 'none',
                            }}
                        >
                            <TimerIcon size={14} strokeWidth={2.5} style={{ marginRight: 6, color: activeColor, transition: 'color 0.2s' }} />
                            <span style={{ color: isCancelingDrag ? 'var(--danger)' : '#ffffff', transition: 'color 0.2s' }}>
                                {isCancelingDrag ? 'CANCEL' : `${Math.round(dragDuration / 60)}m`}
                            </span>
                        </motion.div>
                    </motion.div>
                </div>
            )}

            {/* ── STATIONARY TRIGGER DOT ── */}
            <div
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerCancel}
                title={isActiveForTask ? 'Stop timer' : 'Start timer'}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: isActiveForTask || isIntentionalDrag ? 18 : 14,
                    height: isActiveForTask || isIntentionalDrag ? 18 : 14,
                    color: isActiveForTask ? 'var(--app-bg)' : dotColor,
                    backgroundColor: isActiveForTask ? dotColor : (isIntentionalDrag ? 'currentColor' : 'transparent'),
                    borderRadius: '50%',
                    cursor: isDragging ? 'grabbing' : 'pointer',
                    flexShrink: 0,
                    transition: 'width 0.15s, height 0.15s, color 0.15s, background-color 0.15s, opacity 0.15s',
                    touchAction: 'none',
                    animation: isActiveForTask ? 'timerPulse 1.8s ease-in-out infinite' : 'none',
                    opacity: isActiveForTask || isDragging || isCancelingDrag ? 1 : 0.6,
                    position: 'relative',
                    zIndex: 10,
                }}
            >
                <TimerIcon
                    size={isActiveForTask || isIntentionalDrag ? 12 : 11}
                    strokeWidth={isActiveForTask || isIntentionalDrag ? 3 : 2.5}
                />
            </div>

            {/* ── ACTIVE PIP BADGE ── */}
            {isActiveForTask && (
                <span
                    style={{
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
