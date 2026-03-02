import React, { useMemo, useRef, useState } from 'react';
import { Copy, Download, Palette, Settings2, Upload } from 'lucide-react';
import { getTaskListGenerationPrompt, isTaskListExchange } from '../../lib/taskListExchange';
import { getThemePrompt, validateThemeDefinition } from '../../lib/theme';
import { AppDataExport, Project, TaskListExchange, TaskListImportMode, TaskListScope, ThemeDefinition } from '../../types';

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
  onCopyTaskListProgressPrompt: (scope: TaskListScope) => Promise<void>;
  onSaveTheme: (theme: ThemeDefinition) => void;
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
}) => {
  const [themeBrief, setThemeBrief] = useState('');
  const [themeJson, setThemeJson] = useState('');
  const [roundtripProjectId, setRoundtripProjectId] = useState('');
  const [roundtripDirection, setRoundtripDirection] = useState('');
  const [taskListScopeMode, setTaskListScopeMode] = useState<'inbox' | 'project'>('inbox');
  const [taskListProjectId, setTaskListProjectId] = useState('');
  const [taskListImportMode, setTaskListImportMode] = useState<TaskListImportMode>('upsert');
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const quickTaskListInputRef = useRef<HTMLInputElement>(null);
  const advancedTaskListInputRef = useRef<HTMLInputElement>(null);

  const promptText = getThemePrompt(themeBrief);
  const selectedRoundtripProject = useMemo(
    () => projects.find((project) => project.id === roundtripProjectId),
    [projects, roundtripProjectId],
  );
  const roundtripPromptText = useMemo(
    () => getTaskListGenerationPrompt(selectedRoundtripProject?.name || 'Imported Project', roundtripDirection),
    [roundtripDirection, selectedRoundtripProject?.name],
  );
  const selectedScope: TaskListScope = taskListScopeMode === 'inbox'
    ? { type: 'inbox' }
    : { type: 'project', projectId: taskListProjectId };
  const canUseProjectScope = taskListScopeMode === 'inbox' || !!taskListProjectId;
  const canUseRoundtripQuickStart = !!roundtripProjectId;

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
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Task List Roundtrip</h2>
        </div>
        <p className="mb-4 text-sm text-[var(--text-secondary)]">Quick start: choose a project, copy the LLM template prompt, then import the JSON result.</p>

        <div className="mb-4 grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Target project for import</label>
            <select
              value={roundtripProjectId}
              onChange={(event) => setRoundtripProjectId(event.target.value)}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--panel-alt-bg)] p-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--focus)]"
            >
              <option value="">Select project</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Direction / nuance for the LLM</label>
            <textarea
              value={roundtripDirection}
              onChange={(event) => setRoundtripDirection(event.target.value)}
              placeholder="Example: 6-week launch plan, strong QA gate, include docs + social rollout, avoid weekend due dates."
              className="min-h-[88px] w-full rounded-lg border border-[var(--border-color)] bg-[var(--panel-alt-bg)] p-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--focus)]"
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            disabled={!canUseRoundtripQuickStart}
            onClick={async () => {
              if (!canUseRoundtripQuickStart) return;
              await navigator.clipboard.writeText(roundtripPromptText);
              setMessage('Task-list generation prompt copied to clipboard.');
            }}
            className="flex min-h-[112px] flex-col items-start justify-between rounded-2xl border border-[var(--border-color)] bg-[var(--panel-alt-bg)] p-4 text-left transition-colors hover:border-[var(--focus)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <Copy size={14} /> Copy LLM task-list prompt
            </div>
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
              Copies a ready template prompt using your direction so the LLM returns valid importable JSON.
            </p>
          </button>

          <button
            type="button"
            disabled={!canUseRoundtripQuickStart}
            onClick={() => quickTaskListInputRef.current?.click()}
            className="flex min-h-[112px] flex-col items-start justify-between rounded-2xl bg-[var(--accent)] p-4 text-left transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--accent-contrast)]">
              <Upload size={14} /> Import project JSON
            </div>
            <p className="text-xs leading-relaxed text-[var(--accent-contrast)]/90">
              Imports the returned JSON into the selected project using safe upsert behavior.
            </p>
          </button>
        </div>

        <input
          ref={quickTaskListInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file || !roundtripProjectId) return;
            try {
              await importTaskListFile(file, 'upsert', { type: 'project', projectId: roundtripProjectId });
            } catch {
              setMessage('Task list import failed. JSON was invalid.');
            } finally {
              event.target.value = '';
            }
          }}
        />

        <details className="mt-5 rounded-xl border border-[var(--border-color)] bg-[var(--panel-alt-bg)]">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">
            Advanced roundtrip tools
          </summary>
          <div className="space-y-4 border-t border-[var(--border-color)] px-4 py-4">
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

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={!canUseProjectScope}
                onClick={() => {
                  if (!canUseProjectScope) return;
                  onExportTaskListJson(selectedScope);
                  setMessage('Task list JSON export generated.');
                }}
                className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-contrast)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download size={14} /> Export list JSON
              </button>

              <button
                type="button"
                disabled={!canUseProjectScope}
                onClick={() => advancedTaskListInputRef.current?.click()}
                className="flex items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--panel-bg)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Upload size={14} /> Import list JSON
              </button>

              <button
                type="button"
                disabled={!canUseProjectScope}
                onClick={() => {
                  if (!canUseProjectScope) return;
                  onExportTaskListMarkdown(selectedScope);
                  setMessage('Task list markdown export generated.');
                }}
                className="rounded-lg border border-[var(--border-color)] bg-[var(--panel-bg)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Export list Markdown
              </button>

              <button
                type="button"
                disabled={!canUseProjectScope}
                onClick={async () => {
                  if (!canUseProjectScope) return;
                  await onCopyTaskListProgressPrompt(selectedScope);
                  setMessage('Task list progress prompt copied to clipboard.');
                }}
                className="rounded-lg border border-[var(--border-color)] bg-[var(--panel-bg)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Copy progress prompt
              </button>
            </div>
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

        <details className="mt-4 rounded-xl border border-[var(--border-color)] bg-[var(--panel-alt-bg)]">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">Preview copied prompt</summary>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap border-t border-[var(--border-color)] px-4 py-4 text-xs leading-relaxed text-[var(--text-secondary)]">{roundtripPromptText}</pre>
        </details>
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
                    await navigator.clipboard.writeText(promptText);
                    setMessage('Theme generation prompt copied to clipboard.');
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
