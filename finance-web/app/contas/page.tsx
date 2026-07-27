"use client";

// Contas: saldo total, contas conectadas com sincronização e conexão de
// novos bancos.

import { useCallback, useEffect, useState } from "react";
import {
  accountKindLabel,
  accountTitle,
  api,
  brl,
  brl0,
  DbAccount,
  sortAccounts,
} from "@/lib/api";
import { bumpData, useDataVersion } from "@/lib/bus";
import BlueHeader from "@/components/Header";
import { Amount, Card, ErrorCard, LoadingCard, Money } from "@/components/ui";
import { IconSync } from "@/components/icons";
import ConnectBankButton from "@/components/ConnectBankButton";

export default function ContasPage() {
  const version = useDataVersion();
  const [accounts, setAccounts] = useState<DbAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);

  const load = useCallback(() => {
    api.accounts().then(setAccounts).catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load, version]);

  async function sync(itemId: string) {
    setSyncing(itemId);
    try {
      await api.syncItem(itemId);
      setTimeout(bumpData, 20_000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSyncing(null);
    }
  }

  const total = (accounts ?? [])
    .filter((a) => a.type === "BANK")
    .reduce((s, a) => s + Number(a.balance ?? 0), 0);

  return (
    <div>
      <BlueHeader title="Contas">
        <div className="mt-4">
          <div className="text-white/70 text-[15px]">Saldo total</div>
          <div className="text-5xl font-semibold mt-1"><Amount>{brl0(total)}</Amount></div>
          <div className="text-white/50 mt-2 text-[15px]">
            {(accounts ?? []).length} conta{(accounts ?? []).length !== 1 ? "s" : ""}
          </div>
        </div>
      </BlueHeader>

      <div className="px-4 mt-5 space-y-4">
        {error && <ErrorCard message={error} />}
        {!accounts ? (
          <LoadingCard />
        ) : (
          <div className="rise space-y-4 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-5 lg:items-start">
            <Card className="lg:col-span-2">
              <div className="divide-y divide-edge">
                {sortAccounts(accounts).map((a) => (
                  <div key={a.id} className="flex items-center gap-3.5 py-4">
                    <span className="h-11 w-11 rounded-2xl bg-soft grid place-items-center text-lg shrink-0">
                      {a.subtype === "MANUAL" ? "👛" : a.type === "CREDIT" ? "💳" : "🏦"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[16px] font-semibold text-ink truncate">
                        {accountTitle(a)}
                      </div>
                      <div className="text-sm text-ink-dim">
                        {accountKindLabel(a)} · {a._count.transactions} transações
                      </div>
                      <div className="text-xs text-ink-faint mt-0.5">
                        Sincronizada em{" "}
                        {new Date(a.item.lastSyncedAt).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <Money value={Number(a.balance ?? 0)} cents={false} className="text-[17px]" />
                      <div className="text-sm text-ink-dim">Saldo atual</div>
                      {a.subtype !== "MANUAL" && (
                        <button
                          onClick={() => sync(a.itemId)}
                          disabled={syncing !== null}
                          className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-accent disabled:opacity-50"
                        >
                          <span className={syncing === a.itemId ? "animate-spin" : ""}>
                            <IconSync size={13} />
                          </span>
                          {syncing === a.itemId ? "Sincronizando…" : "Sincronizar"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2.5 pt-4 border-t border-edge">
                <span className="w-1 rounded-full bg-pos" />
                <div>
                  <div className="text-sm text-ink-dim">Total</div>
                  <div className="text-xl font-bold text-ink"><Amount>{brl(total)}</Amount></div>
                </div>
              </div>
            </Card>

            <div className="lg:col-span-1">
              <ConnectBankButton onConnected={sync} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
