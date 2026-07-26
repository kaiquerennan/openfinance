"use client";

// Sheet de novo lançamento manual (conta Carteira).

import { useState } from "react";
import { api } from "@/lib/api";
import { bumpData } from "@/lib/bus";
import { allCategories } from "@/lib/categories";
import Sheet from "@/components/Sheet";
import { Field, inputCls, PrimaryButton, SegTabs } from "@/components/ui";

export default function AddTxSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const value = Number(amount.replace(",", "."));
    if (!description.trim() || !value || value <= 0) {
      setError("Preencha a descrição e um valor maior que zero.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.manualTx({
        description: description.trim(),
        amount: value,
        kind,
        date,
        category: category || undefined,
      });
      bumpData();
      setDescription("");
      setAmount("");
      setCategory("");
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Novo lançamento">
      <div className="space-y-4">
        <SegTabs
          variant="light"
          tabs={[
            { key: "expense", label: "Despesa" },
            { key: "income", label: "Receita" },
          ]}
          value={kind}
          onChange={(k) => setKind(k as "expense" | "income")}
        />
        <Field label="Descrição">
          <input
            className={inputCls}
            placeholder="Ex.: Padaria, Uber, Salário…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor (R$)">
            <input
              className={inputCls}
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Data">
            <input
              type="date"
              className={inputCls}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Categoria">
          <select
            className={inputCls}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Sem categoria</option>
            {allCategories().map((c) => (
              <option key={c.key} value={c.key}>
                {c.icon} {c.label}
              </option>
            ))}
          </select>
        </Field>
        {error && <p className="text-xs text-neg">{error}</p>}
        <PrimaryButton onClick={submit} disabled={saving}>
          {saving ? "Salvando…" : "Adicionar"}
        </PrimaryButton>
      </div>
    </Sheet>
  );
}
