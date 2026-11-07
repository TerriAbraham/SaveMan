import { useEffect, useState } from 'react';

/** Seconds left before something may be done again (e.g. sending another email code). */
export function useCooldown(initialSeconds = 0) {
  const [until, setUntil] = useState(() => Date.now() + initialSeconds * 1000);
  const [now, setNow] = useState(Date.now);
  const seconds = Math.max(0, Math.ceil((until - now) / 1000));

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [seconds > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    seconds,
    start(s: number) {
      const t = Date.now();
      setNow(t);
      setUntil(t + s * 1000);
    },
  };
}
