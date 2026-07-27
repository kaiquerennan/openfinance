"use client";

// Botão "Conectar novo banco": abre o widget oficial Pluggy Connect embutido
// na própria página (sem redirecionar para outra aba/página HTML solta).

import { useConnectBank } from "@/lib/useConnectBank";
import { IconLink } from "@/components/icons";

export default function ConnectBankButton({
  onConnected,
}: {
  onConnected: (itemId: string) => void;
}) {
  const { open, loading, error, widget } = useConnectBank(onConnected);

  return (
    <>
      <button
        onClick={open}
        disabled={loading}
        className="card p-5 flex items-center gap-3.5 w-full text-left disabled:opacity-60"
      >
        <span className="h-11 w-11 rounded-2xl bg-[#e4ebfb] grid place-items-center text-accent shrink-0">
          <IconLink size={20} />
        </span>
        <div className="flex-1">
          <div className="text-[16px] font-semibold text-ink">
            {loading ? "Abrindo…" : "Conectar novo banco"}
          </div>
          <div className="text-sm text-ink-dim">
            {error ??
              "Entre com sua conta MeuPluggy e selecione lá o banco (Nubank, XP, BB...)"}
          </div>
        </div>
      </button>

      {widget}
    </>
  );
}
