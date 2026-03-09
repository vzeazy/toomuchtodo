import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Cloud, Copy, Download, LogIn, Palette, RefreshCw, Settings2, ShieldCheck, Upload, UserPlus } from 'lucide-react';
import { copyTextToClipboard } from '../../lib/clipboard';
import { getTaskListGenerationPrompt, isTaskListExchange } from '../../lib/taskListExchange';
import { getThemePrompt, validateThemeDefinition } from '../../lib/theme';
import { AuthSession } from '../../lib/sync/authClient';
import { AppDataExport, Project, SyncMeta, TaskListExchange, TaskListImportMode, TaskListScope, ThemeDefinition } from '../../types';

export const SettingsView: React.FC<{
  projects: Project[];
  themes: ThemeDefinition[];
  activeThemeId: string;
  onSetActiveTheme: (themeId: string) => void;
  onExportData: () => void;
  onImportData: (payload: AppDataExport) => void;
  onExportTaskListJson: (scope: TaskListScope) => void;
  onImportTaskListJson: (payload: TaskListExchange, mode: TaskListImportMode) => void;
  onExportTaskListMarkdown: (scope: TaskListScope) => void;
  onCopyTaskListProgressPrompt: (scope: TaskListScope) => Promise<boolean>;
  onSaveTheme: (theme: ThemeDefinition) => void;
  authSession: AuthSession | null;
  syncMeta: SyncMeta;
  syncStatus: string;
  onRefreshSession: () => Promise<void>;
  onSignIn: (email: string, password: string, turnstileToken?: string | null) => Promise<void>;
  onSignUp: (email: string, password: string, turnstileToken?: string | null) => Promise<void>;
  onSignOut: () => Promise<void>;
  onToggleCloudLinked: (enabled: boolean) => void;
  onRunSyncNow: () => Promise<void>;
}> = ({
  projects,
  themes,
  activeThemeId,
  onSetActiveTheme,
  onExportData,
  onImportData,
  onExportTaskListJson,
  onImportTaskListJson,
  onExportTaskListMarkdown,
  onCopyTaskListProgressPrompt,
  onSaveTheme,
  authSession,
  syncMeta,
  syncStatus,
  onRefreshSession,
  onSignIn,
  onSignUp,
  onSignOut,
  onToggleCloudLinked,
  onRunSyncNow,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-up');
  const [authPending, setAuthPending] = useState<'sign-in' | 'sign-up' | 'refresh' | 'sign-out' | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [themeBrief, setThemeBrief] = useState('');
  const [themeJson, setThemeJson] = useState('');
  const [llmProjectName, setLlmProjectName] = useState('');
  const [llmProjectBrief, setLlmProjectBrief] = useState('');
  const [llmResponseJson, setLlmResponseJson] = useState('');
  const [taskListScopeMode, setTaskListScopeMode] = useState<'inbox' | 'project'>('inbox');
  const [taskListProjectId, setTaskListProjectId] = useState('');
  const [taskListImportMode, setTaskListImportMode] = useState<TaskListImportMode>('upsert');
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const advancedTaskListInputRef = useRef<HTMLInputElement>(null);
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | number | null>(null);

  const promptText = getThemePrompt(themeBrief);
  const turnstileSiteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim();
  const turnstileEnabled = turnstileSiteKey.length > 0;
  const roundtripPromptText = useMemo(
    () => getTaskListGenerationPrompt(llmProjectName || 'Imported Project', llmProjectBrief),
    [llmProjectBrief, llmProjectName],
  );
  const selectedScope: TaskListScope = taskListScopeMode === 'inbox'
    ? { type: 'inbox' }
    : { type: 'project', projectId: taskListProjectId };
  const canUseProjectScope = taskListScopeMode === 'inbox' || !!taskListProjectId;
  const trimmedEmail = email.trim();
  const passwordLength = password.length;
  const canSubmitAuth = !!trimmedEmail && passwordLength >= 8 && !authPending && (!turnstileEnabled || !!turnstileToken);
  const syncEnabledAndAuthed = syncMeta.cloudLinked && !!authSession;

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
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
      if (api && turnstileWidgetIdRef.current !== null) {
        api.remove(turnstileWidgetIdRef.current);
      }
      turnstileWidgetIdRef.current = null;
      setTurnstileToken(null);
      setTurnstileReady(false);
    };
  }, [authSession, turnstileEnabled, turnstileSiteKey]);

  const resetTurnstile = () => {
    if (!turnstileEnabled) return;
    const api = (window as Window & {
      turnstile?: {
        reset: (widgetId?: string | number) => void;
      };
    }).turnstile;
    if (api && turnstileWidgetIdRef.current !== null) {
      api.reset(turnstileWidgetIdRef.current);
    }
    setTurnstileToken(null);
  };

  const importTaskListFile = async (
    file: File,
    mode: TaskListImportMode,
    overrideScope?: TaskListScope,
  ) => {
    const parsed = JSON.parse(await file.text()) as TaskListExchange;
    if (!isTaskListExchange(parsed)) {
      setMessage('Task list import failed. File is not a supported task-list JSON export.');
      return;
    }
    const payload = overrideScope
      ? {
        ...parsed,
        scope: overrideScope,
        tasks: parsed.tasks.map((task) => ({
          ...task,
          projectId: overrideScope.type === 'project' ? overrideScope.projectId : task.projectId,
          status: overrideScope.type === 'inbox' ? 'inbox' : task.status,
        })),
      }
      : parsed;
    const incomingCount = Array.isArray(payload.tasks) ? payload.tasks.length : 0;
    const shouldApply = window.confirm(`Import ${incomingCount} tasks with "${mode}" mode?`);
    if (!shouldApply) return;
    onImportTaskListJson(payload, mode);
    setMessage(`Imported task list from ${file.name} (${incomingCount} tasks).`);
  };

  const importTaskListText = async (text: string, mode: TaskListImportMode) => {
    const parsed = JSON.parse(text) as TaskListExchange;
    if (!isTaskListExchange(parsed)) {
      setMessage('Import failed. Pasted JSON is not a supported task-list export.');
      return;
    }
    const incomingCount = Array.isArray(parsed.tasks) ? parsed.tasks.length : 0;
    const shouldApply = window.confirm(`Import ${incomingCount} tasks with "${mode}" mode?`);
    if (!shouldApply) return;
    onImportTaskListJson(parsed, mode);
    setMessage(`Imported generated project (${incomingCount} tasks).`);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <div>
        <div className="section-kicker mb-2 text-[10px] font-bold uppercase text-[var(--accent)]">Settings</div>
        <h1 className="text-[34px] font-semibold leading-[1.02] tracking-[-0.04em] text-[var(--text-primary)]">Settings</h1>
        <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">Data portability, themes, and generation tools</div>
      </div>

      <section className="panel-surface rounded-[28px] p-6">
        <div className="mb-4 flex items-center gap-3">
          <Settings2 size={18} className="text-[var(--accent)]" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Data</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={onExportData} className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-contrast)]">
            <Download size={14} /> Export data
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--panel-alt-bg)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)]">
            <Upload size={14} /> Import data
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              try {
                const parsed = JSON.parse(await file.text()) as AppDataExport;
                onImportData(parsed);
                setMessage(`Imported data from ${file.name}.`);
              } catch {
                setMessage('Import failed. The file did not contain valid app JSON.');
              } finally {
                event.target.value = '';
              }
            }}
          />
        </div>
      </section>

      <section className="panel-surface rounded-[28px] p-6">
        <div className="mb-4 flex items-center gap-3">
          <Settings2 size={18} className="text-[var(--accent)]" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Account + Sync</h2>
        </div>
        <div className="space-y-4">
          {!authSession ? (
            <div className="overflow-hidden rounded-[24px] border border-[var(--border-color)] bg-[linear-gradient(135deg,rgba(255,255,255,0.045),transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.035),transparent_100%)]">
              <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="border-b border-[var(--border-color)] px-5 py-5 lg:border-b-0 lg:border-r">
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--panel-alt-bg)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        <ShieldCheck size={12} className="text-[var(--accent)]" />
                        Account access
                      </div>
                      <div className="text-[24px] font-semibold leading-[1.02] tracking-[-0.04em] text-[var(--text-primary)]">
                        Save your work across devices
                      </div>
                      <p className="mt-2 max-w-md text-sm leading-6 text-[var(--text-secondary)]">
                        Create an account to link this device, keep a cloud backup, and sync your task graph when you move between machines.
                      </p>
                    </div>
                    <div className="hidden rounded-[20px] border border-[color-mix(in_srgb,var(--accent)_28%,transparent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] p-3 text-[var(--accent)] md:block">
                      <Cloud size={22} />
                    </div>
                  </div>

                  <div className="mb-4 inline-flex rounded-[18px] border border-[var(--border-color)] bg-[var(--panel-alt-bg)] p-1">
                    <button
                      type="button"
                      onClick={() => setAuthMode('sign-up')}
                      className={`rounded-[14px] px-4 py-2 text-sm font-semibold transition ${authMode === 'sign-up'
                        ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-[0_12px_30px_rgba(0,0,0,0.18)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                    >
                      Create account
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode('sign-in')}
                      className={`rounded-[14px] px-4 py-2 text-sm font-semibold transition ${authMode === 'sign-in'
                        ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-[0_12px_30px_rgba(0,0,0,0.18)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
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
                        className="w-full rounded-[18px] border border-[var(--border-color)] bg-[var(--panel-alt-bg)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--focus)]"
                      />
                    </label>
                    <label className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Password</div>
                        <div className={`text-[11px] ${passwordLength >= 8 ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>
                          {passwordLength >= 8 ? 'ready' : 'minimum 8 characters'}
                        </div>
                      </div>
                      <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder={authMode === 'sign-up' ? 'Create a password' : 'Enter your password'}
                        className="w-full rounded-[18px] border border-[var(--border-color)] bg-[var(--panel-alt-bg)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--focus)]"
                      />
                    </label>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={!canSubmitAuth}
                      onClick={async () => {
                        const nextMode = authMode;
                        setAuthPending(nextMode);
                        try {
                          if (nextMode === 'sign-in') {
                            await onSignIn(trimmedEmail, password, turnstileToken);
                            setMessage('Signed in successfully.');
                          } else {
                            await onSignUp(trimmedEmail, password, turnstileToken);
                            setMessage('Account created and signed in.');
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
                  </div>

                  <div className="mt-4 text-xs leading-5 text-[var(--text-muted)]">
                    {authMode === 'sign-up'
                      ? 'New account flow creates a session immediately and primes this device for first sync.'
                      : 'Use the same email and password you used when the account was created.'}
                  </div>

                  {turnstileEnabled && (
                    <div className="mt-4 rounded-[20px] border border-[var(--border-color)] bg-[var(--panel-alt-bg)] p-4">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                        Human check
                      </div>
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
                </div>

                <div className="px-5 py-5">
                  <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Cloud sync readiness</div>
                  <div className="space-y-3">
                    <div className="rounded-[20px] border border-[var(--border-color)] bg-[var(--panel-alt-bg)] px-4 py-4">
                      <div className="text-sm font-semibold text-[var(--text-primary)]">Connection target</div>
                      <div className="mt-1 text-sm text-[var(--text-secondary)]">
                        API requests should go to your dedicated sync worker, not the Pages host.
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[20px] border border-[var(--border-color)] bg-[var(--panel-alt-bg)] px-4 py-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Cloud mode</div>
                        <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{syncMeta.cloudLinked ? 'Enabled' : 'Local only'}</div>
                      </div>
                      <div className="rounded-[20px] border border-[var(--border-color)] bg-[var(--panel-alt-bg)] px-4 py-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Pending changes</div>
                        <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{syncMeta.pendingOps.length}</div>
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-[var(--border-color)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--accent)_12%,transparent),transparent)] px-4 py-4 text-sm leading-6 text-[var(--text-secondary)]">
                      Once auth is working, this device can upload its local state and pull down changes from the server during sync runs.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[24px] border border-[var(--border-color)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent)_12%,transparent),transparent_50%)] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--accent)_26%,transparent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                    <ShieldCheck size={12} />
                    Connected
                  </div>
                  <div className="text-sm text-[var(--text-secondary)]">
                    Signed in as <span className="font-semibold text-[var(--text-primary)]">{authSession.user.email}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
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
            </div>
          )}

          <div className="panel-muted rounded-2xl border soft-divider px-4 py-3 text-sm text-[var(--text-secondary)]">
            <div className="font-semibold text-[var(--text-primary)]">Sync status: {syncStatus}</div>
            <div>Mode: {syncMeta.mode}</div>
            <div>Device ID: {syncMeta.deviceId}</div>
            <div>Pending ops: {syncMeta.pendingOps.length}</div>
            <div>Last sync: {syncMeta.lastSyncAt ? new Date(syncMeta.lastSyncAt).toLocaleString() : 'Never'}</div>
            <div>Schema blocked: {syncMeta.schemaBlocked ? 'yes' : 'no'}</div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!authSession}
              onClick={() => {
                onToggleCloudLinked(!syncMeta.cloudLinked);
                setMessage(syncMeta.cloudLinked ? 'Switched to local-only mode.' : 'Cloud sync mode enabled.');
              }}
              className="rounded-lg border border-[var(--border-color)] bg-[var(--panel-bg)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {syncMeta.cloudLinked ? 'Disable cloud sync' : 'Enable cloud sync'}
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
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-contrast)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Run sync now
            </button>
          </div>
        </div>
      </section>

      <section className="panel-surface rounded-[28px] p-6">
        <div className="mb-4 flex items-center gap-3">
          <Settings2 size={18} className="text-[var(--accent)]" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Task List Roundtrip</h2>
        </div>
        <p className="mb-4 text-sm text-[var(--text-secondary)]">
          Describe the project you want, copy the generated prompt into your favorite LLM, then paste the returned JSON here to import.
        </p>

        <div className="space-y-3">
          <input
            type="text"
            value={llmProjectName}
            onChange={(event) => setLlmProjectName(event.target.value)}
            placeholder="Project name (example: Q2 Launch Campaign)"
            className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--panel-alt-bg)] p-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--focus)]"
          />
          <textarea
            value={llmProjectBrief}
            onChange={(event) => setLlmProjectBrief(event.target.value)}
            placeholder="Project details, goals, constraints, timeline nuance, dependencies, team context..."
            className="min-h-[116px] w-full rounded-lg border border-[var(--border-color)] bg-[var(--panel-alt-bg)] p-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--focus)]"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={async () => {
                const copied = await copyTextToClipboard(roundtripPromptText);
                setMessage(copied ? 'Task-list generation prompt copied to clipboard. Paste it into your LLM.' : 'Copy failed. Please copy from the prompt preview.');
              }}
              className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-contrast)]"
            >
              <Copy size={14} /> Copy prompt for LLM
            </button>
            <span className="text-xs text-[var(--text-muted)]">Step 1: copy prompt -&gt; Step 2: run in LLM -&gt; Step 3: paste JSON below.</span>
          </div>
          <textarea
            value={llmResponseJson}
            onChange={(event) => setLlmResponseJson(event.target.value)}
            placeholder='Paste LLM JSON output here (schema: "too-much-to-do.task-list")'
            className="min-h-[170px] w-full rounded-lg border border-[var(--border-color)] bg-[var(--panel-alt-bg)] p-3 font-mono text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--focus)]"
          />
          <button
            type="button"
            onClick={async () => {
              const text = llmResponseJson.trim();
              if (!text) {
                setMessage('Paste generated project JSON first.');
                return;
              }
              try {
                await importTaskListText(text, 'upsert');
                setLlmResponseJson('');
              } catch {
                setMessage('Import failed. Generated JSON could not be parsed.');
              }
            }}
            className="flex items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--panel-bg)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)]"
          >
            <Upload size={14} /> Import generated project JSON
          </button>
        </div>

        <details className="mt-5 rounded-xl border border-[var(--border-color)] bg-[var(--panel-alt-bg)]">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">
            Advanced roundtrip tools
          </summary>
          <div className="space-y-5 border-t border-[var(--border-color)] px-4 py-4">
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Scope + import strategy</h3>
              <p className="text-xs text-[var(--text-secondary)]">Choose which list you are operating on and how incoming JSON should be applied.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <select
                value={taskListScopeMode}
                onChange={(event) => setTaskListScopeMode(event.target.value as 'inbox' | 'project')}
                className="rounded-lg border border-[var(--border-color)] bg-[var(--panel-bg)] p-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--focus)]"
              >
                <option value="inbox">Inbox</option>
                <option value="project">Project</option>
              </select>

              <select
                value={taskListProjectId}
                onChange={(event) => setTaskListProjectId(event.target.value)}
                disabled={taskListScopeMode !== 'project'}
                className="rounded-lg border border-[var(--border-color)] bg-[var(--panel-bg)] p-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--focus)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select project</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>

              <select
                value={taskListImportMode}
                onChange={(event) => setTaskListImportMode(event.target.value as TaskListImportMode)}
                className="rounded-lg border border-[var(--border-color)] bg-[var(--panel-bg)] p-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--focus)]"
              >
                <option value="append">Import mode: Append</option>
                <option value="upsert">Import mode: Upsert</option>
                <option value="replace-list">Import mode: Replace list</option>
              </select>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Transfer operations</h3>
              <p className="text-xs text-[var(--text-secondary)]">Direct list-level JSON export/import for backups, migrations, and bulk updates.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                disabled={!canUseProjectScope}
                onClick={() => {
                  if (!canUseProjectScope) return;
                  onExportTaskListJson(selectedScope);
                  setMessage('Task list JSON export generated.');
                }}
                className="rounded-xl border border-[var(--border-color)] bg-[var(--panel-bg)] p-4 text-left transition-colors hover:border-[var(--focus)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"><Download size={14} /> Export list JSON</div>
                <p className="text-xs text-[var(--text-secondary)]">Download the currently scoped list as structured JSON.</p>
              </button>

              <button
                type="button"
                disabled={!canUseProjectScope}
                onClick={() => advancedTaskListInputRef.current?.click()}
                className="rounded-xl border border-[var(--border-color)] bg-[var(--panel-bg)] p-4 text-left transition-colors hover:border-[var(--focus)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"><Upload size={14} /> Import list JSON</div>
                <p className="text-xs text-[var(--text-secondary)]">Import from file using the selected strategy.</p>
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Planning support</h3>
              <p className="text-xs text-[var(--text-secondary)]">Tools for reporting and external docs.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                disabled={!canUseProjectScope}
                onClick={() => {
                  if (!canUseProjectScope) return;
                  onExportTaskListMarkdown(selectedScope);
                  setMessage('Task list markdown export generated.');
                }}
                className="rounded-xl border border-[var(--border-color)] bg-[var(--panel-bg)] p-4 text-left transition-colors hover:border-[var(--focus)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="mb-1 text-sm font-semibold text-[var(--text-primary)]">Export list Markdown</div>
                <p className="text-xs text-[var(--text-secondary)]">Generate simple markdown output for docs or sharing.</p>
              </button>

              <button
                type="button"
                disabled={!canUseProjectScope}
                onClick={async () => {
                  if (!canUseProjectScope) return;
                  const copied = await onCopyTaskListProgressPrompt(selectedScope);
                  setMessage(copied ? 'Task list progress prompt copied to clipboard.' : 'Copy failed. Please copy from the exported prompt text.');
                }}
                className="rounded-xl border border-[var(--border-color)] bg-[var(--panel-bg)] p-4 text-left transition-colors hover:border-[var(--focus)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="mb-1 text-sm font-semibold text-[var(--text-primary)]">Copy progress prompt</div>
                <p className="text-xs text-[var(--text-secondary)]">Export current status context for LLM timeline adjustments.</p>
              </button>
            </div>

            <details className="rounded-lg border border-[var(--border-color)] bg-[var(--panel-bg)]">
              <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-[var(--text-primary)]">Preview generated prompt</summary>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap border-t border-[var(--border-color)] px-3 py-3 text-xs leading-relaxed text-[var(--text-secondary)]">{roundtripPromptText}</pre>
            </details>
          </div>
        </details>

        <input
          ref={advancedTaskListInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
              await importTaskListFile(file, taskListImportMode);
            } catch {
              setMessage('Task list import failed. JSON was invalid.');
            } finally {
              event.target.value = '';
            }
          }}
        />

      </section>

      <section className="panel-surface rounded-[28px] p-6">
        <div className="mb-4 flex items-center gap-3">
          <Palette size={18} className="text-[var(--accent)]" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Themes</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {themes.map((theme) => (
            <button key={theme.id} type="button" onClick={() => onSetActiveTheme(theme.id)} className={`rounded-xl border p-4 text-left transition-colors ${activeThemeId === theme.id ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border-color)] bg-[var(--panel-alt-bg)] hover:border-[var(--focus)]'}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-[var(--text-primary)]">{theme.name}</h3>
                {theme.builtIn && <span className="rounded-full bg-[var(--panel-bg)] px-2 py-1 text-[10px] uppercase tracking-wide text-[var(--text-secondary)]">Built-in</span>}
              </div>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{theme.description}</p>
              <div className="mt-4 flex gap-2">
                {[theme.tokens.appBg, theme.tokens.panelBg, theme.tokens.accent, theme.tokens.textPrimary].map((color) => (
                  <span key={color} className="h-6 w-6 rounded-full border border-black/10" style={{ backgroundColor: color }} />
                ))}
              </div>
            </button>
          ))}
        </div>

        <details className="mt-5 rounded-xl border border-[var(--border-color)] bg-[var(--panel-alt-bg)]">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">
            Advanced: Agent Theme Builder
          </summary>
          <div className="space-y-4 border-t border-[var(--border-color)] px-4 py-4">
            <p className="text-sm text-[var(--text-secondary)]">Describe the vibe, copy the generated prompt, send it to the LLM of your choice, then paste the returned JSON below.</p>
            <input
              type="text"
              value={themeBrief}
              onChange={(event) => setThemeBrief(event.target.value)}
              placeholder="Example: Quiet editorial light theme with warm paper tones and copper accents"
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--panel-bg)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--focus)]"
            />
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--panel-bg)] p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Generated prompt</h3>
                  <button
                    type="button"
                    onClick={async () => {
                      const copied = await copyTextToClipboard(promptText);
                      setMessage(copied ? 'Theme generation prompt copied to clipboard.' : 'Copy failed. Please copy from the prompt preview.');
                    }}
                    className="flex items-center gap-2 rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)]"
                  >
                  <Copy size={12} /> Copy prompt
                </button>
              </div>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-secondary)]">{promptText}</pre>
            </div>

            <textarea
              value={themeJson}
              onChange={(event) => setThemeJson(event.target.value)}
              placeholder='Paste the returned theme JSON here'
              className="min-h-[220px] w-full rounded-lg border border-[var(--border-color)] bg-[var(--panel-bg)] p-4 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--focus)]"
            />
            <button
              type="button"
              onClick={() => {
                try {
                  const parsed = JSON.parse(themeJson);
                  const result = validateThemeDefinition(parsed);
                  if (!result.valid) {
                    setMessage(result.error);
                    return;
                  }
                  onSaveTheme(result.theme);
                  setThemeJson('');
                  setMessage(`Saved theme "${result.theme.name}".`);
                } catch {
                  setMessage('Theme JSON could not be parsed.');
                }
              }}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-contrast)]"
            >
              Save custom theme
            </button>
          </div>
        </details>
      </section>

      {message && <div className="panel-muted rounded-2xl border soft-divider px-4 py-3 text-sm text-[var(--text-secondary)]">{message}</div>}
    </div>
  );
};
