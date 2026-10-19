import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';

import { makeQueryClient } from '@/app/providers';

/** Renders with a fresh query client, as the app's Providers does */
export function renderWithQuery(ui: ReactElement) {
  const queryClient = makeQueryClient();
  return { queryClient, ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>) };
}
