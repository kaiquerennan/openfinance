"use client";

// Header azul degradê: botão de menu à esquerda, título ao centro e a pill
// de ações (sync / novo lançamento) à direita. `children` é o conteúdo hero.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { bumpData } from "@/lib/bus";
import { toggleHideValues, useHideValues } from "@/lib/privacy";
import { useConnectBank } from "@/lib/useConnectBank";
import AddTxSheet from "@/components/AddTxSheet";
import Sheet from "@/components/Sheet";
import { PrimaryButton } from "@/components/ui";
import {
  IconArrows,
  IconBars,
  IconCalendarDots,
  IconCard,
  IconChat,
  IconEye,
  IconEyeOff,
  IconFlow,
  IconGear,
  IconHome,
  IconPie,
  IconPlus,
  IconSync,
  IconTarget,
  IconTrophy,
  IconWallet,
  IconX,
} from "@/components/icons";

export const MENU = [
  { href: "/", label: "Visão geral", icon: <IconHome size={20} /> },
  { href: "/categorias", label: "Categorias", icon: <IconPie size={20} /> },
  { href: "/transacoes", label: "Transações", icon: <IconArrows size={20} /> },
  {
    href: "/transacoes?tab=recorrentes",
    label: "Recorrências",
    icon: <IconCalendarDots size={20} />,
  },
  { href: "/analises", label: "Fluxo de Caixa", icon: <IconFlow size={20} /> },
  { href: "/contas", label: "Contas", icon: <IconWallet size={20} /> },
  { href: "/investimentos", label: "Investimentos", icon: <IconBars size={20} /> },
  { href: "/cartoes", label: "Cartões", icon: <IconCard size={20} /> },
  { href: "/metas", label: "Metas", icon: <IconTrophy size={20} /> },
  {
    href: "mailto:kaiquerennan@gmail.com?subject=Suporte",
    label: "Suporte",
    icon: <IconChat size={20} />,
  },
];

export default function BlueHeader({
  title,
  children,
  onAdd,
}: {
  title?: string;
  children?: React.ReactNode;
  /** Ação do "+" (padrão: novo lançamento manual). */
  onAdd?: () => void;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const hideValues = useHideValues();

  async function syncNow() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await api.syncAll();
      const total = res.reduce((s, r) => s + r.totalTransactions, 0);
      setSyncMsg(`Sincronizado: ${total} transações atualizadas.`);
      bumpData();
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
      const res = await api.syncItem(itemId);
      setSyncMsg(`Banco conectado: ${res.totalTransactions} transações sincronizadas.`);
      bumpData();
    } catch (e) {
      setSyncMsg((e as Error).message);
    } finally {
      setSyncing(false);
    }
  });

  return (
    <header className="blue-hero px-5 pt-4 pb-7 text-white">
      <div className="flex items-center justify-between">
        <button
          aria-label="Menu"
          onClick={() => setMenuOpen(true)}
          className="hero-btn h-12 w-12 rounded-full grid place-items-center"
        >
          <IconTarget size={22} />
        </button>
        {title && <h1 className="text-xl font-semibold">{title}</h1>}
        <div className="hero-btn rounded-full flex items-center p-1.5 gap-1">
          <button
            aria-label={hideValues ? "Mostrar valores" : "Esconder valores"}
            onClick={toggleHideValues}
            className="h-9 w-9 rounded-full grid place-items-center bg-white/15"
          >
            {hideValues ? <IconEyeOff size={17} /> : <IconEye size={17} />}
          </button>
          <button
            aria-label="Sincronizar"
            onClick={() => setSyncOpen(true)}
            className="h-9 w-9 rounded-full grid place-items-center bg-white/15"
          >
            <IconGear size={17} />
          </button>
          <button
            aria-label="Adicionar"
            onClick={() => (onAdd ? onAdd() : setAddOpen(true))}
            className="h-9 w-9 rounded-full grid place-items-center bg-white/25"
          >
            <IconPlus size={17} />
          </button>
        </div>
      </div>
      {children}

      {/* Menu (painel flutuante inferior-esquerdo) */}
      {menuOpen && (
        <div className="fixed inset-0 z-50" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/25 fade-in" />
          <div className="absolute bottom-6 inset-x-0 mx-auto w-full max-w-md px-4">
            <div
              className="pop w-72 max-h-[78dvh] overflow-y-auto bg-white/90 backdrop-blur-xl rounded-[2rem] p-3 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {MENU.map((m) => {
                const active = m.href === pathname;
                return (
                  <Link
                    key={m.href}
                    href={m.href}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl text-[15px] font-semibold ${
                      active ? "bg-[#eceef2] text-azure-600" : "text-[#5c6470]"
                    }`}
                  >
                    <span
                      className={
                        active
                          ? "text-azure-600"
                          : "text-[#8d95a3]"
                      }
                    >
                      {m.icon}
                    </span>
                    {m.label}
                  </Link>
                );
              })}
              <button
                onClick={async () => {
                  setMenuOpen(false);
                  await api.logout().catch(() => {});
                  window.location.href = "/login";
                }}
                className="w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-[15px] font-semibold text-[#5c6470]"
              >
                <span className="text-[#8d95a3]">
                  <IconX size={20} />
                </span>
                Sair
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sheet de sincronização / conexão */}
      <Sheet open={syncOpen} onClose={() => setSyncOpen(false)} title="Contas conectadas">
        <div className="space-y-3">
          <p className="text-sm text-ink-dim">
            Atualize os dados dos bancos conectados via Open Finance ou conecte
            uma nova instituição. Ao conectar, entre com sua conta MeuPluggy
            (meu.pluggy.ai) e selecione lá o banco real (Nubank, XP, BB...).
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
          {(syncMsg || connectError) && (
            <p className="text-xs text-ink-dim text-center">{syncMsg ?? connectError}</p>
          )}
        </div>
      </Sheet>

      {connectWidget}

      <AddTxSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </header>
  );
}
