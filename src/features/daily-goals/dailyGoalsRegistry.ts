import { AppSettings } from '../../types';

export type AppFeatureSurface = 'day-panel' | 'planner-cell';

export interface AppFeatureModule {
  id: string;
  settingsKey: keyof AppSettings;
  supportsSurface: (surface: AppFeatureSurface) => boolean;
}

export const dailyGoalsFeature: AppFeatureModule = {
  id: 'daily-goals',
  settingsKey: 'dailyGoalsEnabled',
  supportsSurface: (surface) => surface === 'day-panel',
};

export const isFeatureEnabledForSurface = (
  feature: AppFeatureModule,
  settings: AppSettings,
  surface: AppFeatureSurface,
) => Boolean(settings[feature.settingsKey]) && feature.supportsSurface(surface);

export const isDailyGoalsEnabledForSurface = (enabled: boolean, surface: AppFeatureSurface) => (
  enabled && dailyGoalsFeature.supportsSurface(surface)
);
