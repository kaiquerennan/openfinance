"use client";

// Blocos de UI do design mobile (tema claro, estilo do app de referência).

import React from "react";
import { catColor, catMeta } from "@/lib/categories";
import { IconChevronLeft, IconChevronRight } from "@/components/icons";

export function Card({
  children,
  className = "",
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div className={`card p-5 ${className}`} onClick={onClick}>
      {children}
    </div>
  );
}

/** Valor monetário com "R$" menor, como no app de referência. */
export function Money({
  value,
  cents = true,
  className = "",
  signed = false,
}: {
  value: number;
  cents?: boolean;
  className?: string;
  signed?: boolean;
}) {
  const abs = Math.abs(value);
  const num = abs.toLocaleString("pt-BR", {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
  const sign = signed && value > 0 ? "+" : value < 0 ? "-" : "";
  return (
    <span className={`whitespace-nowrap ${className}`}>
      {sign}
      <span className="text-[0.72em] font-semibold align-baseline mr-0.5">R$</span>
      <span className="font-bold tracking-tight">{num}</span>
    </span>
  );
}

/** Chip pastel de categoria com emoji. */
export function Chip({ category }: { category: string | null | undefined }) {
  const meta = catMeta(category);
  const color = catColor(category);
  return (
    <span
      className="chip"
      style={{
        background: `color-mix(in srgb, ${color} 13%, white)`,
        color: `color-mix(in srgb, ${color} 80%, #333)`,
      }}
    >
      <span className="text-[11px]">{meta.icon}</span>
      {meta.label}
    </span>
  );
}

/** Tabs pill: variante "hero" (sobre o azul) e "light" (sobre fundo claro). */
export function SegTabs({
  tabs,
  value,
  onChange,
  variant = "hero",
  className = "",
}: {
  tabs: { key: string; label: string }[];
  value: string;
  onChange: (k: string) => void;
  variant?: "hero" | "light";
  className?: string;
}) {
  return (
    <div className={`${variant === "hero" ? "seg" : "seg-light"} flex ${className}`}>
      {tabs.map((t) => (
        <button
          key={t.key}
          data-active={value === t.key}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Navegação de mês "‹ Julho 2026 ›" (sobre o azul). */
export function MonthNav({
  months,
  value,
  onChange,
  label,
}: {
  months: string[];
  value: string;
  onChange: (m: string) => void;
  label: (m: string) => string;
}) {
  const i = months.indexOf(value);
  const canPrev = i > 0;
  const canNext = i >= 0 && i < months.length - 1;
  return (
    <div className="flex items-center justify-center gap-8 text-white">
      <button
        onClick={() => canPrev && onChange(months[i - 1])}
        className={canPrev ? "opacity-90" : "opacity-30"}
        aria-label="Mês anterior"
      >
        <IconChevronLeft size={20} />
      </button>
      <div className="text-lg font-semibold min-w-36 text-center">
        {value ? label(value) : "—"}
      </div>
      <button
        onClick={() => canNext && onChange(months[i + 1])}
        className={canNext ? "opacity-90" : "opacity-30"}
        aria-label="Próximo mês"
      >
        <IconChevronRight size={20} />
      </button>
    </div>
  );
}

/** Seletor de período flutuante 1M / 3M / 6M / 1 Ano. */
export function PeriodTabs({
  value,
  onChange,
}: {
  value: number;
  onChange: (months: number) => void;
}) {
  const opts = [
    { m: 1, label: "1M" },
    { m: 3, label: "3M" },
    { m: 6, label: "6M" },
    { m: 12, label: "1 Ano" },
  ];
  return (
    <div className="bg-white rounded-full p-1.5 flex items-center gap-1 shadow-[0_10px_30px_-10px_rgba(15,30,80,0.35)]">
      {opts.map((o) => (
        <button
          key={o.m}
          onClick={() => onChange(o.m)}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            value === o.m ? "bg-accent text-white" : "text-ink-dim"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function LoadingCard({ text = "Carregando…" }: { text?: string }) {
  return (
    <div className="card p-6 flex items-center gap-3 text-sm text-ink-dim">
      <span className="h-4 w-4 rounded-full border-2 border-azure-500 border-t-transparent animate-spin" />
      {text}
    </div>
  );
}

export function ErrorCard({ message }: { message: string }) {
  return (
    <div className="card p-5 border border-neg/30">
      <div className="text-sm font-semibold text-neg">Algo deu errado</div>
      <p className="text-xs text-ink-dim mt-1 break-words">{message}</p>
      <p className="text-xs text-ink-faint mt-2">
        Verifique se o backend (porta 3334) está rodando no computador e tente
        recarregar a página.
      </p>
    </div>
  );
}

export function EmptyState({
  text = "Sem dados ainda. Conecte uma conta ou adicione um lançamento.",
}: {
  text?: string;
}) {
  return (
    <div className="card p-8 text-center">
      <div className="text-3xl">🪺</div>
      <p className="text-sm text-ink-dim mt-2">{text}</p>
    </div>
  );
}

/** Cabeçalho de card com seta ">" à direita. */
export function CardHeader({
  title,
  onOpen,
}: {
  title: string;
  onOpen?: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-1">
      <h2 className="text-xl font-bold text-ink">{title}</h2>
      {onOpen && (
        <button
          onClick={onOpen}
          aria-label={`Abrir ${title}`}
          className="h-10 w-10 rounded-full bg-soft grid place-items-center text-ink-dim"
        >
          <IconChevronRight size={16} />
        </button>
      )}
    </div>
  );
}

/** Campo de formulário dos sheets. */
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-xs font-semibold text-ink-dim mb-1.5">{label}</div>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-2xl bg-soft px-4 py-3 text-sm font-medium text-ink outline-none focus:ring-2 focus:ring-azure-400 placeholder:text-ink-faint";

/** Botão primário azul dos sheets. */
export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-full bg-azure-600 text-white font-semibold py-3.5 text-sm disabled:opacity-50 active:scale-[0.99] transition"
    >
      {children}
    </button>
  );
}
