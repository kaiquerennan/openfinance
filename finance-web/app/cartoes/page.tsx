"use client";

// Cartões: fatura atual, vencimento e limite de cada cartão. Histórico de
// faturas e compras ficam recolhidos — são consulta, não o que se vem ver.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  accountTitle,
  api,
  brl0,
  CardBills,
  daysUntil,
  DbAccount,
  DbTransaction,
} from "@/lib/api";
import { useDataVersion } from "@/lib/bus";
import PageHeader from "@/components/Header";
import BillHistory from "@/components/BillHistory";
import TxList from "@/components/TxList";
import {
  Amount,
  Card,
  EmptyState,
  ErrorCard,
  LoadingCard,
  Money,
  PageHero,
  ProgressBar,
} from "@/components/ui";
import { IconChevronRight } from "@/components/icons";

function dueText(dias: number) {
  if (dias < 0) return `venceu há ${Math.abs(dias)} ${Math.abs(dias) === 1 ? "dia" : "dias"}`;
  if (dias === 0) return "vence hoje";
  if (dias === 1) return "vence amanhã";
  return `vence em ${dias} dias`;
}

/** Vencimento da fatura + barra de limite usado. */
function CardStatus({ account }: { account: DbAccount }) {
  const limit = Number(account.creditLimit ?? 0);
  const available = account.availableCreditLimit
    ? Number(account.availableCreditLimit)
    : null;
  const used = limit > 0 && available !== null ? limit - available : null;
  const usedRatio = used !== null && limit > 0 ? Math.min(used / limit, 1) : null;

  const dias = account.balanceDueDate ? daysUntil(account.balanceDueDate) : null;
  const urgente = dias !== null && dias <= 5;

  // Cartão sem nenhum dado de crédito sincronizado ainda: nada a mostrar.
  if (usedRatio === null && dias === null) return null;

  return (
    <div className="mt-4 space-y-3">
      {dias !== null && (
        <div
          className={`flex items-center justify-between rounded-2xl px-4 py-3 ${
            urgente ? "bg-neg/15" : "bg-soft"
          }`}
        >
          <span className="text-sm text-ink-dim">Fatura</span>
          <span className={`text-sm font-bold ${urgente ? "text-neg" : "text-ink"}`}>
            {dueText(dias)}
          </span>
        </div>
      )}

      {usedRatio !== null && (
        <div>
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-ink-dim">Limite usado</span>
            <span className="text-ink font-semibold">
              <Amount>{brl0(used ?? 0)}</Amount> de <Amount>{brl0(limit)}</Amount>
            </span>
          </div>
          <ProgressBar
            ratio={usedRatio}
            color={
              usedRatio >= 0.8
                ? "var(--color-neg)"
                : usedRatio >= 0.5
                  ? "var(--color-amber)"
                  : "var(--color-pos)"
            }
          />
          <div className="text-xs text-ink-dim mt-1.5">
            {usedRatio >= 0.8 ? (
              `${Math.round(usedRatio * 100)}% do limite comprometido — cuidado com o rotativo.`
            ) : (
              <>
                Restam <Amount>{brl0(available ?? 0)}</Amount> de limite.
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Seção que abre e fecha — histórico e compras não disputam espaço com a fatura. */
function Disclosure({
  title,
  hint,
  children,
  defaultOpen = false,
}: {
  title: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-edge mt-4 pt-1">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 py-3 text-left"
      >
        <span className="text-[15px] font-semibold text-ink">{title}</span>
        <span className="flex items-center gap-2 text-[13px] text-ink-dim">
          {hint}
          <span className={`text-ink-faint transition-transform ${open ? "rotate-90" : ""}`}>
            <IconChevronRight size={14} />
          </span>
        </span>
      </button>
      {open && <div className="pb-1">{children}</div>}
    </div>
  );
}

export default function CartoesPage() {
  const router = useRouter();
  const version = useDataVersion();
  const [accounts, setAccounts] = useState<DbAccount[] | null>(null);
  const [txs, setTxs] = useState<Record<string, DbTransaction[]>>({});
  const [bills, setBills] = useState<Record<string, CardBills>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const accs = (await api.accounts()).filter((a) => a.type === "CREDIT");
        setAccounts(accs);
        setError(null);
        const pages = await Promise.all(
          accs.map((a) => api.transactions({ accountId: a.id, take: 6 })),
        );
        setTxs(Object.fromEntries(accs.map((a, i) => [a.id, pages[i].transactions])));
        // Histórico de faturas: nem toda instituição expõe. Sem ele a tela
        // continua mostrando saldo, limite e compras.
        const cards = await api.cardBills().catch(() => []);
        setBills(Object.fromEntries(cards.map((c) => [c.accountId, c])));
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [version]);

  const cards = accounts ?? [];
  const totalFatura = cards.reduce((s, a) => s + Math.abs(Number(a.balance ?? 0)), 0);

  // Próximo vencimento ainda por vir, entre todos os cartões.
  const dueDays = cards
    .filter((a) => a.balanceDueDate && Math.abs(Number(a.balance ?? 0)) > 0)
    .map((a) => daysUntil(a.balanceDueDate as string));
  const nextDue = dueDays.filter((d) => d >= 0).sort((a, b) => a - b)[0];
  const overdue = dueDays.filter((d) => d < 0).length;

  return (
    <div>
      <PageHeader title="Cartões" back>
        <PageHero
          label={cards.length > 1 ? "Faturas atuais somadas" : "Fatura atual"}
          value={<Amount>{brl0(totalFatura)}</Amount>}
          hint={
            accounts
              ? overdue > 0
                ? `${overdue} ${overdue === 1 ? "fatura" : "faturas"} com vencimento já passado`
                : nextDue !== undefined
                  ? `Próxima ${dueText(nextDue)}`
                  : `${cards.length} ${cards.length === 1 ? "cartão" : "cartões"}`
              : undefined
          }
        />
      </PageHeader>

      <div className="px-4 mt-5 space-y-4">
        {error && <ErrorCard message={error} />}
        {!accounts ? (
          !error && <LoadingCard />
        ) : cards.length === 0 ? (
          <EmptyState
            icon="💳"
            text="Nenhum cartão de crédito conectado ainda."
            action={{ label: "Conectar em Contas", onClick: () => router.push("/contas") }}
          />
        ) : (
          <div className="rise space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-5 lg:items-start">
            {cards.map((a) => {
              const card = bills[a.id];
              const list = txs[a.id] ?? [];
              return (
                <Card key={a.id}>
                  <div className="rounded-3xl p-5 text-white bg-gradient-to-br from-[#22315e] to-[#0f1830]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold truncate">{accountTitle(a)}</span>
                      <span className="text-white/60 text-sm shrink-0">
                        {[a.cardBrand, a.number ? `•••• ${a.number.slice(-4)}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </div>
                    <div className="flex items-end justify-between mt-6">
                      <span className="text-white/60 text-xs">Fatura atual</span>
                      <Money value={Math.abs(Number(a.balance ?? 0))} className="text-2xl" />
                    </div>
                  </div>

                  <CardStatus account={a} />

                  {card && (card.bills.length > 0 || card.open) && (
                    <Disclosure
                      title="Faturas"
                      hint={
                        card.bills.length > 0 ? (
                          <>
                            média <Amount>{brl0(card.average)}</Amount>
                          </>
                        ) : (
                          "próxima em aberto"
                        )
                      }
                    >
                      <BillHistory card={card} />
                    </Disclosure>
                  )}

                  <Disclosure
                    title="Últimas compras"
                    hint={list.length ? `${list.length} mais recentes` : undefined}
                    defaultOpen={cards.length === 1}
                  >
                    <TxList
                      transactions={list}
                      showAccount={false}
                      emptyText="Nenhuma compra neste cartão ainda."
                    />
                    <button
                      onClick={() => router.push(`/transacoes?conta=${a.id}`)}
                      className="w-full text-sm font-semibold text-accent pt-3"
                    >
                      Ver todas as compras deste cartão
                    </button>
                  </Disclosure>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
