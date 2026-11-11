"use client";

// Cabeçalho de página: título à esquerda (com "voltar" nas telas que não
// estão na barra inferior) e ações à direita. `children` é o conteúdo logo
// abaixo — normalmente o número principal da tela (PageHero).
//
// O "+" de novo lançamento só aparece onde faz sentido (início e transações):
// nas outras telas ele era um botão a mais sem relação com o que está na tela.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleHideValues, useHideValues } from "@/lib/privacy";
import AddTxSheet from "@/components/AddTxSheet";
import { IconChevronLeft, IconEye, IconEyeOff, IconPlus } from "@/components/icons";

const iconBtn =
  "h-10 w-10 rounded-full grid place-items-center bg-soft text-ink-dim shrink-0 active:scale-95 transition";

/** Botão de ação do cabeçalho com rótulo ("Nova meta"), para não depender de adivinhar um ícone. */
export function HeaderAction({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="h-10 rounded-full bg-accent text-white font-semibold text-sm pl-3 pr-4 inline-flex items-center gap-1.5 shrink-0 active:scale-95 transition"
    >
      <IconPlus size={15} />
      {label}
    </button>
  );
}

export default function PageHeader({
  title,
  back = false,
  addTx = false,
  actions,
  children,
}: {
  title: string;
  /** Mostra "voltar" no celular (no desktop a barra lateral já está sempre visível). */
  back?: boolean;
  /** Mostra o "+" de novo lançamento manual. */
  addTx?: boolean;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const hideValues = useHideValues();

  return (
    <header className="px-5 pt-5 pb-2 text-ink">
      <div className="flex items-center gap-2.5">
        {back && (
          <button
            aria-label="Voltar"
            onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
            className={`${iconBtn} lg:hidden -ml-1`}
          >
            <IconChevronLeft size={17} />
          </button>
        )}
        <h1 className="text-2xl font-semibold flex-1 min-w-0 truncate">{title}</h1>
        {actions}
        {addTx && (
          <button
            aria-label="Novo lançamento"
            title="Novo lançamento"
            onClick={() => setAddOpen(true)}
            className={iconBtn}
          >
            <IconPlus size={17} />
          </button>
        )}
        <button
          aria-label={hideValues ? "Mostrar valores" : "Esconder valores"}
          title={hideValues ? "Mostrar valores" : "Esconder valores"}
          onClick={toggleHideValues}
          className={`${iconBtn} lg:hidden`}
        >
          {hideValues ? <IconEyeOff size={17} /> : <IconEye size={17} />}
        </button>
      </div>
      {children}

      {addTx && <AddTxSheet open={addOpen} onClose={() => setAddOpen(false)} />}
    </header>
  );
}
