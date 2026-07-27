"use client";

// Bottom sheet padrão: backdrop + painel arredondado que sobe de baixo.

import React, { useEffect } from "react";
import { IconX } from "@/components/icons";

export default function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/45 fade-in" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md">
        <div className="sheet-up bg-card rounded-t-[2rem] px-5 pt-3 pb-8 max-h-[85dvh] overflow-y-auto">
          <div className="mx-auto h-1.5 w-10 rounded-full bg-soft mb-3" />
          {title && (
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-ink">{title}</h2>
              <button
                onClick={onClose}
                aria-label="Fechar"
                className="h-9 w-9 rounded-full bg-soft grid place-items-center text-ink-dim"
              >
                <IconX size={16} />
              </button>
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
