import { useSyncExternalStore } from 'react';

import { serverWaking } from '@/api/auth-api';

/** True while a request to the SaveMan API is taking long, usually because the hosted server is waking up. */
export function useServerWaking() {
  return useSyncExternalStore(serverWaking.subscribe, serverWaking.get, serverWaking.get);
}
