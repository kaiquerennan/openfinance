"use client";

// Menu lateral fixo, só em telas de desktop (lg+). No mobile continua tudo
// no BottomNav; aqui reaproveitamos a mesma lista de destinos do menu do
// Header, sempre visível (sem precisar abrir um popover).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { MENU } from "@/components/Header";
import InsightsSheet from "@/components/InsightsSheet";
import { IconSparkle } from "@/components/icons";

export default function Sidebar() {
  const pathname = usePathname();
  const [aiOpen, setAiOpen] = useState(false);

  return (
    <>
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-dvh lg:border-r lg:border-edge lg:bg-card lg:py-6">
        <div className="px-6 pb-6 text-lg font-bold text-ink">
          Visor <span className="text-accent">•</span>
        </div>
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {MENU.filter((m) => !m.href.startsWith("mailto:")).map((m) => {
            const active = m.href === pathname || (m.href !== "/" && pathname.startsWith(m.href.split("?")[0]));
            return (
              <Link
                key={m.href}
                href={m.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-[15px] font-semibold transition ${
                  active ? "bg-[#e4ebfb] text-accent" : "text-ink-dim hover:bg-soft"
                }`}
              >
                <span className={active ? "text-accent" : "text-[#8d95a3]"}>{m.icon}</span>
                {m.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 pt-3 border-t border-edge">
          <button
            onClick={() => setAiOpen(true)}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-[15px] font-semibold text-ink-dim hover:bg-soft transition"
          >
            <span className="text-accent">
              <IconSparkle size={20} />
            </span>
            Insights do consultor
          </button>
        </div>
      </aside>

      <InsightsSheet open={aiOpen} onClose={() => setAiOpen(false)} />
    </>
  );
}
