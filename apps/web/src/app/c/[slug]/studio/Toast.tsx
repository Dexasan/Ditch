"use client";

import { useEffect, useState } from "react";
import type { Toast, ToastType } from "@/lib/studio-store";
import { useStudioStore } from "@/lib/studio-store";

const BORDER: Record<ToastType, string> = {
  success: "#00D4AA",
  warning: "#FFAA00",
  error:   "#FF4444",
  info:    "#FF1DB4",
};

const ICON: Record<ToastType, string> = {
  success: "✓",
  warning: "⚠",
  error:   "✕",
  info:    "ℹ",
};

const STYLE_TAG = `
@keyframes toastIn {
  from { transform: translateY(8px); opacity: 0; }
  to   { transform: translateY(0);   opacity: 1; }
}
@keyframes toastOut {
  from { opacity: 1; }
  to   { opacity: 0; }
}
.toast-enter { animation: toastIn  200ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
.toast-exit  { animation: toastOut 150ms ease-in both; }
`;

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const exitAt = toast.duration - 150;
    const exitTimer = setTimeout(() => setExiting(true), exitAt > 0 ? exitAt : 0);
    const killTimer = setTimeout(onRemove, toast.duration);
    return () => { clearTimeout(exitTimer); clearTimeout(killTimer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismiss() {
    setExiting(true);
    setTimeout(onRemove, 150);
  }

  return (
    <div
      className={exiting ? "toast-exit" : "toast-enter"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        borderRadius: 8,
        borderLeft: `3px solid ${BORDER[toast.type]}`,
        background: "var(--bg-mid)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
        fontSize: 13,
        color: "var(--text-primary)",
        minWidth: 220,
        maxWidth: 360,
        pointerEvents: "all",
      }}
    >
      <span style={{ color: BORDER[toast.type], fontSize: 14, lineHeight: 1 }}>
        {ICON[toast.type]}
      </span>
      <span style={{ flex: 1 }}>{toast.message}</span>
      <button
        onClick={dismiss}
        style={{
          background: "none",
          border: "none",
          color: "var(--text-muted)",
          cursor: "pointer",
          fontSize: 14,
          lineHeight: 1,
          padding: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
}

export function ToastManager() {
  const toasts = useStudioStore((s) => s.toasts);
  const removeToast = useStudioStore((s) => s.removeToast);

  return (
    <>
      <style>{STYLE_TAG}</style>
      <div
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={() => removeToast(t.id)} />
        ))}
      </div>
    </>
  );
}
