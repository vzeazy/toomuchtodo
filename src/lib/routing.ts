import type { AppView } from '../types';

export interface AppLocation {
  view: AppView;
  projectId: string | null;
  dateStr: string | null;
  weekOffset: number;
}

export const DEFAULT_APP_LOCATION: AppLocation = {
  view: 'planner',
  projectId: null,
  dateStr: null,
  weekOffset: 0,
};

const VALID_VIEWS = new Set<AppView>([
  'inbox',
  'open',
  'next',
  'waiting',
  'scheduled',
  'someday',
  'completed',
  'deleted',
  'focus',
  'today',
  'trash',
  'all',
  'planner',
  'day',
  'settings',
  'search',
]);

const DATE_PARAM_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isAppView = (value: string): value is AppView => VALID_VIEWS.has(value as AppView);

const normalizeString = (value: string | null): string | null => {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
};

const normalizeWeekOffset = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-100, Math.min(100, Math.trunc(value)));
};

const normalizeLocation = (location: AppLocation): AppLocation => {
  const base: AppLocation = {
    view: location.view,
    projectId: normalizeString(location.projectId),
    dateStr: normalizeString(location.dateStr),
    weekOffset: normalizeWeekOffset(location.weekOffset),
  };

  if (base.view === 'day') {
    return base.dateStr && DATE_PARAM_PATTERN.test(base.dateStr)
      ? { ...DEFAULT_APP_LOCATION, view: 'day', dateStr: base.dateStr }
      : DEFAULT_APP_LOCATION;
  }

  if (base.view === 'planner') {
    return { ...DEFAULT_APP_LOCATION, view: 'planner', weekOffset: base.weekOffset };
  }

  if (base.view === 'all') {
    return { ...DEFAULT_APP_LOCATION, view: 'all', projectId: base.projectId };
  }

  return { ...DEFAULT_APP_LOCATION, view: base.view };
};

/** Parse window.location.hash -> AppLocation */
export function parseHash(hash: string): AppLocation {
  const rawHash = hash.startsWith('#') ? hash.slice(1) : hash;
  const [rawView = '', rawQuery = ''] = rawHash.split('?', 2);
  const params = new URLSearchParams(rawQuery);
  const view = isAppView(rawView) ? rawView : DEFAULT_APP_LOCATION.view;
  const rawWeek = params.get('week');
  const parsedWeek = rawWeek === null ? 0 : Number.parseInt(rawWeek, 10);

  return normalizeLocation({
    view,
    projectId: params.get('project'),
    dateStr: params.get('date'),
    weekOffset: Number.isNaN(parsedWeek) ? 0 : parsedWeek,
  });
}

/** Serialize AppLocation -> hash string */
export function serializeHash(location: AppLocation): string {
  const normalized = normalizeLocation(location);
  const params = new URLSearchParams();

  if (normalized.view === 'planner' && normalized.weekOffset !== 0) {
    params.set('week', String(normalized.weekOffset));
  }

  if (normalized.view === 'day' && normalized.dateStr) {
    params.set('date', normalized.dateStr);
  }

  if (normalized.view === 'all' && normalized.projectId) {
    params.set('project', normalized.projectId);
  }

  const query = params.toString();
  return query ? `${normalized.view}?${query}` : normalized.view;
}
