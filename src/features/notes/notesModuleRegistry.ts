import { AppSettings } from '../../types';

export type NotesModuleSurface = 'task-panel';

interface NotesModuleDefinition {
  id: 'contextual-notes';
  settingsKey: 'contextualNotesEnabled';
  supportsSurface: (surface: NotesModuleSurface) => boolean;
}

export const contextualNotesModule: NotesModuleDefinition = {
  id: 'contextual-notes',
  settingsKey: 'contextualNotesEnabled',
  supportsSurface: (surface) => surface === 'task-panel',
};

export const isContextualNotesEnabledForSurface = (settings: AppSettings, surface: NotesModuleSurface) => (
  Boolean(settings[contextualNotesModule.settingsKey]) && contextualNotesModule.supportsSurface(surface)
);

export const isContextualNotesEnabledForSurfaceValue = (enabled: boolean, surface: NotesModuleSurface) => (
  enabled && contextualNotesModule.supportsSurface(surface)
);
