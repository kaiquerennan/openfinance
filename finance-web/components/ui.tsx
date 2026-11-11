"use client";

// Blocos de UI compartilhados por todas as telas. A regra é uma só: o mesmo
// tipo de informação usa sempre o mesmo componente (número principal, linha de
// lista, barra de progresso, filtro), para a pessoa aprender o app uma vez.

import React, { useState } from "react";
import { bumpData } from "@/lib/bus";
import { catColor, catMeta, polishTip } from "@/lib/categories";
import { maskAmount, useHideValues } from "@/lib/privacy";
import {
  IconChevronLeft,
  IconChevronRight,
  IconSparkle,
  IconX,
} from "@/components/icons";

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
    <div
      className={`card p-5 ${onClick ? "cursor-pointer active:scale-[0.995] transition" : ""} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

/** Valor monetário com "R$" menor. */
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
  const hide = useHideValues();
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
      <span className="font-bold tracking-tight">{hide ? "••••" : num}</span>
    </span>
  );
}

/** Envolve um texto já formatado (brl/brl0) pra respeitar o "esconder valores". */
export function Amount({ children }: { children: string }) {
  const hide = useHideValues();
  return <>{maskAmount(children, hide)}</>;
}

/** Chip de categoria com emoji. */
export function Chip({ category }: { category: string | null | undefined }) {
  const meta = catMeta(category);
  const color = catColor(category);
  return (
    <span
      className="chip"
      style={{
        background: `color-mix(in srgb, ${color} 22%, black)`,
        color: `color-mix(in srgb, ${color} 65%, white)`,
      }}
    >
      <span className="text-[11px]">{meta.icon}</span>
      {meta.label}
    </span>
  );
}

/** Quadradinho com o emoji da categoria, tingido pela cor dela. */
export function CategoryIcon({
  category,
  size = "md",
}: {
  category: string | null | undefined;
  size?: "sm" | "md";
}) {
  const color = catColor(category);
  return (
    <span
      className={`grid place-items-center shrink-0 ${
        size === "sm" ? "h-9 w-9 rounded-xl text-base" : "h-11 w-11 rounded-2xl text-lg"
      }`}
      style={{ background: `color-mix(in srgb, ${color} 18%, var(--color-soft))` }}
    >
      {catMeta(category).icon}
    </span>
  );
}

/** Abas em pílula. `count` opcional aparece ao lado do rótulo. */
export function SegTabs({
  tabs,
  value,
  onChange,
  variant = "hero",
  className = "",
}: {
  tabs: { key: string; label: string; count?: number }[];
  value: string;
  onChange: (k: string) => void;
  variant?: "hero" | "light";
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={`${variant === "hero" ? "seg" : "seg-light"} flex ${className}`}
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={value === t.key}
          data-active={value === t.key}
          onClick={() => onChange(t.key)}
        >
          {t.label}
          {t.count !== undefined && t.count > 0 && (
            <span className="ml-1.5 opacity-70">{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Navegação de mês "‹ Julho 2026 ›". */
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
  const arrow = "h-10 w-10 rounded-full grid place-items-center bg-soft text-ink-dim disabled:opacity-30";
  return (
    <div className="flex items-center justify-between gap-2">
      <button
        onClick={() => onChange(months[i - 1])}
        disabled={!canPrev}
        className={arrow}
        aria-label="Mês anterior"
      >
        <IconChevronLeft size={16} />
      </button>
      <div className="text-[15px] font-semibold text-ink text-center flex-1">
        {value ? label(value) : "—"}
      </div>
      <button
        onClick={() => onChange(months[i + 1])}
        disabled={!canNext}
        className={arrow}
        aria-label="Próximo mês"
      >
        <IconChevronRight size={16} />
      </button>
    </div>
  );
}

/**
 * Seletor de período. Mais leve que as abas de propósito: quando aparece logo
 * abaixo delas, dois controles com o mesmo peso viram um bloco só de botões.
 */
export function PeriodTabs({
  value,
  onChange,
}: {
  value: number;
  onChange: (months: number) => void;
}) {
  const opts = [
    { m: 1, label: "1 mês" },
    { m: 3, label: "3 meses" },
    { m: 6, label: "6 meses" },
    { m: 12, label: "1 ano" },
  ];
  return (
    <div className="flex items-center gap-1.5" role="tablist" aria-label="Período">
      {opts.map((o) => (
        <button
          key={o.m}
          role="tab"
          aria-selected={value === o.m}
          onClick={() => onChange(o.m)}
          className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
            value === o.m ? "bg-soft text-ink" : "text-ink-dim"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Número principal da tela: rótulo, valor grande e uma linha que dá sentido a
 * ele. Fica sempre no mesmo lugar (logo abaixo do título) e com o mesmo peso
 * em todas as páginas.
 */
export function PageHero({
  label,
  value,
  hint,
  children,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <div className="text-sm text-ink-dim">{label}</div>
      <div className="text-[2.5rem] leading-[1.15] font-semibold tracking-tight mt-0.5">
        {value}
      </div>
      {hint && <div className="text-sm text-ink-dim mt-1.5">{hint}</div>}
      {children}
    </div>
  );
}

/** Barra de progresso única do app. `ratio` de 0 a 1 (acima de 1 = estourou). */
export function ProgressBar({
  ratio,
  color = "var(--color-accent)",
  size = "md",
  className = "",
}: {
  ratio: number;
  color?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const over = ratio > 1;
  const pct = Math.max(0, Math.min(ratio, 1)) * 100;
  return (
    <div
      className={`${size === "sm" ? "h-1.5" : "h-2"} rounded-full bg-soft overflow-hidden ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(ratio * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{ width: `${pct}%`, background: over ? "var(--color-neg)" : color }}
      />
    </div>
  );
}

/** Filtro em pílula: um toque liga/desliga, sem abrir sheet nem dropdown. */
export function FilterChip({
  active,
  onClick,
  children,
  onClear,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  /** Mostra um "×" para limpar sem reabrir a escolha. */
  onClear?: () => void;
}) {
  return (
    <span
      className={`shrink-0 inline-flex items-center rounded-full text-sm font-semibold transition ${
        active ? "bg-accent text-white" : "bg-soft text-ink-dim"
      }`}
    >
      <button
        onClick={onClick}
        aria-pressed={active}
        className={`py-2 ${onClear && active ? "pl-3.5 pr-1.5" : "px-3.5"} inline-flex items-center gap-1.5 whitespace-nowrap`}
      >
        {children}
      </button>
      {onClear && active && (
        <button onClick={onClear} aria-label="Limpar filtro" className="pr-2.5 pl-0.5 py-2">
          <IconX size={13} />
        </button>
      )}
    </span>
  );
}

/** Linha padrão de lista: ícone, título, subtítulo e valor à direita. */
export function ListRow({
  icon,
  title,
  subtitle,
  right,
  onClick,
  className = "",
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const body = (
    <>
      {icon !== undefined &&
        (typeof icon === "string" ? (
          <span className="h-11 w-11 rounded-2xl bg-soft grid place-items-center text-lg shrink-0">
            {icon}
          </span>
        ) : (
          icon
        ))}
      <span className="flex-1 min-w-0 text-left">
        <span className="block text-[15px] font-semibold text-ink truncate">{title}</span>
        {subtitle && (
          <span className="block text-[13px] text-ink-dim truncate mt-0.5">{subtitle}</span>
        )}
      </span>
      {right && <span className="shrink-0 text-right">{right}</span>}
    </>
  );
  const cls = `w-full flex items-center gap-3.5 py-3 ${className}`;
  return onClick ? (
    <button onClick={onClick} className={cls}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/**
 * Dica da análise: discreta de propósito, para não disputar atenção com o
 * número principal da tela. Um toque mostra a próxima.
 */
export function TipCarousel({ tips }: { tips: string[] }) {
  const [i, setI] = useState(0);
  if (tips.length === 0) return null;
  const idx = i % tips.length;
  const many = tips.length > 1;
  return (
    <button
      onClick={() => many && setI((n) => n + 1)}
      className="card w-full text-left px-5 py-4 flex gap-3.5 items-start"
      aria-label={many ? "Dica do Visor — toque para ver a próxima" : "Dica do Visor"}
    >
      <span className="h-9 w-9 rounded-xl bg-accent/15 text-accent grid place-items-center shrink-0">
        <IconSparkle size={16} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] leading-snug text-ink">{polishTip(tips[idx])}</span>
        {many && (
          <span className="flex items-center gap-1.5 mt-2.5">
            {tips.map((_, d) => (
              <span
                key={d}
                className={`h-1 rounded-full transition-all ${
                  d === idx ? "w-4 bg-accent" : "w-1 bg-edge"
                }`}
              />
            ))}
            <span className="text-xs text-ink-faint ml-1.5">toque para a próxima</span>
          </span>
        )}
      </span>
    </button>
  );
}

export function LoadingCard({ text = "Carregando…" }: { text?: string }) {
  return (
    <div className="card p-6 flex items-center gap-3 text-sm text-ink-dim" role="status">
      <span className="h-4 w-4 rounded-full border-2 border-azure-500 border-t-transparent animate-spin" />
      {text}
    </div>
  );
}

export function ErrorCard({
  message,
  onRetry = bumpData,
}: {
  message: string;
  /** Padrão: pede para todas as telas buscarem os dados de novo. */
  onRetry?: (() => void) | null;
}) {
  return (
    <div className="card p-5 border border-neg/30" role="alert">
      <div className="text-sm font-semibold text-neg">Não deu para carregar</div>
      <p className="text-xs text-ink-dim mt-1 break-words">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-full bg-soft text-ink font-semibold px-4 py-2 text-sm"
        >
          Tentar de novo
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  icon = "🪺",
  text = "Sem dados ainda. Conecte uma conta ou adicione um lançamento.",
  action,
}: {
  icon?: string;
  text?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="card p-8 text-center">
      <div className="text-3xl">{icon}</div>
      <p className="text-sm text-ink-dim mt-2">{text}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 rounded-full bg-accent text-white font-semibold px-5 py-2.5 text-sm"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/** Cabeçalho de card; com `onOpen` vira um link "Ver tudo ›" de área de toque inteira. */
export function CardHeader({
  title,
  onOpen,
  openLabel = "Ver tudo",
  right,
}: {
  title: string;
  onOpen?: () => void;
  openLabel?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-1 min-h-9">
      <h2 className="text-[17px] font-bold text-ink">{title}</h2>
      {right}
      {onOpen && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="inline-flex items-center gap-1 text-sm font-semibold text-accent py-2 pl-3 -mr-1"
        >
          {openLabel}
          <IconChevronRight size={13} />
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

/** Botão primário dos sheets. */
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

/** Botão secundário (ação alternativa ou destrutiva com `tone="danger"`). */
export function SecondaryButton({
  children,
  onClick,
  disabled,
  tone = "neutral",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "neutral" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-full font-semibold py-3.5 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99] transition ${
        tone === "danger" ? "bg-neg/10 text-neg" : "bg-soft text-ink"
      }`}
    >
      {children}
    </button>
  );
}
