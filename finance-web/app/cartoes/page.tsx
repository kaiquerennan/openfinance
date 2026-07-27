"use client";

// Cartões: contas de crédito com fatura atual e últimas compras.

import { useEffect, useState } from "react";
import { api, brl0, DbAccount, DbTransaction } from "@/lib/api";
import { useDataVersion } from "@/lib/bus";
import BlueHeader from "@/components/Header";
import TxList from "@/components/TxList";
import { Amount, Card, EmptyState, ErrorCard, LoadingCard, Money } from "@/components/ui";

export default function CartoesPage() {
  const version = useDataVersion();
  const [accounts, setAccounts] = useState<DbAccount[] | null>(null);
  const [txs, setTxs] = useState<Record<string, DbTransaction[]>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const accs = (await api.accounts()).filter((a) => a.type === "CREDIT");
        setAccounts(accs);
        const pages = await Promise.all(
          accs.map((a) => api.transactions({ accountId: a.id, take: 8 })),
        );
        setTxs(Object.fromEntries(accs.map((a, i) => [a.id, pages[i].transactions])));
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [version]);

  const totalFatura = (accounts ?? []).reduce(
    (s, a) => s + Math.abs(Number(a.balance ?? 0)),
    0,
  );

  return (
    <div>
      <BlueHeader title="Cartões">
        <div className="mt-4">
          <div className="text-white/70 text-[15px]">Faturas atuais</div>
          <div className="text-5xl font-semibold mt-1"><Amount>{brl0(totalFatura)}</Amount></div>
          <div className="text-white/50 mt-2 text-[15px]">
            {(accounts ?? []).length}{" "}
            {(accounts ?? []).length === 1 ? "cartão" : "cartões"}
          </div>
        </div>
      </BlueHeader>

      <div className="px-4 mt-5 space-y-4">
        {error && <ErrorCard message={error} />}
        {!accounts ? (
          <LoadingCard />
        ) : accounts.length === 0 ? (
          <EmptyState text="Nenhum cartão de crédito conectado ainda." />
        ) : (
          <div className="rise space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-5 lg:items-start">
            {accounts.map((a) => (
              <Card key={a.id}>
                {/* Cartão visual */}
                <div className="rounded-3xl p-5 text-white bg-gradient-to-br from-[#22315e] to-[#0f1830]">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">
                      {a.marketingName ?? a.name ?? a.item.connectorName}
                    </span>
                    <span className="text-white/60 text-sm">💳</span>
                  </div>
                  <div className="text-white/60 text-sm mt-5 tracking-widest">
                    •••• {a.number?.slice(-4) ?? "0000"}
                  </div>
                  <div className="flex items-end justify-between mt-2">
                    <span className="text-white/60 text-xs">Fatura atual</span>
                    <Money
                      value={Math.abs(Number(a.balance ?? 0))}
                      className="text-2xl"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-sm font-semibold text-ink-dim mb-3">
                    Últimas compras
                  </div>
                  <TxList transactions={txs[a.id] ?? []} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
