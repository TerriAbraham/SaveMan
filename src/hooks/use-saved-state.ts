import { useEffect, useRef, useState } from 'react';

import { loadSaved, save } from '@/storage/local-store';

/** useState that is saved on the device: it starts from the last saved value, or `seed` the first time. */
export function useSavedState<T>(name: string, seed: T) {
  const [value, setValue] = useState<T>(() => loadSaved(name, seed));
  const loaded = useRef(true);

  useEffect(() => {
    // The first run is the value just loaded, so there's nothing new to save.
    if (loaded.current) {
      loaded.current = false;
      return;
    }
    save(name, value);
  }, [name, value]);

  return [value, setValue] as const;
}
