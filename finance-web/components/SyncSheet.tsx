"use client";

// Sheet de sincronização / conexão de bancos — aberto pelo menu "Mais"
// (celular) e pela barra lateral (desktop), cada um com seu próprio open/close.

import { useState } from "react";
import { api } from "@/lib/api";
import { bumpData } from "@/lib/bus";
import { useConnectBank } from "@/lib/useConnectBank";
import Sheet from "@/components/Sheet";
import { PrimaryButton } from "@/components/ui";
import { IconSync } from "@/components/icons";

export default function SyncSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  async function syncNow() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      await api.syncAll();
      setSyncMsg(
        "Sincronização iniciada em segundo plano. Isso pode levar até 1 minuto — os dados atualizam sozinhos.",
      );
      setTimeout(bumpData, 20_000);
    } catch (e) {
      setSyncMsg((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  const {
    open: openConnect,
    loading: connecting,
    error: connectError,
    widget: connectWidget,
  } = useConnectBank(async (itemId) => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      await api.syncItem(itemId);
      setSyncMsg(
        "Banco conectado! A sincronização está rodando em segundo plano e os dados atualizam sozinhos em instantes.",
      );
      setTimeout(bumpData, 20_000);
    } catch (e) {
      setSyncMsg((e as Error).message);
    } finally {
      setSyncing(false);
    }
  });

  return (
    <>
      <Sheet open={open} onClose={onClose} title="Bancos conectados">
        <div className="space-y-3">
          <p className="text-sm text-ink-dim">
            Os bancos já sincronizam sozinhos a cada 3 horas. Use isto se quiser os
            dados de agora.
          </p>
          <PrimaryButton onClick={syncNow} disabled={syncing}>
            <span className="inline-flex items-center gap-2">
              <IconSync size={16} />
              {syncing ? "Sincronizando…" : "Sincronizar agora"}
            </span>
          </PrimaryButton>
          <button
            onClick={openConnect}
            disabled={connecting}
            className="block text-center w-full rounded-full bg-soft text-ink font-semibold py-3.5 text-sm disabled:opacity-60"
          >
            {connecting ? "Abrindo…" : "Conectar novo banco"}
          </button>
          <p className="text-xs text-ink-faint text-center">
            Ao conectar, entre com sua conta MeuPluggy (meu.pluggy.ai) e escolha lá
            o banco.
          </p>
          {(syncMsg || connectError) && (
            <p className="text-xs text-ink-dim text-center">{syncMsg ?? connectError}</p>
          )}
        </div>
      </Sheet>
      {connectWidget}
    </>
  );
}
