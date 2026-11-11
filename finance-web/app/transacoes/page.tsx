"use client";

// Transações: o extrato, direto. Busca em todo o histórico e filtros de um
// toque (tipo, categoria, conta) — sem abas nem sheet de filtros com dropdown.
//
// A antiga aba "Visão geral" era a tela de Categorias repetida, e "Recorrentes"
// virou a tela Contas fixas; os links antigos (?tab=) redirecionam para lá.

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  accountTitle,
  api,
  brl0,
  DbAccount,
  DbTransaction,
  signedAmount,
} from "@/lib/api";
import { catMeta } from "@/lib/categories";
import { useDataVersion } from "@/lib/bus";
import CategoryPicker from "@/components/CategoryPicker";
import PageHeader from "@/components/Header";
import Sheet from "@/components/Sheet";
import TxList from "@/components/TxList";
import {
  Amount,
  ErrorCard,
  FilterChip,
  ListRow,
  LoadingCard,
} from "@/components/ui";
import { IconSearch, IconX } from "@/components/icons";

const PAGE = 100;
type Flow = "all" | "out" | "in";

interface Loaded {
  key: string;
  txs: DbTransaction[];
  total: number;
  hasMore: boolean;
}

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

function TxBrowser({
  initial,
}: {
  initial: { q: string; category: string | null; accountId: string | null };
}) {
  const version = useDataVersion();
  const [search, setSearch] = useState(initial.q);
  const [flow, setFlow] = useState<Flow>("all");
  const [category, setCategory] = useState<string | null>(initial.category);
  const [accountId, setAccountId] = useState<string | null>(initial.accountId);
  const [picking, setPicking] = useState<"category" | "account" | null>(null);

  const [accounts, setAccounts] = useState<DbAccount[]>([]);
  const [data, setData] = useState<Loaded | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const term = useDebounced(search.trim(), 300);
  const key = `${term}|${category ?? ""}|${accountId ?? ""}|${version}`;

  useEffect(() => {
    api.accounts().then(setAccounts).catch(() => {});
  }, [version]);

  useEffect(() => {
    let stale = false;
    api
      .transactions({
        search: term || undefined,
        category: category ?? undefined,
        accountId: accountId ?? undefined,
        take: PAGE,
      })
      .then((p) => {
        if (stale) return;
        setData({ key, txs: p.transactions, total: p.total, hasMore: p.hasMore });
        setError(null);
      })
      .catch((e) => !stale && setError((e as Error).message));
    return () => {
      stale = true;
    };
    // `key` já resume busca, filtros e versão dos dados.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = data?.key === key ? data : null;

  async function loadMore() {
    if (!current || loadingMore) return;
    setLoadingMore(true);
    try {
      const p = await api.transactions({
        search: term || undefined,
        category: category ?? undefined,
        accountId: accountId ?? undefined,
        take: PAGE,
        skip: current.txs.length,
      });
      setData((prev) =>
        prev && prev.key === key
          ? { ...prev, txs: [...prev.txs, ...p.transactions], hasMore: p.hasMore }
          : prev,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }

  const shown = useMemo(() => {
    const list = current?.txs ?? [];
    if (flow === "all") return list;
    return list.filter((t) => (flow === "in" ? signedAmount(t) > 0 : signedAmount(t) < 0));
  }, [current, flow]);

  const totals = useMemo(() => {
    let out = 0;
    let inn = 0;
    for (const t of shown) {
      const v = signedAmount(t);
      if (v < 0) out += -v;
      else inn += v;
    }
    return { out, inn };
  }, [shown]);

  const account = accounts.find((a) => a.id === accountId);
  const filtering = Boolean(term || category || accountId || flow !== "all");

  function clearAll() {
    setSearch("");
    setFlow("all");
    setCategory(null);
    setAccountId(null);
  }

  return (
    <div>
      <PageHeader title="Transações" addTx />

      <div className="px-4 mt-3 space-y-3">
        <div className="flex items-center gap-2.5 bg-soft rounded-2xl px-4">
          <span className="text-ink-faint">
            <IconSearch size={17} />
          </span>
          <input
            className="w-full bg-transparent py-3.5 text-[15px] font-medium outline-none placeholder:text-ink-faint"
            placeholder="Buscar em todo o histórico"
            aria-label="Buscar transações"
            enterKeyHint="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              aria-label="Limpar busca"
              onClick={() => setSearch("")}
              className="h-8 w-8 -mr-2 grid place-items-center text-ink-dim shrink-0"
            >
              <IconX size={15} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto -mx-4 px-4 pb-1">
          <FilterChip active={flow === "all"} onClick={() => setFlow("all")}>
            Tudo
          </FilterChip>
          <FilterChip active={flow === "out"} onClick={() => setFlow(flow === "out" ? "all" : "out")}>
            Saídas
          </FilterChip>
          <FilterChip active={flow === "in"} onClick={() => setFlow(flow === "in" ? "all" : "in")}>
            Entradas
          </FilterChip>
          <span className="h-5 w-px bg-edge shrink-0" />
          <FilterChip
            active={category !== null}
            onClick={() => setPicking("category")}
            onClear={() => setCategory(null)}
          >
            {category ? (
              <>
                <span>{catMeta(category).icon}</span>
                {catMeta(category).label}
              </>
            ) : (
              "Categoria"
            )}
          </FilterChip>
          <FilterChip
            active={accountId !== null}
            onClick={() => setPicking("account")}
            onClear={() => setAccountId(null)}
          >
            {account ? accountTitle(account) : "Conta"}
          </FilterChip>
        </div>

        {error && <ErrorCard message={error} />}

        {!current ? (
          !error && <LoadingCard text="Carregando transações…" />
        ) : (
          <div className="rise">
            <div className="flex items-center justify-between gap-3 px-1 pb-3 text-[13px] text-ink-dim">
              <span>
                {flow === "all"
                  ? current.total > shown.length
                    ? `${shown.length} de ${current.total} lançamentos`
                    : `${shown.length} ${shown.length === 1 ? "lançamento" : "lançamentos"}`
                  : `${shown.length} ${flow === "out" ? "saídas" : "entradas"}${
                      // Saídas/entradas são filtradas no que já foi carregado.
                      current.hasMore ? ` nos ${current.txs.length} mais recentes` : ""
                    }`}
                {filtering && !current.hasMore && shown.length > 0 && (
                  <>
                    {totals.out > 0 && (
                      <>
                        {" · saiu "}
                        <Amount>{brl0(totals.out)}</Amount>
                      </>
                    )}
                    {totals.inn > 0 && (
                      <>
                        {" · entrou "}
                        <Amount>{brl0(totals.inn)}</Amount>
                      </>
                    )}
                  </>
                )}
              </span>
              {filtering && (
                <button onClick={clearAll} className="font-semibold text-accent shrink-0">
                  Limpar filtros
                </button>
              )}
            </div>

            <div className="card p-5 lg:max-w-3xl">
              <TxList
                transactions={shown}
                showAccount={accountId === null}
                emptyText={
                  filtering
                    ? "Nada encontrado com esses filtros."
                    : "Nenhuma transação ainda. Conecte um banco em Contas."
                }
              />
              {current.hasMore && (
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="w-full mt-4 rounded-full bg-soft text-ink font-semibold py-3 text-sm disabled:opacity-60"
                >
                  {loadingMore ? "Carregando…" : "Carregar mais antigas"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <Sheet
        open={picking === "category"}
        onClose={() => setPicking(null)}
        title="Filtrar por categoria"
      >
        <CategoryPicker
          value={category}
          onPick={(k) => {
            setCategory(k);
            setPicking(null);
          }}
        />
      </Sheet>

      <Sheet
        open={picking === "account"}
        onClose={() => setPicking(null)}
        title="Filtrar por conta"
      >
        <div className="divide-y divide-edge">
          {accounts.map((a) => (
            <ListRow
              key={a.id}
              icon={a.subtype === "MANUAL" ? "👛" : a.type === "CREDIT" ? "💳" : "🏦"}
              title={accountTitle(a)}
              subtitle={`${a._count.transactions} transações`}
              right={a.id === accountId ? <span className="text-accent text-sm font-semibold">Ativo</span> : undefined}
              onClick={() => {
                setAccountId(a.id);
                setPicking(null);
              }}
            />
          ))}
        </div>
      </Sheet>
    </div>
  );
}

function TransacoesInner() {
  const params = useSearchParams();
  const initial = {
    q: params.get("q") ?? "",
    category: params.get("categoria")?.toLowerCase() || null,
    accountId: params.get("conta") || null,
  };
  // A chave remonta a tela quando se chega por outro link (ex.: "ver outras
  // de X" a partir de uma transação), para os filtros refletirem a URL.
  return <TxBrowser key={params.toString()} initial={initial} />;
}

export default function TransacoesPage() {
  return (
    <Suspense fallback={<div className="p-6"><LoadingCard /></div>}>
      <TransacoesInner />
    </Suspense>
  );
}
