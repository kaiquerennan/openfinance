"use client";

// Toggle "esconder valores": pub/sub + localStorage, mesmo padrão do bus.ts.
// Usado pelo botão de olho no header e pelos componentes que exibem dinheiro.

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "hide-values";

function readInitial() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "1";
}

let hidden = readInitial();
const listeners = new Set<() => void>();

export function toggleHideValues() {
  hidden = !hidden;
  localStorage.setItem(STORAGE_KEY, hidden ? "1" : "0");
  listeners.forEach((l) => l());
}

export function useHideValues() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => hidden,
    () => false,
  );
}

/** "R$ 1.234,00" -> "R$ ••••" quando escondido; senão retorna o texto original. */
export function maskAmount(text: string, hide: boolean) {
  if (!hide) return text;
  const match = text.match(/^(\D*)/);
  return `${match?.[1] ?? ""}••••`;
}
