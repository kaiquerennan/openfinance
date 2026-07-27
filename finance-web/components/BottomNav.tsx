"use client";

// Nav inferior flutuante: pill escura com Visão geral, Categorias,
// Transações e um botão de gráfico que abre o menu completo (todas as
// outras páginas) + um botão separado que abre o chat do Visor (IA).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import InsightsSheet from "@/components/InsightsSheet";
import SyncSheet from "@/components/SyncSheet";
import { MENU } from "@/components/Header";
import {
  IconArrows,
  IconBars,
  IconChat,
  IconHome,
  IconPie,
  IconSliders,
  IconSparkle,
  IconUpDown,
  IconX,
} from "@/components/icons";

const NAV_ROUTES = ["/", "/categorias", "/transacoes"];

function NavItem({
  href,
  active,
  children,
  label,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={`h-11 w-11 rounded-full grid place-items-center transition ${
        active ? "bg-accent text-white" : "text-ink-faint"
      }`}
    >
      {children}
    </Link>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  if (pathname === "/login") return null;

  const inMainNav = NAV_ROUTES.includes(pathname);

  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 z-40 pointer-events-none lg:hidden">
        <div className="mx-auto w-full max-w-md px-4 pb-4 pt-2 flex items-center gap-3">
          <div className="pointer-events-auto flex-1 flex items-center justify-between bg-card/95 backdrop-blur-xl border border-edge rounded-full px-2.5 py-2 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6)]">
            <NavItem href="/" active={pathname === "/"} label="Visão geral">
              <IconHome size={21} />
            </NavItem>
            <NavItem
              href="/categorias"
              active={pathname.startsWith("/categorias")}
              label="Categorias"
            >
              <IconPie size={20} />
            </NavItem>
            <NavItem
              href="/transacoes"
              active={pathname.startsWith("/transacoes")}
              label="Transações"
            >
              <IconArrows size={20} />
            </NavItem>
            <button
              aria-label="Mais opções"
              onClick={() => setMenuOpen(true)}
              className={`h-11 w-11 rounded-full grid place-items-center transition ${
                !inMainNav ? "bg-accent text-white" : "text-ink-faint"
              }`}
            >
              <IconBars size={20} />
            </button>
          </div>
          <button
            aria-label="Perguntar ao Visor"
            onClick={() => setAiOpen(true)}
            className="pointer-events-auto h-12 w-12 rounded-full bg-card/95 backdrop-blur-xl border border-edge grid place-items-center text-ink-faint shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6)]"
          >
            <IconSparkle size={20} />
          </button>
        </div>
      </nav>

      {/* Menu completo (todas as páginas) */}
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
      <InsightsSheet open={aiOpen} onClose={() => setAiOpen(false)} />
    </>
  );
}
