'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { ApiError } from '@/lib/api/client';

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Public figures may be up to 30 seconds old; they refresh when the tab regains focus
        staleTime: 30_000,
        // Retrying a 4xx can't help; a network failure gets one more try
        retry: (failures, err) => failures < 1 && !(err instanceof ApiError && err.status >= 400),
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
