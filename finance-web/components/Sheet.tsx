"use client";

// Bottom sheet padrão: backdrop + painel arredondado que sobe de baixo.

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { IconX } from "@/components/icons";

/**
 * Trava a rolagem do fundo e fecha no Esc enquanto `open`. Conta quantos
 * sheets estão abertos: fechar o de cima (ex.: categoria, sobre o detalhe da
 * transação) não pode destravar a página enquanto o de baixo continua aberto.
 */
let openSheets = 0;
export function useSheetBehavior(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    openSheets++;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      openSheets--;
      if (openSheets === 0) document.body.style.overflow = "";
    };
  }, [open, onClose]);
}

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
  useSheetBehavior(open, onClose);

  // Portal para o <body>: um sheet aberto de dentro de um elemento animado
  // (transform) ficaria "fixo" em relação a ele, não à tela — a lista de
  // transações abre o detalhe de dentro de cards e de outros sheets.
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/55 fade-in" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md">
        <div className="sheet-up bg-card rounded-t-[2rem] px-5 pt-3 pb-8 max-h-[88dvh] overflow-y-auto">
          <div className="mx-auto h-1.5 w-10 rounded-full bg-soft mb-3" />
          {title && (
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-bold text-ink truncate">{title}</h2>
              <button
                onClick={onClose}
                aria-label="Fechar"
                className="h-9 w-9 rounded-full bg-soft grid place-items-center text-ink-dim shrink-0"
              >
                <IconX size={16} />
              </button>
            </div>
          )}
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
