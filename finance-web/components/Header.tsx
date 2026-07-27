"use client";

// Header escuro e plano: título à esquerda e ícones de ação (esconder
// valores / novo lançamento) à direita. `children` é o conteúdo da página
// logo abaixo (números grandes, gráficos etc — sem cartão/fundo próprio).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { toggleHideValues, useHideValues } from "@/lib/privacy";
import AddTxSheet from "@/components/AddTxSheet";
import InsightsSheet from "@/components/InsightsSheet";
import SyncSheet from "@/components/SyncSheet";
import {
  IconArrows,
  IconBars,
  IconCalendarDots,
  IconCard,
  IconChat,
  IconEye,
  IconEyeOff,
  IconFlow,
  IconHome,
  IconPie,
  IconPlus,
  IconSliders,
  IconTarget,
  IconTrophy,
  IconUpDown,
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
  { href: "/projecao", label: "Projeção", icon: <IconBars size={20} /> },
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
  const [aiOpen, setAiOpen] = useState(false);
  const hideValues = useHideValues();

  return (
    <header className="px-5 pt-5 pb-2 text-ink">
      <div className="flex items-center justify-between">
        <button
          aria-label="Menu"
          onClick={() => setMenuOpen(true)}
          className="h-9 w-9 rounded-full grid place-items-center text-ink-dim -ml-1.5 lg:hidden"
        >
          <IconTarget size={18} />
        </button>
        {title && <h1 className="text-2xl font-semibold">{title}</h1>}
        <div className="flex items-center gap-2">
          <button
            aria-label={hideValues ? "Mostrar valores" : "Esconder valores"}
            onClick={toggleHideValues}
            className="h-10 w-10 rounded-full grid place-items-center bg-soft text-ink-dim"
          >
            {hideValues ? <IconEyeOff size={17} /> : <IconEye size={17} />}
          </button>
          <button
            aria-label="Adicionar"
            onClick={() => (onAdd ? onAdd() : setAddOpen(true))}
            className="h-10 w-10 rounded-full grid place-items-center bg-soft text-ink-dim"
          >
            <IconPlus size={17} />
          </button>
        </div>
      </div>
      {children}

      {/* Menu (painel flutuante inferior-esquerdo, só mobile — desktop usa a Sidebar fixa) */}
      {menuOpen && (
        <div className="fixed inset-0 z-50" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/60 fade-in" />
          <div className="absolute bottom-6 inset-x-0 mx-auto w-full max-w-md px-4">
            <div
              className="pop w-72 max-h-[78dvh] overflow-y-auto bg-card backdrop-blur-xl rounded-[2rem] p-3 shadow-2xl border border-edge"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 px-1 pb-3 mb-2 border-b border-edge">
                <div className="flex-1 flex items-center gap-2 bg-soft rounded-full pl-1.5 pr-3 py-1.5">
                  <span className="h-7 w-7 rounded-lg bg-accent grid place-items-center text-white shrink-0">
                    <IconHome size={15} />
                  </span>
                  <span className="text-sm font-semibold text-ink flex-1 truncate">Pessoal</span>
                  <IconUpDown size={11} />
                </div>
                <button
                  aria-label="Perguntar ao Visor"
                  onClick={() => {
                    setMenuOpen(false);
                    setAiOpen(true);
                  }}
                  className="h-10 w-10 rounded-full bg-soft grid place-items-center text-ink-dim shrink-0"
                >
                  <IconChat size={17} />
                </button>
                <button
                  aria-label="Sincronizar"
                  onClick={() => {
                    setMenuOpen(false);
                    setSyncOpen(true);
                  }}
                  className="h-10 w-10 rounded-full bg-soft grid place-items-center text-ink-dim shrink-0"
                >
                  <IconSliders size={17} />
                </button>
              </div>
              {MENU.map((m) => {
                const active = m.href === pathname;
                return (
                  <Link
                    key={m.href}
                    href={m.href}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl text-[15px] font-semibold ${
                      active ? "bg-soft text-accent" : "text-ink-dim"
                    }`}
                  >
                    <span className={active ? "text-accent" : "text-ink-faint"}>
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
                className="w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-[15px] font-semibold text-ink-dim"
              >
                <span className="text-ink-faint">
                  <IconX size={20} />
                </span>
                Sair
              </button>
            </div>
          </div>
        </div>
      )}

      <SyncSheet open={syncOpen} onClose={() => setSyncOpen(false)} />
      <AddTxSheet open={addOpen} onClose={() => setAddOpen(false)} />
      <InsightsSheet open={aiOpen} onClose={() => setAiOpen(false)} />
    </header>
  );
}
