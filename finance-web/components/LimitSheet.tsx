"use client";

// Sheet para definir/editar limite mensal (geral ou por categoria).

import { useState } from "react";
import { api, brl0, parseBRL } from "@/lib/api";
import { bumpData } from "@/lib/bus";
import { catMeta } from "@/lib/categories";
import Sheet from "@/components/Sheet";
import {
  Field,
  FilterChip,
  inputCls,
  PrimaryButton,
  SecondaryButton,
} from "@/components/ui";

export interface LimitSuggestion {
  label: string;
  value: number;
}

export default function LimitSheet({
  open,
  onClose,
  category = "_global",
  current,
  suggestions = [],
}: {
  open: boolean;
  onClose: () => void;
  /** "_global" para o limite geral do mês. */
  category?: string;
  current: number | null;
  /** Valores prontos (ex.: sua média dos últimos meses) — um toque preenche. */
  suggestions?: LimitSuggestion[];
}) {
  const isGlobal = category === "_global";
  const title = isGlobal
    ? "Limite mensal de gastos"
    : `Limite — ${catMeta(category).label}`;

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {open && (
        <LimitForm
          key={`${category}:${current}`}
          category={category}
          current={current}
          isGlobal={isGlobal}
          suggestions={suggestions}
          onClose={onClose}
        />
      )}
    </Sheet>
  );
}

function LimitForm({
  category,
  current,
  isGlobal,
  suggestions,
  onClose,
}: {
  category: string;
  current: number | null;
  isGlobal: boolean;
  suggestions: LimitSuggestion[];
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(current ? String(current).replace(".", ",") : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(value: number) {
    setSaving(true);
    setError(null);
    try {
      await api.setBudget(category, value);
      bumpData();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function submit() {
    const value = parseBRL(amount);
    if (Number.isNaN(value) || value <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }
    save(value);
  }

  const useful = suggestions.filter((s) => s.value > 0);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <p className="text-sm text-ink-dim">
        {isGlobal
          ? "Quanto você planeja gastar por mês, no total."
          : "Quanto você planeja gastar por mês nesta categoria."}
      </p>
      <Field label="Valor (R$)">
        <input
          className={inputCls}
          inputMode="decimal"
          placeholder="0,00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoFocus
        />
      </Field>
      {useful.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {useful.map((s) => (
            <FilterChip
              key={s.label}
              active={parseBRL(amount) === s.value}
              onClick={() => setAmount(String(s.value))}
            >
              {s.label} · {brl0(s.value)}
            </FilterChip>
          ))}
        </div>
      )}
      {error && (
        <p className="text-xs text-neg" role="alert">
          {error}
        </p>
      )}
      <PrimaryButton type="submit" disabled={saving}>
        {saving ? "Salvando…" : "Salvar limite"}
      </PrimaryButton>
      {current !== null && current > 0 && (
        <SecondaryButton onClick={() => save(0)} disabled={saving}>
          Remover limite
        </SecondaryButton>
      )}
    </form>
  );
}
