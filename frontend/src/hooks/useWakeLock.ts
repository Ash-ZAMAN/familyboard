import { useEffect, useState, useCallback } from 'react';

interface WakeLockSentinel extends EventTarget {
  released: boolean;
  release: () => Promise<void>;
}

export function useWakeLock(enabled: boolean = true) {
  const [isSupported, setIsSupported] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator) || !enabled) return null;
    try {
      const nav = navigator as unknown as {
        wakeLock: { request: (type: 'screen') => Promise<WakeLockSentinel> };
      };
      const sentinel = await nav.wakeLock.request('screen');
      setIsLocked(true);
      sentinel.addEventListener('release', () => {
        setIsLocked(false);
      });
      return sentinel;
    } catch {
      setIsLocked(false);
      return null;
    }
  }, [enabled]);

  useEffect(() => {
    setIsSupported('wakeLock' in navigator);
    let sentinel: WakeLockSentinel | null = null;

    if (enabled) {
      requestWakeLock().then((s) => {
        sentinel = s;
      });
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled) {
        requestWakeLock().then((s) => {
          sentinel = s;
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (sentinel && !sentinel.released) {
        sentinel.release().catch(() => {});
      }
    };
  }, [enabled, requestWakeLock]);

  return { isSupported, isLocked };
}

