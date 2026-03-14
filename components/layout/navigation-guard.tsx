'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useTranslation } from '@/lib/i18n/use-translation';

type NavigationGuardConfig = {
  enabled: boolean;
  title: string;
  message: string;
  saveLabel: string;
  leaveLabel: string;
  stayLabel?: string;
  onSaveAndLeave: () => Promise<boolean>;
};

type NavigationAction = () => void | Promise<void>;

type NavigationGuardContextValue = {
  setGuard: (config: NavigationGuardConfig | null) => void;
  requestNavigation: (action: NavigationAction) => void;
};

const NavigationGuardContext = createContext<NavigationGuardContextValue | null>(null);

export function NavigationGuardProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [guard, setGuard] = useState<NavigationGuardConfig | null>(null);
  const [pendingAction, setPendingAction] = useState<NavigationAction | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const closeDialog = useCallback(() => {
    if (isSaving) return;
    setDialogOpen(false);
    setPendingAction(null);
  }, [isSaving]);

  const runPendingAction = useCallback(async () => {
    const action = pendingAction;
    setDialogOpen(false);
    setPendingAction(null);
    if (action) {
      await action();
    }
  }, [pendingAction]);

  const requestNavigation = useCallback(
    (action: NavigationAction) => {
      if (!guard?.enabled) {
        void action();
        return;
      }

      setPendingAction(() => action);
      setDialogOpen(true);
    },
    [guard]
  );

  const handleSaveAndLeave = useCallback(async () => {
    if (!guard) return;

    setIsSaving(true);
    try {
      const saved = await guard.onSaveAndLeave();
      if (!saved) return;
      await runPendingAction();
    } finally {
      setIsSaving(false);
    }
  }, [guard, runPendingAction]);

  const value = useMemo(
    () => ({
      setGuard,
      requestNavigation,
    }),
    [requestNavigation]
  );

  return (
    <NavigationGuardContext.Provider value={value}>
      {children}

      {dialogOpen && guard ? (
        <div className="modal-backdrop" onClick={closeDialog}>
          <div
            className="modal-panel confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="navigation-guard-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="confirm-dialog-body">
              <h3 id="navigation-guard-title" style={{ margin: 0 }}>
                {guard.title}
              </h3>
              <p className="muted" style={{ margin: 0 }}>
                {guard.message}
              </p>
            </div>

            <div className="confirm-dialog-actions">
              <button className="btn" type="button" onClick={closeDialog} disabled={isSaving}>
                {guard.stayLabel ?? t('common.stay')}
              </button>
              <button className="btn danger" type="button" onClick={() => void runPendingAction()} disabled={isSaving}>
                {guard.leaveLabel}
              </button>
              <button className="btn primary" type="button" onClick={() => void handleSaveAndLeave()} disabled={isSaving}>
                {isSaving ? t('common.saving') : guard.saveLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </NavigationGuardContext.Provider>
  );
}

export function useNavigationGuard() {
  const context = useContext(NavigationGuardContext);

  if (!context) {
    throw new Error('useNavigationGuard must be used within NavigationGuardProvider');
  }

  return context;
}
