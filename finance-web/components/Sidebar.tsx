"use client";

// Menu lateral fixo, só em telas de desktop (lg+). Mesmos destinos, nomes e
// grupos do celular (lib/nav.tsx), só que sempre visíveis.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ALL_GROUPS, isActive } from "@/lib/nav";
import InsightsSheet from "@/components/InsightsSheet";
import SyncSheet from "@/components/SyncSheet";
import { api } from "@/lib/api";
import { toggleHideValues, useHideValues } from "@/lib/privacy";
import {
  IconEye,
  IconEyeOff,
  IconLogout,
  IconSparkle,
  IconSync,
} from "@/components/icons";

export default function Sidebar() {
  const pathname = usePathname();
  const [aiOpen, setAiOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const hideValues = useHideValues();

  if (pathname === "/login") return null;

  const footerBtn =
    "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-[14px] font-semibold text-ink-dim hover:bg-soft transition";

  return (
    <>
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-dvh lg:border-r lg:border-edge lg:bg-card lg:py-6">
        <div className="px-6 pb-4 flex items-center justify-between">
          <span className="text-lg font-bold text-ink">
            Visor <span className="text-accent">•</span>
          </span>
          <button
            aria-label={hideValues ? "Mostrar valores" : "Esconder valores"}
            title={hideValues ? "Mostrar valores" : "Esconder valores"}
            onClick={toggleHideValues}
            className="h-8 w-8 rounded-full grid place-items-center bg-soft text-ink-dim"
          >
            {hideValues ? <IconEyeOff size={15} /> : <IconEye size={15} />}
          </button>
        </div>

        <div className="px-3 pb-3">
          <button
            onClick={() => setAiOpen(true)}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-accent/15 text-accent text-[14px] font-semibold hover:bg-accent/20 transition"
          >
            <IconSparkle size={17} />
            Perguntar ao Visor
          </button>
        </div>

        <nav aria-label="Navegação principal" className="flex-1 px-3 overflow-y-auto">
          {ALL_GROUPS.map((group) => (
            <div key={group.title} className="mb-4">
              <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-ink-faint px-3.5 mb-1">
                {group.title}
              </div>
              {group.items.map((item) => {
                const active = isActive(item.href, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 px-3.5 py-2 rounded-2xl text-[14.5px] font-semibold transition ${
                      active ? "bg-soft text-accent" : "text-ink-dim hover:bg-soft"
                    }`}
                  >
                    <span className={active ? "text-accent" : "text-ink-faint"}>
                      {item.icon(18)}
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="px-3 pt-3 border-t border-edge">
          <button onClick={() => setSyncOpen(true)} className={footerBtn}>
            <span className="text-ink-faint">
              <IconSync size={16} />
            </span>
            Sincronizar bancos
          </button>
          <button
            onClick={async () => {
              await api.logout().catch(() => {});
              window.location.href = "/login";
            }}
            className={footerBtn}
          >
            <span className="text-ink-faint">
              <IconLogout size={16} />
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
