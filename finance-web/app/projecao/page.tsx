"use client";

// Projeção: saldo projetado pros próximos meses, assumindo que a média de
// poupança dos últimos 3 meses (já calculada no backend, mesmo número da
// dica "mantendo o ritmo atual...") se mantém constante.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AnalyticsReport,
  api,
  brl,
  brl0,
  currentMonth,
  DbAccount,
  InstallmentsOverview,
  addMonths,
  monthLabel,
} from "@/lib/api";
import { useDataVersion } from "@/lib/bus";
import PageHeader from "@/components/Header";
import { ProjectionChart } from "@/components/Charts";
import MonthOutlookCard from "@/components/MonthOutlookCard";
import CompoundSimulator from "@/components/CompoundSimulator";
import {
  Amount,
  Card,
  CardHeader,
  ErrorCard,
  LoadingCard,
  PageHero,
  TipCarousel,
} from "@/components/ui";

const MONTHS_AHEAD = 6;

export default function ProjecaoPage() {
  const version = useDataVersion();
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [accounts, setAccounts] = useState<DbAccount[] | null>(null);
  const [parcelas, setParcelas] = useState<InstallmentsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const month = currentMonth();

  useEffect(() => {
    Promise.all([api.report(month), api.accounts()])
      .then(([r, accs]) => {
        setReport(r);
        setAccounts(accs);
      })
      .catch((e) => setError(e.message));
    // Parcela já contratada é a única parte do futuro que não é estimativa;
    // se falhar, a projeção continua — só perde essa camada.
    api.installments(MONTHS_AHEAD).then(setParcelas).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const saldoInicial = useMemo(
    () =>
      (accounts ?? [])
        .filter((a) => a.type === "BANK")
        .reduce((s, a) => s + Number(a.balance ?? 0), 0),
    [accounts],
  );

  const monthlyRate = useMemo(() => {
    const t3 = report?.data.trends.find((t) => t.window === "3m");
    return t3 ? t3.savings / 3 : 0;
  }, [report]);

  const currentResult = report ? report.data.summary.income - report.data.summary.consumption : 0;

  const points = useMemo(() => {
    const list: { label: string; resultado: number; saldo: number }[] = [];
    let saldo = saldoInicial;
    for (let i = 0; i < MONTHS_AHEAD; i++) {
      const resultado = i === 0 ? currentResult : monthlyRate;
      saldo += resultado;
      list.push({
        label: monthLabel(addMonths(month, i)).slice(0, 3),
        resultado,
        saldo,
      });
    }
    return list;
  }, [saldoInicial, currentResult, monthlyRate, month]);

  const saldoFinal = points[points.length - 1]?.saldo ?? saldoInicial;
  const delta = saldoFinal - saldoInicial;

  const loading = !report || !accounts;

  return (
    <div>
      <PageHeader title="Projeção" back>
        <PageHero
          label={`Saldo previsto em ${monthLabel(addMonths(month, MONTHS_AHEAD - 1)).toLowerCase()}`}
          value={<Amount>{brl0(saldoFinal)}</Amount>}
          hint={
            loading ? undefined : (
              <span className={delta >= 0 ? "text-pos" : "text-neg"}>
                {delta >= 0 ? "▲" : "▼"} <Amount>{brl0(Math.abs(delta))}</Amount>{" "}
                <span className="text-ink-dim">em relação a hoje, mantendo o ritmo recente</span>
              </span>
            )
          }
        />
      </PageHeader>

      <div className="px-4 mt-5 space-y-4">
        {error && <ErrorCard message={error} />}
        {loading ? (
          !error && <LoadingCard text="Calculando projeção…" />
        ) : (
          <div className="rise space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-5 lg:items-start">
            <div className="space-y-4">
              <MonthOutlookCard outlook={report?.data.outlook} />

              <Card>
                <CardHeader title="Próximos 6 meses" />
                <ProjectionChart points={points} />

                {/* A mesma projeção em números: uma linha por mês, sem repetir rótulos. */}
                <div className="mt-4 pt-1 border-t border-edge">
                  <div className="flex text-xs text-ink-faint py-2">
                    <span className="flex-1">Mês</span>
                    <span className="w-28 text-right">Resultado</span>
                    <span className="w-28 text-right">Saldo</span>
                  </div>
                  <div className="divide-y divide-edge">
                    {points.map((p, i) => {
                      const mes = addMonths(month, i);
                      const parcela = parcelas?.monthly.find((m) => m.month === mes);
                      return (
                        <div key={mes} className="py-2.5">
                          <div className="flex items-center text-[14px]">
                            <span className="flex-1 font-semibold text-ink">
                              {monthLabel(mes).split(" ")[0]}
                              {i === 0 && (
                                <span className="block text-xs text-ink-faint font-normal">
                                  em curso
                                </span>
                              )}
                            </span>
                            <span
                              className={`w-28 text-right ${
                                p.resultado < 0 ? "text-neg" : "text-pos"
                              }`}
                            >
                              <Amount>{`${p.resultado < 0 ? "-" : "+"}${brl0(Math.abs(p.resultado))}`}</Amount>
                            </span>
                            <span className="w-28 text-right font-bold text-ink">
                              <Amount>{brl0(p.saldo)}</Amount>
                            </span>
                          </div>
                          {parcela && parcela.amount > 0 && (
                            <div className="text-xs text-ink-faint mt-0.5">
                              <Amount>{brl(parcela.amount)}</Amount> já comprometidos em parcelas
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>

              {parcelas && parcelas.committedTotal > 0 && (
                <Card>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[15px] font-semibold text-ink">
                        Já comprometido em parcelas
                      </div>
                      <p className="text-xs text-ink-dim mt-1 max-w-xs">
                        Compras que já foram feitas e vão ser cobradas nos próximos meses
                        {parcelas.freeFrom ? `, até ${monthLabel(parcelas.freeFrom)}` : ""}.
                      </p>
                    </div>
                    <Link
                      href="/parcelas"
                      className="text-right shrink-0 text-xl font-bold text-ink"
                    >
                      <Amount>{brl0(parcelas.committedTotal)}</Amount>
                      <div className="text-xs font-semibold text-accent">ver detalhe</div>
                    </Link>
                  </div>
                </Card>
              )}
            </div>

            <div className="space-y-4">
              <TipCarousel
                tips={[
                  ...(report?.narrative.previsoes ?? []),
                  ...(report?.narrative.oportunidades ?? []),
                ]}
              />

              <CompoundSimulator habits={report?.data.habits} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
