"use client";

// Novo lançamento manual (conta Carteira), pensado para ser preenchido com o
// polegar: o valor vem primeiro e já com o teclado numérico aberto, categoria
// e data se resolvem com um toque (as do dia a dia ficam à mostra; a lista
// completa e o calendário só aparecem se você pedir).

import { useState } from "react";
import { api, parseBRL, todayIso } from "@/lib/api";
import { bumpData } from "@/lib/bus";
import { catMeta, QUICK_CATEGORIES } from "@/lib/categories";
import CategoryPicker from "@/components/CategoryPicker";
import Sheet from "@/components/Sheet";
import { Field, FilterChip, inputCls, PrimaryButton, SegTabs } from "@/components/ui";

type Kind = "expense" | "income";

export default function AddTxSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Novo lançamento">
      {/* Montado só enquanto aberto: cada abertura começa com o formulário limpo. */}
      {open && <AddTxForm onClose={onClose} />}
    </Sheet>
  );
}

function AddTxForm({ onClose }: { onClose: () => void }) {
  const today = todayIso();
  const yesterday = todayIso(-1);

  const [kind, setKind] = useState<Kind>("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [allCategories, setAllCategories] = useState(false);
  const [date, setDate] = useState(today);
  const [customDate, setCustomDate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quick: readonly string[] = QUICK_CATEGORIES[kind];
  // A categoria escolhida na lista completa entra nos chips, para continuar visível.
  const chips = category && !quick.includes(category) ? [category, ...quick] : quick;

  async function submit() {
    const value = parseBRL(amount);
    if (!value || value <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }
    if (!description.trim()) {
      setError("Diga o que foi — uma palavra já basta.");
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
        category: category ?? undefined,
      });
      bumpData();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (allCategories)
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setAllCategories(false)}
          className="text-sm font-semibold text-accent"
        >
          ‹ Voltar ao lançamento
        </button>
        <CategoryPicker
          value={category}
          onPick={(key) => {
            setCategory(key);
            setAllCategories(false);
          }}
        />
      </div>
    );

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <SegTabs
        variant="light"
        tabs={[
          { key: "expense", label: "Despesa" },
          { key: "income", label: "Receita" },
        ]}
        value={kind}
        onChange={(k) => {
          setKind(k as Kind);
          setCategory(null);
        }}
      />

      <label className="flex items-baseline justify-center gap-2 py-1">
        <span className="sr-only">Valor em reais</span>
        <span className="text-xl font-semibold text-ink-dim">R$</span>
        <input
          className="bg-transparent text-[2.5rem] font-semibold text-ink outline-none placeholder:text-ink-faint"
          style={{ width: `${Math.max(amount.length, 4) + 0.5}ch` }}
          inputMode="decimal"
          placeholder="0,00"
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
        />
      </label>

      <Field label="O que foi?">
        <input
          className={inputCls}
          placeholder={kind === "expense" ? "Ex.: padaria, Uber, farmácia…" : "Ex.: salário, reembolso…"}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          enterKeyHint="done"
        />
      </Field>

      <div>
        <div className="text-xs font-semibold text-ink-dim mb-1.5">Categoria (opcional)</div>
        <div className="flex flex-wrap gap-2">
          {chips.map((key) => (
            <FilterChip
              key={key}
              active={category === key}
              onClick={() => setCategory(category === key ? null : key)}
            >
              <span>{catMeta(key).icon}</span>
              {catMeta(key).label}
            </FilterChip>
          ))}
          <FilterChip active={false} onClick={() => setAllCategories(true)}>
            Outras…
          </FilterChip>
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-ink-dim mb-1.5">Quando</div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            active={!customDate && date === today}
            onClick={() => {
              setDate(today);
              setCustomDate(false);
            }}
          >
            Hoje
          </FilterChip>
          <FilterChip
            active={!customDate && date === yesterday}
            onClick={() => {
              setDate(yesterday);
              setCustomDate(false);
            }}
          >
            Ontem
          </FilterChip>
          <FilterChip active={customDate} onClick={() => setCustomDate(true)}>
            Outra data
          </FilterChip>
        </div>
        {customDate && (
          <input
            type="date"
            aria-label="Data do lançamento"
            className={`${inputCls} mt-2.5`}
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value || today)}
          />
        )}
      </div>

      {error && (
        <p className="text-xs text-neg" role="alert">
          {error}
        </p>
      )}
      <PrimaryButton type="submit" disabled={saving}>
        {saving ? "Salvando…" : kind === "expense" ? "Adicionar despesa" : "Adicionar receita"}
      </PrimaryButton>
    </form>
  );
}
