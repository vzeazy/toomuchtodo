import React, { useRef, useState } from 'react';
import { Copy, Download, Palette, Settings2, Upload } from 'lucide-react';
import { getThemePrompt, validateThemeDefinition } from '../../lib/theme';
import { AppDataExport, ThemeDefinition } from '../../types';

export const SettingsView: React.FC<{
  themes: ThemeDefinition[];
  activeThemeId: string;
  onSetActiveTheme: (themeId: string) => void;
  onExportData: () => void;
  onImportData: (payload: AppDataExport) => void;
  onSaveTheme: (theme: ThemeDefinition) => void;
}> = ({ themes, activeThemeId, onSetActiveTheme, onExportData, onImportData, onSaveTheme }) => {
  const [themeBrief, setThemeBrief] = useState('');
  const [themeJson, setThemeJson] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const promptText = getThemePrompt(themeBrief);

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
      </section>

      <section className="panel-surface rounded-[28px] p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Agent Theme Builder</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">Describe the vibe, copy the generated prompt, send it to the LLM of your choice, then paste the returned JSON below.</p>

        <div className="mt-4 space-y-4">
          <input
            type="text"
            value={themeBrief}
            onChange={(event) => setThemeBrief(event.target.value)}
            placeholder="Example: Quiet editorial light theme with warm paper tones and copper accents"
            className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--panel-alt-bg)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--focus)]"
          />
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--panel-alt-bg)] p-4">
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
            className="min-h-[220px] w-full rounded-lg border border-[var(--border-color)] bg-[var(--panel-alt-bg)] p-4 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--focus)]"
          />
          <button
            type="button"
            onClick={() => {
              try {
                const parsed = JSON.parse(themeJson);
                const result = validateThemeDefinition(parsed);
                if (!result.valid) {
                  setMessage((result as any).error);
                  return;
                }
                onSaveTheme((result as any).theme);
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
      </section>

      {message && <div className="panel-muted rounded-2xl border soft-divider px-4 py-3 text-sm text-[var(--text-secondary)]">{message}</div>}
    </div>
  );
};
