"use client";

// Contas: quanto há em conta, o que isso significa (reserva em meses de custo
// de vida) e os bancos conectados. Cartões aparecem à parte, como fatura — na
// lista antiga a fatura vinha como "saldo atual" negativo no meio das contas.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  accountKindLabel,
  accountTitle,
  AnalyticsReport,
  api,
  brl0,
  currentMonth,
  DbAccount,
  timeAgo,
} from "@/lib/api";
import { bumpData, useDataVersion } from "@/lib/bus";
import PageHeader from "@/components/Header";
import ReserveCard from "@/components/ReserveCard";
import {
  Amount,
  Card,
  CardHeader,
  ErrorCard,
  ListRow,
  LoadingCard,
  Money,
  PageHero,
} from "@/components/ui";
import { IconSync } from "@/components/icons";
import ConnectBankButton from "@/components/ConnectBankButton";

export default function ContasPage() {
  const router = useRouter();
  const version = useDataVersion();
  const [accounts, setAccounts] = useState<DbAccount[] | null>(null);
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  useEffect(() => {
    api
      .accounts()
      .then((a) => {
        setAccounts(a);
        setError(null);
      })
      .catch((e) => setError(e.message));
    // A reserva é um extra: sem o relatório a tela segue só com os saldos.
    api.report(currentMonth()).then(setReport).catch(() => {});
  }, [version]);

  async function sync(run: () => Promise<unknown>) {
    setSyncing(true);
    setSyncMsg(null);
    try {
      await run();
      setSyncMsg("Sincronizando em segundo plano — os saldos atualizam sozinhos em até 1 minuto.");
      setTimeout(bumpData, 20_000);
    } catch (e) {
      setSyncMsg((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  const all = accounts ?? [];
  const banks = all
    .filter((a) => a.type !== "CREDIT")
    .sort((a, b) => Number(b.balance ?? 0) - Number(a.balance ?? 0));
  const cards = all.filter((a) => a.type === "CREDIT");
  const total = banks.reduce((s, a) => s + Number(a.balance ?? 0), 0);
  const faturas = cards.reduce((s, a) => s + Math.abs(Number(a.balance ?? 0)), 0);

  // A sincronização mais antiga entre as contas conectadas: é ela que diz o
  // quanto dá para confiar nos números da tela.
  const synced = all
    .filter((a) => a.subtype !== "MANUAL")
    .map((a) => a.item.lastSyncedAt)
    .sort()[0];

  return (
    <div>
      <PageHeader title="Contas" back>
        <PageHero
          label="Saldo em conta"
          value={<Amount>{brl0(total)}</Amount>}
          hint={
            <>
              {banks.length} {banks.length === 1 ? "conta" : "contas"}
              {synced ? ` · atualizado ${timeAgo(synced)}` : ""}
            </>
          }
        >
          <button
            onClick={() => sync(() => api.syncAll())}
            disabled={syncing}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-soft text-ink font-semibold px-4 py-2.5 text-sm disabled:opacity-60"
          >
            <span className={syncing ? "animate-spin" : ""}>
              <IconSync size={15} />
            </span>
            {syncing ? "Sincronizando…" : "Sincronizar agora"}
          </button>
          {syncMsg && <p className="text-xs text-ink-dim mt-2">{syncMsg}</p>}
        </PageHero>
      </PageHeader>

      <div className="px-4 mt-5 space-y-4">
        {error && <ErrorCard message={error} />}
        {!accounts ? (
          !error && <LoadingCard />
        ) : (
          <div className="rise space-y-4 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-5 lg:items-start">
            <div className="space-y-4 lg:col-span-2">
              <Card>
                <CardHeader title="Contas" />
                <div className="divide-y divide-edge">
                  {banks.map((a) => (
                    <ListRow
                      key={a.id}
                      icon={a.subtype === "MANUAL" ? "👛" : "🏦"}
                      title={accountTitle(a)}
                      subtitle={`${accountKindLabel(a)} · ${a._count.transactions} transações`}
                      right={
                        <Money
                          value={Number(a.balance ?? 0)}
                          cents={false}
                          className="text-[16px]"
                        />
                      }
                      onClick={() => router.push(`/transacoes?conta=${a.id}`)}
                    />
                  ))}
                  {banks.length === 0 && (
                    <p className="text-sm text-ink-faint text-center py-6">
                      Nenhuma conta conectada ainda.
                    </p>
                  )}
                </div>
              </Card>

              {cards.length > 0 && (
                <Card>
                  <CardHeader
                    title="Cartões"
                    onOpen={() => router.push("/cartoes")}
                    openLabel="Faturas"
                  />
                  <div className="divide-y divide-edge">
                    {cards.map((a) => (
                      <ListRow
                        key={a.id}
                        icon="💳"
                        title={accountTitle(a)}
                        subtitle="Fatura atual"
                        right={
                          <Money
                            value={Math.abs(Number(a.balance ?? 0))}
                            cents={false}
                            className="text-[16px]"
                          />
                        }
                        onClick={() => router.push("/cartoes")}
                      />
                    ))}
                  </div>
                  {cards.length > 1 && (
                    <div className="text-[13px] text-ink-dim pt-3 border-t border-edge">
                      Faturas somadas: <Amount>{brl0(faturas)}</Amount>
                    </div>
                  )}
                </Card>
              )}
            </div>

            <div className="space-y-4 lg:col-span-1">
              <ReserveCard reserve={report?.data.reserve} />
              <ConnectBankButton onConnected={(itemId) => sync(() => api.syncItem(itemId))} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
