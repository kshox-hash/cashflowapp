"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
};

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

type PendingConfirm = ConfirmOptions & {
  resolve: (v: boolean) => void;
};

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const resolveRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setPending({ ...options, resolve });
    });
  }, []);

  function handleConfirm() {
    resolveRef.current?.(true);
    setPending(null);
  }

  function handleCancel() {
    resolveRef.current?.(false);
    setPending(null);
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {pending && (
        <div className="confirmOverlay" onClick={handleCancel}>
          <div className="confirmModal" onClick={(e) => e.stopPropagation()}>
            <h3 className="confirmTitle">
              {pending.title ?? "Confirmar acción"}
            </h3>
            <p className="confirmMessage">{pending.message}</p>
            <div className="confirmActions">
              <button className="confirmCancel" onClick={handleCancel}>
                Cancelar
              </button>
              <button
                className={pending.danger ? "confirmDanger" : "confirmOk"}
                onClick={handleConfirm}
              >
                {pending.confirmLabel ?? "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx.confirm;
}
