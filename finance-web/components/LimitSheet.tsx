"use client";

// Sheet para definir/editar limite mensal (geral ou por categoria).

import { useState } from "react";
import { api } from "@/lib/api";
import { bumpData } from "@/lib/bus";
import { catMeta } from "@/lib/categories";
import Sheet from "@/components/Sheet";
import { Field, inputCls, PrimaryButton } from "@/components/ui";

export default function LimitSheet({
  open,
  onClose,
  category = "_global",
  current,
}: {
  open: boolean;
  onClose: () => void;
  /** "_global" para o limite geral do mês. */
  category?: string;
  current: number | null;
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
  onClose,
}: {
  category: string;
  current: number | null;
  isGlobal: boolean;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(current ? String(current) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const value = Number(amount.replace(",", "."));
    if (Number.isNaN(value) || value < 0) {
      setError("Informe um valor válido (0 remove o limite).");
      return;
    }
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

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-dim">
        {isGlobal
          ? "Quanto você planeja gastar por mês, no total."
          : "Quanto você planeja gastar por mês nesta categoria."}{" "}
        Use 0 para remover o limite.
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
      {error && <p className="text-xs text-neg">{error}</p>}
      <PrimaryButton onClick={submit} disabled={saving}>
        {saving ? "Salvando…" : "Salvar limite"}
      </PrimaryButton>
    </div>
  );
}
