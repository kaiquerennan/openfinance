"use client";

// Menu lateral fixo, só em telas de desktop (lg+). No mobile continua tudo
// no BottomNav; aqui reaproveitamos a mesma lista de destinos do menu do
// Header, sempre visível (sem precisar abrir um popover).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { MENU } from "@/components/Header";
import InsightsSheet from "@/components/InsightsSheet";
import SyncSheet from "@/components/SyncSheet";
import { api } from "@/lib/api";
import { toggleHideValues, useHideValues } from "@/lib/privacy";
import {
  IconChat,
  IconEye,
  IconEyeOff,
  IconHome,
  IconSliders,
  IconUpDown,
  IconX,
} from "@/components/icons";

export default function Sidebar() {
  const pathname = usePathname();
  const [aiOpen, setAiOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const hideValues = useHideValues();

  if (pathname === "/login") return null;

  return (
    <>
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-dvh lg:border-r lg:border-edge lg:bg-card lg:py-6">
        <div className="px-6 pb-4 flex items-center justify-between">
          <span className="text-lg font-bold text-ink">
            Visor <span className="text-accent">•</span>
          </span>
          <button
            aria-label={hideValues ? "Mostrar valores" : "Esconder valores"}
            onClick={toggleHideValues}
            className="h-8 w-8 rounded-full grid place-items-center bg-soft text-ink-dim"
          >
            {hideValues ? <IconEyeOff size={15} /> : <IconEye size={15} />}
          </button>
        </div>
        <div className="px-6 pb-4 flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-soft rounded-full pl-1.5 pr-3 py-1.5">
            <span className="h-6 w-6 rounded-lg bg-accent grid place-items-center text-white shrink-0">
              <IconHome size={13} />
            </span>
            <span className="text-sm font-semibold text-ink flex-1 truncate">Pessoal</span>
            <IconUpDown size={11} />
          </div>
          <button
            aria-label="Perguntar ao Visor"
            onClick={() => setAiOpen(true)}
            className="h-9 w-9 rounded-full bg-soft grid place-items-center text-ink-dim shrink-0"
          >
            <IconChat size={15} />
          </button>
          <button
            aria-label="Sincronizar"
            onClick={() => setSyncOpen(true)}
            className="h-9 w-9 rounded-full bg-soft grid place-items-center text-ink-dim shrink-0"
          >
            <IconSliders size={15} />
          </button>
        </div>
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {MENU.filter((m) => !m.href.startsWith("mailto:")).map((m) => {
            const active = m.href === pathname || (m.href !== "/" && pathname.startsWith(m.href.split("?")[0]));
            return (
              <Link
                key={m.href}
                href={m.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-[15px] font-semibold transition ${
                  active ? "bg-soft text-accent" : "text-ink-dim hover:bg-soft"
                }`}
              >
                <span className={active ? "text-accent" : "text-ink-faint"}>{m.icon}</span>
                {m.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 pt-3 border-t border-edge">
          <button
            onClick={async () => {
              await api.logout().catch(() => {});
              window.location.href = "/login";
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-[15px] font-semibold text-ink-dim hover:bg-soft transition"
          >
            <span className="text-ink-faint">
              <IconX size={16} />
            </span>
            Sair
          </button>
        </div>
      </aside>

      <InsightsSheet open={aiOpen} onClose={() => setAiOpen(false)} />
      <SyncSheet open={syncOpen} onClose={() => setSyncOpen(false)} />
    </>
  );
}
