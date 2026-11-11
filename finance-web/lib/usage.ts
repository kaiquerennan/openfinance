"use client";

// Contagem local de visitas por página. Serve só para ordenar os atalhos da
// home pelo que você realmente usa — nada sai do aparelho.
//
// A leitura é feita uma vez por carga do app: os atalhos não mudam de lugar
// enquanto você navega, só na próxima vez que abrir.

import { useMemo, useSyncExternalStore } from "react";

const STORAGE_KEY = "route-visits";

function read(): string {
  if (typeof window === "undefined") return "{}";
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "{}";
  } catch {
    return "{}";
  }
}

const snapshot = read();
let counts: Record<string, number> = {};
try {
  counts = JSON.parse(snapshot) as Record<string, number>;
} catch {
  counts = {};
}

export function recordVisit(path: string) {
  counts = { ...counts, [path]: (counts[path] ?? 0) + 1 };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
  } catch {
    // Sem localStorage (modo privado): os atalhos ficam na ordem padrão.
  }
}

const subscribe = () => () => {};

/**
 * Devolve `candidates` reordenados pelas mais visitadas (empate mantém a
 * ordem original, então quem nunca navegou vê a ordem padrão).
 *
 * Passe uma lista estável (constante de módulo), não um array criado a cada
 * render.
 */
export function useMostVisited(candidates: string[], limit: number) {
  const raw = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => "{}",
  );
  return useMemo(() => {
    let seen: Record<string, number> = {};
    try {
      seen = JSON.parse(raw) as Record<string, number>;
    } catch {
      seen = {};
    }
    return candidates
      .map((href, i) => ({ href, i, n: seen[href] ?? 0 }))
      .sort((a, b) => b.n - a.n || a.i - b.i)
      .slice(0, limit)
      .map((c) => c.href);
  }, [raw, limit, candidates]);
}
