"use client";

// Detalhe de uma transação: valor, onde e quando, e as duas coisas que dá
// para fazer com ela — corrigir a categoria e ver as outras do mesmo lugar.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  DbTransaction,
  longDate,
  signedAmount,
  txAccountName,
  txTitle,
} from "@/lib/api";
import { bumpData } from "@/lib/bus";
import { catMeta, txGroup } from "@/lib/categories";
import CategorySheet from "@/components/CategorySheet";
import Sheet from "@/components/Sheet";
import { CategoryIcon, Money, SecondaryButton } from "@/components/ui";
import { IconChevronRight, IconSearch, IconTrash } from "@/components/icons";

/** Tira "3/10", datas e números soltos da descrição para buscar o mesmo lugar. */
function merchantQuery(description: string) {
  const base = description
    .replace(/\b\d{1,2}\s*\/\s*\d{1,2}\b/g, " ")
    .replace(/[*#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return base.split(" ").slice(0, 3).join(" ");
}

export default function TxDetailSheet({
  transaction,
  onClose,
  onChange,
}: {
  transaction: DbTransaction | null;
  onClose: () => void;
  /** Recebe a transação atualizada depois de corrigir a categoria. */
  onChange?: (t: DbTransaction) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setConfirmDelete(false);
    setError(null);
    onClose();
  }

  const t = transaction;
  const amt = t ? signedAmount(t) : 0;
  const kind = t ? txGroup(t.category, amt) : "consumption";
  const income = kind === "income" && amt > 0;
  const account = t ? txAccountName(t) : null;
  const manual = t?.accountId === "manual-wallet";
  const query = t ? merchantQuery(txTitle(t)) : "";

  return (
    <>
      <Sheet open={t !== null} onClose={close} title="Transação">
        {t && (
          <div className="space-y-4">
            <div className="text-center pb-1">
              <Money
                value={income ? amt : Math.abs(amt)}
                signed={income}
                className={`text-[2.1rem] ${income ? "text-pos" : "text-ink"}`}
              />
              <div className="text-[15px] font-medium text-ink mt-2 break-words">
                {txTitle(t)}
              </div>
              <div className="text-sm text-ink-dim mt-1">
                {longDate(t.date)}
                {account ? ` · ${account}` : ""}
              </div>
            </div>

            <button
              onClick={() => setEditing(true)}
              className="w-full flex items-center gap-3.5 rounded-2xl bg-soft px-4 py-3 text-left"
            >
              <CategoryIcon category={t.category} size="sm" />
              <span className="flex-1 min-w-0">
                <span className="block text-xs text-ink-dim">Categoria</span>
                <span className="block text-[15px] font-semibold text-ink truncate">
                  {catMeta(t.category).label}
                </span>
              </span>
              <span className="text-sm font-semibold text-accent inline-flex items-center gap-1">
                {t.categoryOverride ? "Corrigida" : "Corrigir"}
                <IconChevronRight size={13} />
              </span>
            </button>

            {query.length >= 3 && (
              <SecondaryButton
                onClick={() => {
                  close();
                  router.push(`/transacoes?q=${encodeURIComponent(query)}`);
                }}
              >
                <IconSearch size={15} /> Ver outras de “{query}”
              </SecondaryButton>
            )}

            {manual &&
              (confirmDelete ? (
                <SecondaryButton
                  tone="danger"
                  onClick={async () => {
                    try {
                      await api.deleteManualTx(t.id);
                      bumpData();
                      close();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  <IconTrash size={16} /> Toque de novo para excluir
                </SecondaryButton>
              ) : (
                <SecondaryButton tone="danger" onClick={() => setConfirmDelete(true)}>
                  <IconTrash size={16} /> Excluir lançamento
                </SecondaryButton>
              ))}

            {error && <p className="text-xs text-neg text-center">{error}</p>}
          </div>
        )}
      </Sheet>

      <CategorySheet
        transaction={editing ? t : null}
        onClose={() => setEditing(false)}
        onSaved={(updated) => onChange?.(updated)}
      />
    </>
  );
}
