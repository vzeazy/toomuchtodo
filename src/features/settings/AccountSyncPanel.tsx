import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Cloud, Copy, Download, LogIn, RefreshCw, ShieldCheck, UserPlus } from 'lucide-react';
import { copyTextToClipboard } from '../../lib/clipboard';
import { AuthSession } from '../../lib/sync/authClient';
import { SyncMeta } from '../../types';
import { getPasswordPolicyMessage, validatePasswordPolicy } from '../../../shared/passwordPolicy';

export interface AccountSyncPanelProps {
  authSession: AuthSession | null;
  syncMeta: SyncMeta;
  syncStatus: string;
  onRefreshSession: () => Promise<void>;
  onSignIn: (email: string, password: string, turnstileToken?: string | null) => Promise<void>;
  onSignUp: (email: string, password: string, turnstileToken?: string | null) => Promise<void>;
  onSignOut: () => Promise<void>;
  onToggleCloudLinked: (enabled: boolean) => void;
  onRunSyncNow: () => Promise<void>;
  variant?: 'settings' | 'modal';
}

export const AccountSyncPanel: React.FC<AccountSyncPanelProps> = ({
  authSession,
  syncMeta,
  syncStatus,
  onRefreshSession,
  onSignIn,
  onSignUp,
  onSignOut,
  onToggleCloudLinked,
  onRunSyncNow,
  variant = 'settings',
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-up');
  const [authPending, setAuthPending] = useState<'sign-in' | 'sign-up' | 'refresh' | 'sign-out' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileReady, setTurnstileReady] = useState(false);
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | number | null>(null);

  const turnstileSiteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim();
  const turnstileEnabled = turnstileSiteKey.length > 0;
  const passwordValidation = validatePasswordPolicy(password);
  const canSubmitAuth = !!email.trim()
    && passwordValidation.valid
    && !authPending
    && (!turnstileEnabled || !!turnstileToken);
  const syncEnabledAndAuthed = syncMeta.cloudLinked && !!authSession;
  const syncDiagnosticsText = useMemo(() => JSON.stringify({
    status: syncStatus,
    deviceId: syncMeta.deviceId,
    syncCursor: syncMeta.syncCursor,
    pendingOps: syncMeta.pendingOps.length,
    schemaBlocked: syncMeta.schemaBlocked,
    settingsVersion: syncMeta.settingsVersion,
    lastSyncAt: syncMeta.lastSyncAt,
    lastSyncDiagnostics: syncMeta.lastSyncDiagnostics,
    lastConflicts: syncMeta.lastConflicts,
  }, null, 2), [syncMeta, syncStatus]);

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
  };

  const resetTurnstile = () => {
    const api = (window as Window & {
      turnstile?: {
        reset: (widgetId?: string | number) => void;
      };
    }).turnstile;
    if (api && turnstileWidgetIdRef.current !== null) api.reset(turnstileWidgetIdRef.current);
    setTurnstileToken(null);
  };

  const downloadSyncDiagnostics = () => {
    const blob = new Blob([syncDiagnosticsText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'too-much-to-do-sync-diagnostics.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!turnstileEnabled || authSession) return;

    let cancelled = false;
    const renderWidget = () => {
      const api = (window as Window & {
        turnstile?: {
          render: (container: HTMLElement, options: Record<string, unknown>) => string | number;
          reset: (widgetId?: string | number) => void;
          remove: (widgetId?: string | number) => void;
        };
      }).turnstile;

      if (!api || !turnstileContainerRef.current || turnstileWidgetIdRef.current !== null) return;

      turnstileWidgetIdRef.current = api.render(turnstileContainerRef.current, {
        sitekey: turnstileSiteKey,
        theme: 'dark',
        callback: (token: string) => {
          if (cancelled) return;
          setTurnstileToken(token);
          setTurnstileReady(true);
        },
        'expired-callback': () => {
          if (cancelled) return;
          setTurnstileToken(null);
          setTurnstileReady(true);
        },
        'error-callback': () => {
          if (cancelled) return;
          setTurnstileToken(null);
          setTurnstileReady(true);
        },
      });
      setTurnstileReady(true);
    };

    const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile-script="true"]');
    if (existing) {
      renderWidget();
    } else {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.turnstileScript = 'true';
      script.onload = () => {
        if (!cancelled) renderWidget();
      };
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      const api = (window as Window & {
        turnstile?: {
          remove: (widgetId?: string | number) => void;
        };
      }).turnstile;
      if (api && turnstileWidgetIdRef.current !== null) api.remove(turnstileWidgetIdRef.current);
      turnstileWidgetIdRef.current = null;
      setTurnstileToken(null);
      setTurnstileReady(false);
    };
  }, [authSession, turnstileEnabled, turnstileSiteKey]);

  const surfaceClass = variant === 'modal'
    ? 'space-y-4'
    : 'space-y-4';

  return (
    <div className={surfaceClass}>
      <div className="flex items-center justify-between">
        <div className="text-sm text-[var(--text-secondary)]">
          {!authSession && 'Sign in to sync tasks, projects, and settings across devices.'}
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--panel-alt-bg)] px-3 py-1">
          <div className="h-2 w-2 rounded-full bg-[var(--accent)]" />
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-primary)]">{syncStatus}</div>
        </div>
      </div>

      {!authSession ? (
        <div className="space-y-4 rounded-[22px] border border-[var(--border-color)] bg-[var(--panel-alt-bg)] p-4">
          <div className="inline-flex rounded-[18px] border border-[var(--border-color)] bg-[var(--panel-bg)] p-1">
            <button
              type="button"
              onClick={() => setAuthMode('sign-up')}
              className={`rounded-[14px] px-4 py-2 text-sm font-semibold transition ${authMode === 'sign-up' ? 'bg-[var(--accent)] text-[var(--accent-contrast)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            >
              Create account
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('sign-in')}
              className={`rounded-[14px] px-4 py-2 text-sm font-semibold transition ${authMode === 'sign-in' ? 'bg-[var(--accent)] text-[var(--accent-contrast)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            >
              Sign in
            </button>
          </div>

          <div className="grid gap-3">
            <label className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Email</div>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-[18px] border border-[var(--border-color)] bg-[var(--panel-bg)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--focus)]"
              />
            </label>
            <label className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Password</div>
                <div className={`text-[11px] ${passwordValidation.valid ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>
                  {passwordValidation.valid ? 'strong' : 'needs work'}
                </div>
              </div>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={authMode === 'sign-up' ? 'Create a strong password' : 'Enter your password'}
                className="w-full rounded-[18px] border border-[var(--border-color)] bg-[var(--panel-bg)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--focus)]"
              />
            </label>
          </div>

          <div className="grid gap-2 rounded-[18px] border border-[var(--border-color)] bg-[var(--panel-bg)] p-3 text-xs text-[var(--text-secondary)]">
            <div className="font-semibold text-[var(--text-primary)]">{getPasswordPolicyMessage()}</div>
            <div className={passwordValidation.minLengthMet ? 'text-[var(--accent)]' : ''}>• At least 12 characters</div>
            <div className={passwordValidation.hasUppercase ? 'text-[var(--accent)]' : ''}>• At least one uppercase letter</div>
            <div className={passwordValidation.hasLowercase ? 'text-[var(--accent)]' : ''}>• At least one lowercase letter</div>
            <div className={passwordValidation.hasNumber ? 'text-[var(--accent)]' : ''}>• At least one number</div>
          </div>

          {turnstileEnabled && (
            <div className="rounded-[18px] border border-[var(--border-color)] bg-[var(--panel-bg)] p-4">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Human check</div>
              <div ref={turnstileContainerRef} />
              <div className="mt-2 text-xs text-[var(--text-muted)]">
                {turnstileToken
                  ? 'Verification complete.'
                  : turnstileReady
                    ? 'Complete the verification challenge to continue.'
                    : 'Loading verification...'}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!canSubmitAuth}
              onClick={async () => {
                const nextMode = authMode;
                setAuthPending(nextMode);
                try {
                  if (nextMode === 'sign-in') {
                    await onSignIn(email.trim(), password, turnstileToken);
                    setMessage('Signed in successfully.');
                  } else {
                    await onSignUp(email.trim(), password, turnstileToken);
                    setMessage('Account created and syncing will start automatically.');
                  }
                } catch (error) {
                  setMessage(getErrorMessage(error, nextMode === 'sign-in' ? 'Sign in failed.' : 'Sign up failed.'));
                } finally {
                  resetTurnstile();
                  setAuthPending(null);
                }
              }}
              className="flex items-center gap-2 rounded-[16px] bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--accent-contrast)] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {authMode === 'sign-in' ? <LogIn size={15} /> : <UserPlus size={15} />}
              {authPending === authMode ? (authMode === 'sign-in' ? 'Signing in...' : 'Creating account...') : (authMode === 'sign-in' ? 'Sign in' : 'Create account')}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-[22px] border border-[var(--border-color)] bg-[var(--panel-alt-bg)] p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]">
              <ShieldCheck size={20} />
            </div>
            <div>
              <div className="text-[13px] font-semibold text-[var(--text-primary)]">Connected</div>
              <div className="text-[13px] text-[var(--text-secondary)]">{authSession.user.email}</div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!!authPending}
              onClick={async () => {
                setAuthPending('refresh');
                try {
                  await onRefreshSession();
                  setMessage('Session refreshed.');
                } catch (error) {
                  setMessage(getErrorMessage(error, 'Session refresh failed.'));
                } finally {
                  setAuthPending(null);
                }
              }}
              className="flex items-center gap-2 rounded-[16px] border border-[var(--border-color)] bg-[var(--panel-bg)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-55"
            >
              <RefreshCw size={15} className={authPending === 'refresh' ? 'animate-spin' : ''} />
              {authPending === 'refresh' ? 'Refreshing...' : 'Refresh session'}
            </button>
            <button
              type="button"
              disabled={!!authPending}
              onClick={async () => {
                setAuthPending('sign-out');
                try {
                  await onSignOut();
                  setMessage('Signed out.');
                } catch (error) {
                  setMessage(getErrorMessage(error, 'Sign out failed.'));
                } finally {
                  setAuthPending(null);
                }
              }}
              className="rounded-[16px] border border-[var(--border-color)] bg-[var(--panel-bg)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {authPending === 'sign-out' ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[18px] border border-[var(--border-color)] bg-[var(--panel-alt-bg)] px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Cloud Mode</div>
          <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{syncMeta.cloudLinked ? 'Enabled' : 'Local only'}</div>
        </div>
        <div className="rounded-[18px] border border-[var(--border-color)] bg-[var(--panel-alt-bg)] px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Pending Changes</div>
          <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{syncMeta.pendingOps.length}</div>
        </div>
        <div className="rounded-[18px] border border-[var(--border-color)] bg-[var(--panel-alt-bg)] px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Last Sync</div>
          <div className="mt-1 text-[13px] font-semibold text-[var(--text-primary)]">
            {syncMeta.lastSyncAt ? new Date(syncMeta.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="button"
          disabled={!authSession}
          onClick={() => {
            onToggleCloudLinked(!syncMeta.cloudLinked);
            setMessage(syncMeta.cloudLinked ? 'Switched to local-only mode.' : 'Cloud sync mode enabled.');
          }}
          className="rounded-[14px] border border-[var(--border-color)] bg-[var(--panel-bg)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--panel-alt-bg)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {syncMeta.cloudLinked ? 'Disable sync' : 'Enable sync'}
        </button>
        <button
          type="button"
          disabled={!syncEnabledAndAuthed}
          onClick={async () => {
            try {
              await onRunSyncNow();
              setMessage('Sync complete.');
            } catch (error) {
              setMessage(getErrorMessage(error, 'Sync failed.'));
            }
          }}
          className="rounded-[14px] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-contrast)] transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          Sync Now
        </button>
      </div>

      <details className="rounded-[20px] border border-[var(--border-color)] bg-[var(--panel-alt-bg)] p-4">
        <summary className="cursor-pointer text-sm font-semibold text-[var(--text-primary)]">Advanced sync diagnostics</summary>
        <div className="mt-4 space-y-4">
          <div className="grid gap-2 text-sm text-[var(--text-secondary)]">
            <div>Mode: {syncMeta.mode}</div>
            <div>Device ID: {syncMeta.deviceId}</div>
            <div>Sync cursor: {syncMeta.syncCursor || 'none'}</div>
            <div>Settings version: {syncMeta.settingsVersion ?? 'none'}</div>
            <div>Schema blocked: {syncMeta.schemaBlocked ? 'yes' : 'no'}</div>
            <div>Last stage: {syncMeta.lastSyncDiagnostics?.stage || 'idle'}</div>
            <div>Last status code: {syncMeta.lastSyncDiagnostics?.statusCode ?? 'n/a'}</div>
            <div>Last server code: {syncMeta.lastSyncDiagnostics?.serverCode || 'n/a'}</div>
            <div>Last request ID: {syncMeta.lastSyncDiagnostics?.requestId || 'n/a'}</div>
            <div>Last retry count: {syncMeta.lastSyncDiagnostics?.retryCount ?? 0}</div>
            <div>Last conflicts: {syncMeta.lastConflicts.length}</div>
          </div>

          {syncMeta.lastSyncDiagnostics?.message && (
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--panel-bg)] px-3 py-2 text-xs leading-5 text-[var(--text-primary)]">
              {syncMeta.lastSyncDiagnostics.message}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                const copied = await copyTextToClipboard(syncDiagnosticsText);
                setMessage(copied ? 'Sync diagnostics copied to clipboard.' : 'Copy failed. Please copy manually.');
              }}
              className="flex items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--panel-bg)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]"
            >
              <Copy size={14} />
              Copy diagnostics
            </button>
            <button
              type="button"
              onClick={() => {
                downloadSyncDiagnostics();
                setMessage('Sync diagnostics downloaded.');
              }}
              className="flex items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--panel-bg)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]"
            >
              <Download size={14} />
              Export diagnostics
            </button>
          </div>

          <pre className="max-h-64 overflow-auto rounded-xl border border-[var(--border-color)] bg-[var(--panel-bg)] p-3 text-[11px] leading-5 text-[var(--text-secondary)] whitespace-pre-wrap">
            {syncDiagnosticsText}
          </pre>
        </div>
      </details>

      {message && (
        <div className="rounded-[18px] border border-[var(--border-color)] bg-[var(--panel-alt-bg)] px-4 py-3 text-sm text-[var(--text-primary)]">
          {message}
        </div>
      )}
    </div>
  );
};
