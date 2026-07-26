"use client";

// Hook para abrir o widget oficial Pluggy Connect embutido na própria página
// (sem redirecionar para outra aba). Chama onConnected(itemId) assim que o
// usuário conclui a conexão com o banco.

import { useState } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";

// react-pluggy-connect toca `window` na avaliação do módulo — precisa ficar
// fora do bundle de SSR, senão quebra o prerendering de todas as páginas
// (o Header, que usa este hook, aparece em todas elas).
const PluggyConnect = dynamic(
  () => import("react-pluggy-connect").then((m) => m.PluggyConnect),
  { ssr: false },
);

export function useConnectBank(onConnected: (itemId: string) => void) {
  const [connectToken, setConnectToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setLoading(true);
    setError(null);
    try {
      const { accessToken } = await api.createConnectToken();
      setConnectToken(accessToken);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const widget = connectToken ? (
    <PluggyConnect
      connectToken={connectToken}
      includeSandbox={false}
      onSuccess={(data) => {
        setConnectToken(null);
        onConnected(data.item.id);
      }}
      onError={(err) => {
        setConnectToken(null);
        setError(err.message);
      }}
      onClose={() => setConnectToken(null)}
    />
  ) : null;

  return { open, loading, error, widget };
}
