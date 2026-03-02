import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';

// Dots grid size in px (diameter + gap)
const DOT_D = 3;
const DOT_GAP = 8; // center-to-center spacing

export function GlobalTimerOverlay() {
    const { timer, tickTimer, pauseTimer, resumeTimer, stopTimer } = useAppStore();
    const [dims, setDims] = useState({ w: window.innerWidth, h: window.innerHeight });

    // Timer tick
    useEffect(() => {
        if (!timer.active || timer.paused) return;
        const id = window.setInterval(() => tickTimer(), 500);
        return () => clearInterval(id);
    }, [timer.active, timer.paused, tickTimer]);

    // Track viewport
    useEffect(() => {
        const onResize = () => setDims({ w: window.innerWidth, h: window.innerHeight });
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    if (!timer.active) return null;

    const cols = Math.floor(dims.w / DOT_GAP);
    const rows = Math.floor(dims.h / DOT_GAP);
    const total = cols * rows;

    // fraction of time ELAPSED (not remaining) — dots light up as time passes
    const elapsed = timer.duration - timer.remaining;
    const fraction = timer.duration > 0 ? Math.max(0, Math.min(1, elapsed / timer.duration)) : 0;
    const litCount = Math.floor(fraction * total);

    // Once < 10% remaining, shift to danger colour
    const remainFraction = timer.duration > 0 ? timer.remaining / timer.duration : 0;
    const isDanger = remainFraction < 0.1 && timer.active;

    // Format counter
    const mins = Math.floor(timer.remaining / 60);
    const secs = timer.remaining % 60;
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

    const dotColor = isDanger ? 'var(--danger)' : 'var(--accent)';

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 8000,
                overflow: 'hidden',
            }}
        >
            {/* SVG dot grid — most performant for static many-dot layout */}
            <svg
                width={dims.w}
                height={dims.h}
                style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: timer.paused ? undefined : 0.4,
                    animation: timer.paused ? 'timerBreathe 2.2s ease-in-out infinite' : undefined,
                }}
            >
                {Array.from({ length: litCount }).map((_, i) => {
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
                            fill={dotColor}
                        />
                    );
                })}
            </svg>

            {/* Floating corner HUD — pointer-events on so user can click */}
            <div
                style={{ position: 'absolute', bottom: 28, right: 28, pointerEvents: 'auto' }}
            >
                <TimerHUD
                    timeStr={timeStr}
                    isDanger={isDanger}
                    paused={timer.paused}
                    linkedTaskId={timer.linkedTaskId}
                    tasks={[]} // passed separately if needed
                    onPauseResume={timer.paused ? resumeTimer : pauseTimer}
                    onStop={stopTimer}
                />
            </div>
        </div>
    );
}

function TimerHUD({
    timeStr,
    isDanger,
    paused,
    onPauseResume,
    onStop,
}: {
    timeStr: string;
    isDanger: boolean;
    paused: boolean;
    linkedTaskId: string | null;
    tasks: any[];
    onPauseResume: () => void;
    onStop: () => void;
}) {
    const [hovered, setHovered] = useState(false);

    const accentColor = isDanger ? 'var(--danger)' : 'var(--accent)';

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: 'color-mix(in srgb, var(--panel-bg) 88%, transparent)',
                border: `1px solid color-mix(in srgb, ${accentColor} 40%, var(--border-color))`,
                borderRadius: 999,
                padding: '7px 16px 7px 12px',
                boxShadow: `0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px color-mix(in srgb, ${accentColor} 12%, transparent)`,
                backdropFilter: 'blur(16px)',
                cursor: 'default',
                transition: 'all 0.2s',
                userSelect: 'none',
            }}
        >
            {/* Pulse dot */}
            <div style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                backgroundColor: accentColor,
                flexShrink: 0,
                animation: paused ? 'none' : 'timerPulse 1.8s ease-in-out infinite',
                opacity: paused ? 0.4 : 1,
            }} />

            {/* Time */}
            <span style={{
                fontFamily: '"IBM Plex Mono", "Fira Mono", monospace',
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: '0.05em',
                color: isDanger ? 'var(--danger)' : 'var(--text-primary)',
                minWidth: '4ch',
                transition: 'color 0.4s',
            }}>
                {timeStr}
            </span>

            {/* Action buttons — slide in on hover */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                overflow: 'hidden',
                maxWidth: hovered ? 80 : 0,
                opacity: hovered ? 1 : 0,
                transition: 'max-width 0.25s, opacity 0.2s',
            }}>
                <div style={{ width: 1, height: 14, background: 'var(--border-color)', marginRight: 2 }} />
                {/* Pause / Resume */}
                <button
                    onClick={onPauseResume}
                    title={paused ? 'Resume' : 'Pause'}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                    {paused ? '▶' : '⏸'}
                </button>
                {/* Stop / Cancel */}
                <button
                    onClick={onStop}
                    title="Cancel timer"
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                    ✕
                </button>
            </div>
        </div>
    );
}
