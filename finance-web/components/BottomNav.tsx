"use client";

// Nav inferior flutuante: pill com 4 abas (a 4ª é um slot alternável) +
// botão de insights (✦) que abre a análise do consultor.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, AnalyticsReport } from "@/lib/api";
import Sheet from "@/components/Sheet";
import {
  IconArrows,
  IconBars,
  IconCard,
  IconHome,
  IconPie,
  IconSparkle,
  IconTrophy,
  IconUpDown,
  IconWallet,
} from "@/components/icons";

const SLOT_OPTIONS = [
  { href: "/contas", label: "Contas", icon: <IconWallet size={22} /> },
  { href: "/metas", label: "Metas", icon: <IconTrophy size={22} /> },
  { href: "/cartoes", label: "Cartões", icon: <IconCard size={22} /> },
  { href: "/investimentos", label: "Investimentos", icon: <IconPie size={22} /> },
];

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
      className={`h-12 w-12 rounded-full grid place-items-center transition ${
        active ? "bg-[#e4ebfb] text-accent" : "text-[#b9bec9]"
      }`}
    >
      {children}
    </Link>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [slot, setSlot] = useState(0);
  const [slotOpen, setSlotOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Preferência persistida do 4º slot (leitura única pós-hidratação).
  useEffect(() => {
    const saved = Number(localStorage.getItem("nav-slot") ?? "0");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync inicial com localStorage
    if (saved >= 0 && saved < SLOT_OPTIONS.length) setSlot(saved);
  }, []);

  // Se a rota atual é uma das opções do slot, ela vence a preferência salva.
  const routeIdx = SLOT_OPTIONS.findIndex((o) => o.href === pathname);
  const effSlot = routeIdx >= 0 ? routeIdx : slot;

  useEffect(() => {
    if (routeIdx >= 0) localStorage.setItem("nav-slot", String(routeIdx));
  }, [routeIdx]);

  useEffect(() => {
    if (!aiOpen || report) return;
    api
      .report()
      .then(setReport)
      .catch((e) => setAiError(e.message));
  }, [aiOpen, report]);

  const current = SLOT_OPTIONS[effSlot];
  const slotActive = pathname === current.href;

  const insights = report
    ? [
        ...report.narrative.avisos,
        ...report.narrative.insightsAutomaticos,
        ...report.narrative.alertas,
        ...report.narrative.oportunidades,
        ...report.narrative.recomendacoes,
      ]
    : [];

  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 z-40 pointer-events-none">
        <div className="mx-auto w-full max-w-md px-4 pb-4 pt-2 flex items-center gap-3">
          <div className="pointer-events-auto flex-1 flex items-center justify-between bg-white/90 backdrop-blur-xl rounded-full px-3 py-2 shadow-[0_12px_40px_-12px_rgba(10,30,80,0.35)]">
            <NavItem href="/" active={pathname === "/"} label="Visão geral">
              <IconHome />
            </NavItem>
            <NavItem
              href="/transacoes"
              active={pathname.startsWith("/transacoes")}
              label="Transações"
            >
              <IconArrows />
            </NavItem>
            <NavItem
              href="/analises"
              active={pathname.startsWith("/analises")}
              label="Análises"
            >
              <IconBars />
            </NavItem>
            <button
              aria-label={current.label}
              onClick={() =>
                slotActive ? setSlotOpen(true) : router.push(current.href)
              }
              className={`h-12 px-3 rounded-full flex items-center gap-1 transition ${
                slotActive ? "bg-[#e4ebfb] text-accent" : "text-[#b9bec9]"
              }`}
            >
              {current.icon}
              <IconUpDown size={11} />
            </button>
          </div>
          <button
            aria-label="Insights do consultor"
            onClick={() => setAiOpen(true)}
            className="pointer-events-auto h-14 w-14 rounded-full bg-white/90 backdrop-blur-xl grid place-items-center text-[#b9bec9] shadow-[0_12px_40px_-12px_rgba(10,30,80,0.35)]"
          >
            <IconSparkle size={24} />
          </button>
        </div>
      </nav>

      {/* Alternador do 4º slot */}
      {slotOpen && (
        <div className="fixed inset-0 z-50" onClick={() => setSlotOpen(false)}>
          <div className="absolute inset-0 bg-black/20 fade-in" />
          <div className="absolute bottom-24 inset-x-0 mx-auto w-full max-w-md px-4">
            <div
              className="pop ml-auto mr-16 w-56 bg-white rounded-3xl p-2 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {SLOT_OPTIONS.map((o, i) => (
                <button
                  key={o.href}
                  onClick={() => {
                    setSlot(i);
                    localStorage.setItem("nav-slot", String(i));
                    setSlotOpen(false);
                    router.push(o.href);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold ${
                    i === effSlot ? "bg-soft text-accent" : "text-ink-dim"
                  }`}
                >
                  {o.icon}
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Insights (✦) */}
      <Sheet open={aiOpen} onClose={() => setAiOpen(false)} title="Insights ✦">
        {aiError ? (
          <p className="text-sm text-neg">{aiError}</p>
        ) : !report ? (
          <p className="text-sm text-ink-dim py-6 text-center">
            Analisando suas finanças…
          </p>
        ) : (
          <div className="space-y-3">
            {insights.slice(0, 10).map((t, i) => (
              <div
                key={i}
                className="flex gap-3 bg-soft rounded-2xl p-4 text-sm text-ink leading-relaxed"
              >
                <span className="text-accent shrink-0 mt-0.5">
                  <IconSparkle size={16} />
                </span>
                {t}
              </div>
            ))}
            {insights.length === 0 && (
              <p className="text-sm text-ink-dim">Sem insights para este mês.</p>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}
