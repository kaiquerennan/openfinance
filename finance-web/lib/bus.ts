"use client";

// Pub/sub minimalista: paginas re-buscam dados quando algo muda (lançamento
// manual, limite editado, meta criada...). Use useDataVersion() nas deps do
// useEffect e chame bumpData() apos mutacoes.

import { useSyncExternalStore } from "react";

let version = 0;
const listeners = new Set<() => void>();

export function bumpData() {
  version++;
  listeners.forEach((l) => l());
}

export function useDataVersion() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version,
    () => 0,
  );
}
