import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppLocation, DEFAULT_APP_LOCATION, parseHash, serializeHash } from './routing';

const getWindowLocation = (): AppLocation => {
  if (typeof window === 'undefined') return DEFAULT_APP_LOCATION;
  return parseHash(window.location.hash);
};

export function useAppLocation(): {
  view: AppLocation['view'];
  projectId: string | null;
  dateStr: string | null;
  weekOffset: number;
  navigate: (loc: Partial<AppLocation>) => void;
} {
  const [location, setLocation] = useState<AppLocation>(() => getWindowLocation());

  const navigate = useCallback((nextLocation: Partial<AppLocation>) => {
    setLocation((currentLocation) => {
      const mergedLocation = parseHash(`#${serializeHash({ ...currentLocation, ...nextLocation })}`);

      if (typeof window !== 'undefined') {
        const nextHash = `#${serializeHash(mergedLocation)}`;
        if (window.location.hash !== nextHash) {
          window.history.pushState(null, '', nextHash);
        }
      }

      return mergedLocation;
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const syncFromHash = () => setLocation(parseHash(window.location.hash));
    window.addEventListener('hashchange', syncFromHash);

    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const nextHash = `#${serializeHash(location)}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, '', nextHash);
    }
  }, [location]);

  return useMemo(
    () => ({
      view: location.view,
      projectId: location.projectId,
      dateStr: location.dateStr,
      weekOffset: location.weekOffset,
      navigate,
    }),
    [location, navigate]
  );
}
