import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";

import { ApplicationDialogProvider } from "@/components/applications/application-dialog-context";

/** Render inside the same providers the app shell gives every page, with retries off so errors show at once. */
export function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ApplicationDialogProvider>{ui}</ApplicationDialogProvider>
    </QueryClientProvider>,
  );
}
