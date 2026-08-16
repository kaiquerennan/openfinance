"use client";

// Corrigir a categoria de uma transação. A classificação do Open Finance erra
// bastante e ela alimenta orçamento, análise e índice de saúde — sem poder
// corrigir, o número fica errado em todas as telas.

import { useState } from "react";
import { api, DbTransaction } from "@/lib/api";
import { CATEGORY_OPTIONS } from "@/lib/categories";
import { bumpData } from "@/lib/bus";
import Sheet from "@/components/Sheet";
import { inputCls } from "@/components/ui";
import { IconCheck, IconSearch } from "@/components/icons";

export default function CategorySheet({
  transaction,
  onClose,
  onSaved,
}: {
  transaction: DbTransaction | null;
  onClose: () => void;
  /** Recebe a transação já com a categoria nova. */
  onSaved?: (t: DbTransaction) => void;
}) {
  const [busca, setBusca] = useState("");
  const [todas, setTodas] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const atual = transaction?.category?.trim().toLowerCase() ?? null;
  const descricao = transaction?.description ?? transaction?.descriptionRaw ?? "";
  const termo = busca.trim().toLowerCase();
  const opcoes = termo
    ? CATEGORY_OPTIONS.filter((o) => o.label.toLowerCase().includes(termo))
    : CATEGORY_OPTIONS;

  async function salvar(categoria: string | null) {
    if (!transaction || salvando) return;
    setSalvando(true);
    setErro(null);
    try {
      const atualizada = await api.setTxCategory(transaction.id, categoria, todas);
      onSaved?.(atualizada);
      bumpData();
      fechar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  function fechar() {
    setBusca("");
    setTodas(false);
    setErro(null);
    onClose();
  }

  return (
    <Sheet open={transaction !== null} onClose={fechar} title="Categoria">
      <div className="space-y-4">
        <div className="text-sm text-ink-dim truncate">{descricao}</div>

        <label className="flex items-center gap-2 bg-soft rounded-2xl px-4">
          <span className="text-ink-faint">
            <IconSearch size={16} />
          </span>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar categoria"
            className={`${inputCls} bg-transparent px-0`}
          />
        </label>

        <button
          onClick={() => setTodas((v) => !v)}
          className="w-full flex items-start gap-3 text-left rounded-2xl bg-soft px-4 py-3"
        >
          <span
            className={`mt-0.5 h-5 w-5 rounded-md grid place-items-center shrink-0 ${
              todas ? "bg-accent text-white" : "border border-edge"
            }`}
          >
            {todas && <IconCheck size={12} />}
          </span>
          <span>
            <span className="block text-sm font-semibold text-ink">
              Valer para toda transação com esta descrição
            </span>
            <span className="block text-xs text-ink-dim mt-0.5">
              Corrige as antigas e as que chegarem nos próximos syncs.
            </span>
          </span>
        </button>

        {erro && <p className="text-xs text-neg">{erro}</p>}

        <div className="max-h-[45dvh] overflow-y-auto -mx-1 px-1">
          {opcoes.map((o) => (
            <button
              key={o.key}
              disabled={salvando}
              onClick={() => salvar(o.key)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left ${
                o.key === atual ? "bg-soft" : ""
              }`}
            >
              <span className="text-lg">{o.icon}</span>
              <span className="flex-1 text-[15px] font-medium text-ink">{o.label}</span>
              {o.key === atual && (
                <span className="text-accent">
                  <IconCheck size={14} />
                </span>
              )}
            </button>
          ))}
          {opcoes.length === 0 && (
            <p className="text-sm text-ink-faint text-center py-6">
              Nenhuma categoria com esse nome.
            </p>
          )}
        </div>

        {transaction?.categoryOverride && (
          <button
            disabled={salvando}
            onClick={() => salvar(null)}
            className="w-full rounded-full bg-soft text-ink-dim font-semibold py-3.5 text-sm"
          >
            Voltar para a categoria original do banco
          </button>
        )}
      </div>
    </Sheet>
  );
}
