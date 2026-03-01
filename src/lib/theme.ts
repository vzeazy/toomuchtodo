import { ThemeDefinition, ThemeTokens } from '../types';

const COLOR_RE = /^(#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|rgb[a]?\([^)]+\)|hsl[a]?\([^)]+\))$/;

export const themeTokenEntries = [
  'appBg',
  'sidebarBg',
  'panelBg',
  'panelAltBg',
  'elevatedBg',
  'borderColor',
  'textPrimary',
  'textSecondary',
  'textMuted',
  'accent',
  'accentSoft',
  'accentContrast',
  'success',
  'successSoft',
  'danger',
  'dangerSoft',
  'focus',
  'overlay',
] as const satisfies ReadonlyArray<keyof ThemeTokens>;

export const getThemeVariables = (theme: ThemeDefinition): Record<string, string> => ({
  '--app-bg': theme.tokens.appBg,
  '--sidebar-bg': theme.tokens.sidebarBg,
  '--panel-bg': theme.tokens.panelBg,
  '--panel-alt-bg': theme.tokens.panelAltBg,
  '--elevated-bg': theme.tokens.elevatedBg,
  '--border-color': theme.tokens.borderColor,
  '--text-primary': theme.tokens.textPrimary,
  '--text-secondary': theme.tokens.textSecondary,
  '--text-muted': theme.tokens.textMuted,
  '--accent': theme.tokens.accent,
  '--accent-soft': theme.tokens.accentSoft,
  '--accent-contrast': theme.tokens.accentContrast,
  '--success': theme.tokens.success,
  '--success-soft': theme.tokens.successSoft,
  '--danger': theme.tokens.danger,
  '--danger-soft': theme.tokens.dangerSoft,
  '--focus': theme.tokens.focus,
  '--overlay': theme.tokens.overlay,
});

export const getThemePrompt = (brief: string) => `You are designing a JSON theme for the Too Much To Do productivity app.

Context:
- The app is a focused task planner with planner, task list, sidebar, settings, search, and command palette views.
- Themes must be modular and reusable without touching component code.
- The visual language should feel intentional and cohesive, not generic.
- Use semantic UI tokens only. Do not include CSS selectors, class names, gradients, fonts, spacing, shadows, or arbitrary extra keys.

User brief:
${brief || 'Create a polished theme for a focused productivity app.'}

Output requirements:
- Return JSON only.
- Keep the exact top-level shape shown below.
- All color values must be valid CSS colors using hex, rgb(), rgba(), hsl(), or hsla().
- Pick strong contrast for text and interactive states.
- The theme must work across sidebar, cards, overlays, and focus rings.

Required JSON format:
{
  "id": "short-kebab-id",
  "name": "Theme Name",
  "description": "One sentence describing the vibe and intended use.",
  "mode": "dark",
  "tokens": {
    "appBg": "#000000",
    "sidebarBg": "#000000",
    "panelBg": "#000000",
    "panelAltBg": "#000000",
    "elevatedBg": "#000000",
    "borderColor": "#000000",
    "textPrimary": "#000000",
    "textSecondary": "#000000",
    "textMuted": "#000000",
    "accent": "#000000",
    "accentSoft": "#000000",
    "accentContrast": "#000000",
    "success": "#000000",
    "successSoft": "#000000",
    "danger": "#000000",
    "dangerSoft": "#000000",
    "focus": "#000000",
    "overlay": "rgba(0,0,0,0.72)"
  }
}
`;

export const validateThemeDefinition = (value: unknown): { valid: true; theme: ThemeDefinition } | { valid: false; error: string } => {
  if (!value || typeof value !== 'object') {
    return { valid: false, error: 'Theme JSON must be an object.' };
  }

  const candidate = value as Partial<ThemeDefinition>;
  if (!candidate.id || !candidate.name || !candidate.description || !candidate.mode || !candidate.tokens) {
    return { valid: false, error: 'Theme JSON is missing required top-level fields.' };
  }

  if (candidate.mode !== 'dark' && candidate.mode !== 'light') {
    return { valid: false, error: 'Theme mode must be "dark" or "light".' };
  }

  for (const key of themeTokenEntries) {
    const tokenValue = candidate.tokens[key];
    if (typeof tokenValue !== 'string' || !COLOR_RE.test(tokenValue.trim())) {
      return { valid: false, error: `Invalid color token for "${key}".` };
    }
  }

  return {
    valid: true,
    theme: {
      id: candidate.id,
      name: candidate.name,
      description: candidate.description,
      mode: candidate.mode,
      builtIn: false,
      tokens: candidate.tokens,
    },
  };
};
