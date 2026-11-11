"use client";

// Barra inferior: os três destinos do dia a dia + "Mais", todos com rótulo
// (ícone sozinho obriga a lembrar o que cada um é), e o botão do Visor ao lado.
// "Mais" abre o resto do app agrupado pelo que se quer resolver.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { isActive, PRIMARY_NAV, SECONDARY_GROUPS, SECONDARY_NAV } from "@/lib/nav";
import { recordVisit } from "@/lib/usage";
import InsightsSheet from "@/components/InsightsSheet";
import Sheet from "@/components/Sheet";
import SyncSheet from "@/components/SyncSheet";
import { IconGrid, IconLogout, IconSparkle, IconSync } from "@/components/icons";

function Tab({
  active,
  label,
  children,
}: {
  active: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`flex flex-col items-center gap-0.5 transition ${
        active ? "text-accent" : "text-ink-faint"
      }`}
    >
      <span
        className={`h-8 w-14 rounded-full grid place-items-center transition ${
          active ? "bg-accent/15" : ""
        }`}
      >
        {children}
      </span>
      <span className={`text-[10.5px] leading-none ${active ? "font-bold" : "font-semibold"}`}>
        {label}
      </span>
    </span>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const inSecondary = SECONDARY_NAV.some((i) => isActive(i.href, pathname));

  // Alimenta os atalhos da home com as telas secundárias mais abertas.
  useEffect(() => {
    const item = SECONDARY_NAV.find((i) => isActive(i.href, pathname));
    if (item) recordVisit(item.href);
  }, [pathname]);

  if (pathname === "/login") return null;

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="fixed bottom-0 inset-x-0 z-40 pointer-events-none lg:hidden"
      >
        <div className="mx-auto w-full max-w-md px-4 pb-4 pt-2 flex items-center gap-2.5">
          <div className="pointer-events-auto flex-1 grid grid-cols-4 bg-card/95 backdrop-blur-xl border border-edge rounded-[1.75rem] px-1.5 py-2 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6)]">
            {PRIMARY_NAV.map((item) => {
              const active = isActive(item.href, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="py-0.5"
                >
                  <Tab active={active} label={item.label}>
                    {item.icon(20)}
                  </Tab>
                </Link>
              );
            })}
            <button
              onClick={() => setMenuOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              className="py-0.5"
            >
              <Tab active={inSecondary || menuOpen} label="Mais">
                <IconGrid size={19} />
              </Tab>
            </button>
          </div>
          <button
            aria-label="Perguntar ao Visor"
            onClick={() => setAiOpen(true)}
            className="pointer-events-auto h-[3.75rem] w-[3.75rem] rounded-full bg-card/95 backdrop-blur-xl border border-edge grid place-items-center text-accent shrink-0 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6)] active:scale-95 transition"
          >
            <IconSparkle size={22} />
          </button>
        </div>
      </nav>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Mais">
        <div className="space-y-3.5">
          {SECONDARY_GROUPS.map((group) => (
            <section key={group.title}>
              <h3 className="text-[11px] font-semibold tracking-[0.12em] uppercase text-ink-faint mb-1 px-1">
                {group.title}
              </h3>
              {group.items.map((item) => {
                const active = isActive(item.href, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3.5 px-2 py-2 rounded-2xl ${
                      active ? "bg-soft" : ""
                    }`}
                  >
                    <span
                      className={`h-10 w-10 rounded-2xl grid place-items-center shrink-0 ${
                        active ? "bg-accent text-white" : "bg-soft text-ink-dim"
                      }`}
                    >
                      {item.icon(19)}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold text-ink leading-tight">
                        {item.label}
                      </span>
                      <span className="block text-[13px] text-ink-dim truncate">
                        {item.hint}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </section>
          ))}

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              onClick={() => {
                setMenuOpen(false);
                setSyncOpen(true);
              }}
              className="rounded-full bg-soft text-ink font-semibold py-3 text-sm inline-flex items-center justify-center gap-2"
            >
              <IconSync size={15} /> Sincronizar bancos
            </button>
            <button
              onClick={async () => {
                setMenuOpen(false);
                await api.logout().catch(() => {});
                window.location.href = "/login";
              }}
              className="rounded-full bg-soft text-ink-dim font-semibold py-3 text-sm inline-flex items-center justify-center gap-2"
            >
              <IconLogout size={15} /> Sair
            </button>
          </div>
        </div>
      </Sheet>

      <SyncSheet open={syncOpen} onClose={() => setSyncOpen(false)} />
      <InsightsSheet open={aiOpen} onClose={() => setAiOpen(false)} />
    </>
  );
}
