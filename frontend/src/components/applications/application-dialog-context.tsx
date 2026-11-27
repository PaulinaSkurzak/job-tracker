"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { ApplicationFormDialog } from "./application-form-dialog";

type Api = { openNew: () => void; openEdit: (id: number) => void };

const ApplicationDialogContext = createContext<Api | null>(null);

/**
 * One New/Edit application dialog for the whole app. The board, the dashboard, the detail panel and the
 * ⌘K menu all open the same dialog through useApplicationDialog(), instead of each keeping its own copy.
 */
export function ApplicationDialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ open: boolean; id?: number }>({ open: false });
  const openNew = useCallback(() => setState({ open: true }), []);
  const openEdit = useCallback((id: number) => setState({ open: true, id }), []);
  const api = useMemo(() => ({ openNew, openEdit }), [openNew, openEdit]);

  return (
    <ApplicationDialogContext.Provider value={api}>
      {children}
      <ApplicationFormDialog id={state.id} open={state.open} onOpenChange={(open) => setState((s) => ({ ...s, open }))} />
    </ApplicationDialogContext.Provider>
  );
}

export function useApplicationDialog(): Api {
  const api = useContext(ApplicationDialogContext);
  if (!api) throw new Error("useApplicationDialog must be used inside ApplicationDialogProvider");
  return api;
}
