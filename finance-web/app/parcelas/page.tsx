"use client";

// Parcelas: o que já foi comprado mas ainda vai ser cobrado. O extrato só
// mostra a parcela do mês; aqui aparece o mês que vem inteiro, antes de ele
// começar — que é quando ainda dá pra decidir não parcelar mais nada.

import { useEffect, useState } from "react";
import {
  api,
  brl,
  brl0,
  InstallmentsOverview,
  monthLabel,
} from "@/lib/api";
import { useDataVersion } from "@/lib/bus";
import BlueHeader from "@/components/Header";
import {
  Amount,
  Card,
  CardHeader,
  EmptyState,
  ErrorCard,
  LoadingCard,
  Money,
} from "@/components/ui";

const HORIZON = 12;

/** Barra "3 de 10 pagas" da compra. */
function Progress({ paid, total }: { paid: number; total: number }) {
  return (
    <div className="mt-2.5">
      <div className="h-1.5 rounded-full bg-soft overflow-hidden">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${(paid / total) * 100}%` }}
        />
      </div>
      <div className="text-xs text-ink-dim mt-1.5">
        {paid} de {total} parcelas pagas · faltam {total - paid}
      </div>
    </div>
  );
}

export default function ParcelasPage() {
  const version = useDataVersion();
  const [data, setData] = useState<InstallmentsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .installments(HORIZON)
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, [version]);

  const meses = data?.monthly ?? [];
  const pico = Math.max(1, ...meses.map((m) => m.amount));

  return (
    <div>
      <BlueHeader title="Parcelas">
        <div className="mt-4">
          <div className="text-ink-dim text-[15px]">JÁ COMPROMETIDO</div>
          <div className="text-4xl font-semibold mt-1">
            <Amount>{brl0(data?.committedTotal ?? 0)}</Amount>
          </div>
          <div className="text-ink-faint mt-2 text-[15px]">
            {data
              ? data.plans.length === 0
                ? "Nenhuma compra parcelada em aberto"
                : `${data.plans.length} compra(s) parcelada(s)${
                    data.freeFrom ? ` · livre a partir de ${monthLabel(data.freeFrom)}` : ""
                  }`
              : "…"}
          </div>
        </div>
      </BlueHeader>

      <div className="px-4 mt-5 space-y-4">
        {error && <ErrorCard message={error} />}
        {!data ? (
          <LoadingCard text="Remontando os parcelamentos…" />
        ) : data.plans.length === 0 ? (
          <EmptyState text="Nenhuma parcela em aberto nos cartões conectados." />
        ) : (
          <div className="rise space-y-4">
            {data.nextMonth && data.nextMonth.amount > 0 && (
              <Card>
                <div className="text-sm text-ink-dim">
                  Em {monthLabel(data.nextMonth.month)} você já deve
                </div>
                <div className="mt-1 flex items-end justify-between">
                  <Money value={data.nextMonth.amount} className="text-3xl text-ink" />
                  {data.monthlyIncome ? (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-soft text-ink-dim">
                      {Math.round((data.nextMonth.amount / data.monthlyIncome) * 100)}% da
                      renda
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-ink-faint mt-2">
                  Esse valor já está contratado: ele sai do mês que vem mesmo que você
                  não gaste mais nada.
                </p>
              </Card>
            )}

            <Card>
              <CardHeader title="Próximos meses" />
              <div className="mt-3 space-y-2.5">
                {meses.map((m) => (
                  <div key={m.month} className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-xs text-ink-dim">
                      {monthLabel(m.month).slice(0, 3)}/{m.month.slice(2, 4)}
                    </span>
                    <div className="flex-1 h-2.5 rounded-full bg-soft overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${(m.amount / pico) * 100}%` }}
                      />
                    </div>
                    <span className="w-24 shrink-0 text-right text-xs font-semibold text-ink">
                      <Amount>{brl0(m.amount)}</Amount>
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="divide-y divide-edge">
              <CardHeader title="Compras parceladas" />
              {data.plans.map((p) => (
                <div key={p.key} className="py-3.5 first:pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[15px] font-semibold text-ink truncate">
                        {p.description}
                      </div>
                      <div className="text-xs text-ink-dim mt-0.5">
                        {p.accountName} · última em {monthLabel(p.endsOn)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <Money value={p.installmentAmount} className="text-[15px] text-ink" />
                      <div className="text-xs text-ink-dim">por mês</div>
                    </div>
                  </div>
                  <Progress paid={p.paidInstallments} total={p.totalInstallments} />
                  <div className="text-xs text-ink-faint mt-1">
                    Falta pagar <Amount>{brl(p.remainingAmount)}</Amount> de{" "}
                    <Amount>{brl(p.totalAmount)}</Amount>
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
