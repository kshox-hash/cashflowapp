"use client";

import { ConfirmProvider } from "./contexts/confirm.context";
import { ToastProvider } from "./contexts/toast.context";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </ToastProvider>
  );
}
