import React, { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Timer as TimerIcon } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

const DEFAULT_BLOCK = 1800; // 30 min
const MIN_DRAG_BLOCK = 300; // 5 min
const MAX_BLOCK = 7200; // 2 hours
const DRAG_THRESHOLD = 12;
const TRACK_EDGE_PADDING = 18;
const TRACK_BOTTOM_OFFSET = 7;
const TRACK_TICKS = [
  { seconds: 300, label: '5' },
  { seconds: 600, label: '10' },
  { seconds: 900, label: '15' },
  { seconds: 1200, label: '20' },
  { seconds: 1800, label: '30' },
  { seconds: 2700, label: '45' },
  { seconds: 3600, label: '60' },
  { seconds: 5400, label: '90' },
  { seconds: 7200, label: '120' },
];
const TRACK_SEGMENTS = [
  { start: 300, end: 900, progressStart: 0, progressEnd: 0.22 },
  { start: 900, end: 1800, progressStart: 0.22, progressEnd: 0.52 },
  { start: 1800, end: 3600, progressStart: 0.52, progressEnd: 0.82 },
  { start: 3600, end: 7200, progressStart: 0.82, progressEnd: 1 },
] as const;

function snapDuration(secs: number) {
  if (secs <= 3600) {
    return Math.max(MIN_DRAG_BLOCK, Math.round(secs / 300) * 300);
  }

  return Math.min(MAX_BLOCK, Math.round(secs / 900) * 900);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function progressToDuration(progress: number) {
  const clamped = clamp(progress, 0, 1);
  const segment = TRACK_SEGMENTS.find(({ progressStart, progressEnd }) => clamped <= progressEnd) ?? TRACK_SEGMENTS[TRACK_SEGMENTS.length - 1];
  const span = segment.progressEnd - segment.progressStart || 1;
  const segmentProgress = clamp((clamped - segment.progressStart) / span, 0, 1);
  return snapDuration(segment.start + segmentProgress * (segment.end - segment.start));
}

function durationToProgress(seconds: number) {
  const clamped = clamp(seconds, MIN_DRAG_BLOCK, MAX_BLOCK);
  const segment = TRACK_SEGMENTS.find(({ start, end }) => clamped <= end) ?? TRACK_SEGMENTS[TRACK_SEGMENTS.length - 1];
  const span = segment.end - segment.start || 1;
  const durationProgress = clamp((clamped - segment.start) / span, 0, 1);
  return segment.progressStart + durationProgress * (segment.progressEnd - segment.progressStart);
}

type DragContext = {
  rowElement: HTMLElement;
  rowRect: DOMRect;
  triggerCenterX: number;
  trackWidth: number;
};

export function TaskTimerDot({ taskId, taskTitle }: { taskId: string; taskTitle: string }) {
  const { startTimer, stopTimer, timer } = useAppStore();

  const [isDragging, setIsDragging] = useState(false);
  const [leftPull, setLeftPull] = useState(0);
  const [dragDuration, setDragDuration] = useState(DEFAULT_BLOCK);
  const [dragContext, setDragContext] = useState<DragContext | null>(null);

  const startPosRef = useRef({ x: 0, y: 0 });
  const maxPullRef = useRef(0);

  const isActiveForTask = timer.active && timer.linkedTaskId === taskId;
  const isActive = timer.active;

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    if (isActiveForTask) {
      stopTimer();
      return;
    }
    if (isActive) return;

    const rowElement = event.currentTarget.closest('[data-task-row="true"]') as HTMLElement | null;
    if (!rowElement) return;

    const rowRect = rowElement.getBoundingClientRect();
    const triggerRect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const triggerCenterX = triggerRect.left + triggerRect.width / 2 - rowRect.left;
    const trackWidth = Math.max(56, triggerCenterX - TRACK_EDGE_PADDING);

    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    startPosRef.current = { x: event.clientX, y: event.clientY };
    maxPullRef.current = 0;
    setDragContext({ rowElement, rowRect, triggerCenterX, trackWidth });
    setLeftPull(0);
    setDragDuration(MIN_DRAG_BLOCK);
    setIsDragging(true);
  }, [isActive, isActiveForTask, stopTimer]);

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    if (!isDragging || !dragContext) return;

    event.stopPropagation();
    const dx = event.clientX - startPosRef.current.x;
    const nextPull = clamp(-dx, 0, dragContext.trackWidth);

    maxPullRef.current = Math.max(maxPullRef.current, nextPull);
    setLeftPull(nextPull);

    const usableTrack = Math.max(1, dragContext.trackWidth - DRAG_THRESHOLD);
    const effectivePull = Math.max(0, nextPull - DRAG_THRESHOLD);
    const progress = effectivePull / usableTrack;
    const nextDuration = progressToDuration(progress);
    setDragDuration(nextDuration);
  }, [dragContext, isDragging]);

  const resetDrag = useCallback(() => {
    setIsDragging(false);
    setLeftPull(0);
    setDragDuration(DEFAULT_BLOCK);
    setDragContext(null);
  }, []);

  const onPointerUp = useCallback((event: React.PointerEvent) => {
    if (!isDragging) return;

    event.stopPropagation();
    const shouldStartDefault = maxPullRef.current < DRAG_THRESHOLD;
    const shouldStartDragged = leftPull >= DRAG_THRESHOLD;

    if (shouldStartDefault) {
      startTimer(DEFAULT_BLOCK, taskId, taskTitle);
    } else if (shouldStartDragged) {
      startTimer(dragDuration, taskId, taskTitle);
    }

    resetDrag();
  }, [dragDuration, isDragging, leftPull, resetDrag, startTimer, taskId, taskTitle]);

  const onPointerCancel = useCallback((event: React.PointerEvent) => {
    event.stopPropagation();
    resetDrag();
  }, [resetDrag]);

  if (isActive && !isActiveForTask) return null;

  const isIntentionalDrag = isDragging && maxPullRef.current >= DRAG_THRESHOLD;
  const progress = dragContext
    ? clamp(Math.max(0, leftPull - DRAG_THRESHOLD) / Math.max(1, dragContext.trackWidth - DRAG_THRESHOLD), 0, 1)
    : 0;
  const indicatorX = dragContext ? dragContext.triggerCenterX - leftPull : 0;

  return (
    <div
      draggable
      onDragStart={(event) => { event.preventDefault(); event.stopPropagation(); }}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
      onClick={(event) => event.stopPropagation()}
    >
      {dragContext && createPortal(
        <AnimatePresence>
          {isDragging && (
            <motion.div
              key="task-timer-track"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14, ease: 'easeOut' }}
              className="pointer-events-none absolute inset-0 z-30"
            >
              <div
                className="absolute inset-x-3 rounded-[18px]"
                style={{
                  bottom: 0,
                  top: 0,
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.015) 0%, rgba(255,255,255,0) 65%)',
                }}
              />

              <div
                className="absolute"
                style={{
                  left: TRACK_EDGE_PADDING,
                  right: Math.max(TRACK_EDGE_PADDING, dragContext.rowRect.width - dragContext.triggerCenterX),
                  bottom: TRACK_BOTTOM_OFFSET,
                  height: 1,
                  background: 'linear-gradient(90deg, color-mix(in srgb, var(--accent) 16%, transparent) 0%, color-mix(in srgb, var(--accent) 55%, transparent) 100%)',
                  opacity: 0.95,
                }}
              />

              <motion.div
                animate={{ width: Math.max(leftPull, isIntentionalDrag ? 10 : 0) }}
                transition={{ type: 'spring', stiffness: 460, damping: 34, mass: 0.45 }}
                className="absolute"
                style={{
                  right: dragContext.rowRect.width - dragContext.triggerCenterX,
                  bottom: TRACK_BOTTOM_OFFSET - 1,
                  height: 3,
                  borderRadius: 999,
                  background: 'linear-gradient(90deg, color-mix(in srgb, var(--accent) 32%, transparent) 0%, var(--accent) 72%, color-mix(in srgb, white 18%, var(--accent)) 100%)',
                  boxShadow: '0 0 20px color-mix(in srgb, var(--accent) 24%, transparent)',
                  transformOrigin: '100% 50%',
                }}
              />

              {TRACK_TICKS.map((tick) => {
                const ratio = durationToProgress(tick.seconds);
                const x = dragContext.triggerCenterX - ratio * dragContext.trackWidth;
                const isReached = dragDuration >= tick.seconds;
                const isMajor = tick.seconds === 900 || tick.seconds === DEFAULT_BLOCK || tick.seconds === 3600 || tick.seconds === 7200;

                return (
                  <div
                    key={tick.seconds}
                    className="absolute"
                    style={{
                      left: x,
                      bottom: TRACK_BOTTOM_OFFSET - 2,
                      width: 0,
                      height: 26,
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: -0.5,
                        bottom: 0,
                        width: 1,
                        height: isMajor ? 10 : 7,
                        borderRadius: 999,
                        background: isReached
                          ? 'color-mix(in srgb, var(--accent) 85%, white 15%)'
                          : 'color-mix(in srgb, var(--text-muted) 45%, transparent)',
                        opacity: isReached ? 0.95 : 0.7,
                        transition: 'background-color 0.18s ease, opacity 0.18s ease, height 0.18s ease',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        left: -12,
                        bottom: 12,
                        width: 24,
                        textAlign: 'center',
                        fontFamily: '"IBM Plex Mono", monospace',
                        fontSize: 9,
                        letterSpacing: '0.08em',
                        color: isReached
                          ? 'color-mix(in srgb, var(--accent) 78%, white 22%)'
                          : 'color-mix(in srgb, var(--text-muted) 82%, transparent)',
                        opacity: isIntentionalDrag || tick.seconds === DEFAULT_BLOCK ? 1 : 0.66,
                        transition: 'color 0.18s ease, opacity 0.18s ease',
                      }}
                    >
                      {tick.label}
                    </div>
                  </div>
                );
              })}

              <motion.div
                animate={{
                  x: indicatorX,
                  y: 0,
                  scale: isIntentionalDrag ? 1 : 0.94,
                  opacity: isDragging ? 1 : 0,
                }}
                transition={{ type: 'spring', stiffness: 430, damping: 28, mass: 0.5 }}
                className="absolute"
                style={{ left: 0, bottom: TRACK_BOTTOM_OFFSET }}
              >
                <div
                  style={{
                    transform: 'translate(-50%, -18px)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    borderRadius: 999,
                    padding: '5px 11px',
                    background: 'color-mix(in srgb, var(--panel-bg) 86%, black 14%)',
                    border: '1px solid color-mix(in srgb, var(--accent) 22%, rgba(255,255,255,0.06))',
                    boxShadow: '0 10px 28px rgba(0,0,0,0.35)',
                    backdropFilter: 'blur(12px)',
                    color: 'var(--text-primary)',
                    fontFamily: '"IBM Plex Mono", monospace',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                  }}
                >
                  <TimerIcon size={12} strokeWidth={2.2} style={{ color: 'var(--accent)' }} />
                  <span>{Math.round(dragDuration / 60)}m</span>
                </div>
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    bottom: -1,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    transform: 'translate(-50%, 50%)',
                    background: 'color-mix(in srgb, var(--accent) 92%, white 8%)',
                    boxShadow: `0 0 0 5px color-mix(in srgb, var(--accent) ${18 + progress * 20}%, transparent), 0 0 22px color-mix(in srgb, var(--accent) 32%, transparent)`,
                  }}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        dragContext.rowElement
      )}

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        title={isActiveForTask ? 'Stop timer' : 'Start timer'}
        className={(!isActiveForTask && !isIntentionalDrag) ? 'rounded-full p-1 transition-colors hover:bg-[var(--panel-alt-bg)] text-[var(--text-muted)] hover:text-[var(--text-primary)]' : ''}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isActiveForTask ? 'var(--app-bg)' : (isIntentionalDrag ? 'transparent' : undefined),
          backgroundColor: isActiveForTask ? 'var(--accent)' : 'transparent',
          borderRadius: isActiveForTask ? '50%' : undefined,
          width: isActiveForTask ? 24 : undefined,
          height: isActiveForTask ? 24 : undefined,
          cursor: isDragging ? 'grabbing' : 'pointer',
          flexShrink: 0,
          transition: 'width 0.15s, height 0.15s, color 0.15s, background-color 0.15s, opacity 0.15s, border-radius 0.15s',
          touchAction: 'none',
          animation: isActiveForTask ? 'timerPulse 1.8s ease-in-out infinite' : 'none',
          opacity: isIntentionalDrag ? 0.12 : 1,
          position: 'relative',
          zIndex: 10,
        }}
      >
        <TimerIcon size={isActiveForTask ? 14 : 15} strokeWidth={isActiveForTask ? 3 : 1.5} />
      </div>

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
          onClick={(event) => { event.stopPropagation(); stopTimer(); }}
          title="Stop timer"
        >
          {Math.floor(timer.remaining / 60)}:{(timer.remaining % 60).toString().padStart(2, '0')}
        </span>
      )}
    </div>
  );
}
