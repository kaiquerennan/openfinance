"use client";

// Contas fixas: o que se repete todo mês (assinaturas, cobranças recorrentes)
// e quanto disso ainda vai cair neste mês. As parcelas entram só como total,
// com link para a tela delas — antes havia aqui uma segunda detecção de
// parcelamento, por regex, que podia discordar da tela Parcelas.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AnalyticsReport,
  api,
  brl0,
  capFirst,
  currentMonth,
  InstallmentsOverview,
  MONTH_LABELS,
  todayParts,
} from "@/lib/api";
import { useDataVersion } from "@/lib/bus";
import PageHeader from "@/components/Header";
import { SegBars } from "@/components/Charts";
import {
  Amount,
  Card,
  CardHeader,
  EmptyState,
  ErrorCard,
  ListRow,
  LoadingCard,
  Money,
  PageHero,
} from "@/components/ui";

export default function ContasFixasPage() {
  const router = useRouter();
  const version = useDataVersion();
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [parcelas, setParcelas] = useState<InstallmentsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const month = currentMonth();
  const today = todayParts();

  useEffect(() => {
    api
      .report(month)
      .then((r) => {
        setReport(r);
        setError(null);
      })
      .catch((e) => setError((e as Error).message));
    // Sem as parcelas a tela continua útil — só perde o total delas.
    api.installments(6).then(setParcelas).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const subs = report?.data.subscriptions;
  const items = useMemo(
    () => [...(subs?.items ?? [])].sort((a, b) => b.monthlyAmount - a.monthlyAmount),
    [subs],
  );
  const recurring = subs?.monthlyTotal ?? 0;
  const parcelasNow = parcelas?.monthly[0]?.amount ?? 0;

  const dueDay = (lastDate: string) => Number(lastDate.split("-")[2]);
  const pending = items
    .filter((s) => dueDay(s.lastDate) >= today.day)
    .sort((a, b) => dueDay(a.lastDate) - dueDay(b.lastDate));
  const pendingTotal = pending.reduce((s, i) => s + i.monthlyAmount, 0);

  const chart = (parcelas?.monthly ?? []).map((m) => ({
    name: MONTH_LABELS[Number(m.month.split("-")[1]) - 1].slice(0, 3),
    recorrentes: recurring,
    parcelas: m.amount,
  }));
  const hasParcelas = (parcelas?.monthly ?? []).some((m) => m.amount > 0);

  return (
    <div>
      <PageHeader title="Contas fixas" back>
        <PageHero
          label="Comprometido por mês"
          value={<Amount>{brl0(recurring + parcelasNow)}</Amount>}
          hint={
            subs ? (
              pending.length > 0 ? (
                <>
                  Ainda vão cair <Amount>{brl0(pendingTotal)}</Amount> neste mês
                </>
              ) : (
                "Tudo o que se repete já caiu neste mês"
              )
            ) : undefined
          }
        />
      </PageHeader>

      <div className="px-4 mt-5 space-y-4">
        {error && <ErrorCard message={error} />}
        {!report ? (
          !error && <LoadingCard text="Detectando contas fixas…" />
        ) : items.length === 0 && !hasParcelas ? (
          <EmptyState
            icon="🔁"
            text="Nenhuma cobrança recorrente detectada ainda. Elas aparecem aqui depois de se repetirem por alguns meses."
          />
        ) : (
          <div className="rise space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-5 lg:items-start">
            <div className="space-y-4">
              {pending.length > 0 && (
                <Card>
                  <CardHeader title="Ainda este mês" />
                  <div className="divide-y divide-edge">
                    {pending.map((s) => {
                      const days = dueDay(s.lastDate) - today.day;
                      return (
                        <ListRow
                          key={s.description}
                          icon="🗓️"
                          title={capFirst(s.description)}
                          subtitle={
                            <span className={days <= 3 ? "text-neg font-semibold" : ""}>
                              {days === 0
                                ? "deve cair hoje"
                                : days === 1
                                  ? "deve cair amanhã"
                                  : `dia ${dueDay(s.lastDate)} · em ${days} dias`}
                            </span>
                          }
                          right={<Money value={s.monthlyAmount} className="text-[15px]" />}
                        />
                      );
                    })}
                  </div>
                </Card>
              )}

              {(hasParcelas || parcelasNow > 0) && (
                <Card onClick={() => router.push("/parcelas")}>
                  <CardHeader
                    title="Parcelas de cartão"
                    onOpen={() => router.push("/parcelas")}
                    openLabel="Detalhar"
                  />
                  <Money value={parcelasNow} className="text-2xl text-ink" />
                  <div className="text-sm text-ink-dim mt-1">
                    neste mês
                    {parcelas?.freeFrom
                      ? ` · livre a partir de ${MONTH_LABELS[Number(parcelas.freeFrom.split("-")[1]) - 1].toLowerCase()}`
                      : ""}
                  </div>
                  <div className="mt-3">
                    <SegBars
                      data={chart}
                      series={[
                        { key: "recorrentes", label: "Recorrentes", color: "#4e77f6" },
                        { key: "parcelas", label: "Parcelas", color: "#f0a818" },
                      ]}
                      height={190}
                    />
                  </div>
                </Card>
              )}
            </div>

            {items.length > 0 && (
              <Card>
                <CardHeader
                  title="Todo mês"
                  right={
                    <span className="text-sm text-ink-dim ml-auto">
                      <Amount>{brl0(subs?.annualTotal ?? 0)}</Amount> por ano
                    </span>
                  }
                />
                <div className="divide-y divide-edge">
                  {items.map((s) => (
                    <ListRow
                      key={s.description}
                      icon="🔁"
                      title={
                        <span className="flex items-center gap-2">
                          <span className="truncate">{capFirst(s.description)}</span>
                          {s.increasePct != null && (
                            <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-neg/15 text-neg">
                              +{Math.round(s.increasePct)}%
                            </span>
                          )}
                        </span>
                      }
                      subtitle={
                        s.increasePct != null ? (
                          <>
                            a última veio <Amount>{brl0(s.currentAmount)}</Amount>
                          </>
                        ) : (
                          `todo dia ${dueDay(s.lastDate)} · há ${s.monthsSeen} ${
                            s.monthsSeen === 1 ? "mês" : "meses"
                          }`
                        )
                      }
                      right={<Money value={s.monthlyAmount} className="text-[15px]" />}
                      onClick={() =>
                        router.push(`/transacoes?q=${encodeURIComponent(s.description)}`)
                      }
                    />
                  ))}
                </div>
                <p className="text-xs text-ink-faint mt-3">
                  Toque numa cobrança para ver todas as vezes em que ela apareceu.
                </p>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
