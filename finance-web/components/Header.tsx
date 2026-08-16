"use client";

// Header escuro e plano: título à esquerda e ícones de ação (esconder
// valores / novo lançamento) à direita. `children` é o conteúdo da página
// logo abaixo (números grandes, gráficos etc — sem cartão/fundo próprio).

import { useState } from "react";
import { toggleHideValues, useHideValues } from "@/lib/privacy";
import AddTxSheet from "@/components/AddTxSheet";
import {
  IconArrows,
  IconBars,
  IconCalendarDots,
  IconCard,
  IconChat,
  IconEye,
  IconEyeOff,
  IconFlow,
  IconHome,
  IconPie,
  IconPlus,
  IconTrophy,
  IconWallet,
} from "@/components/icons";

export const MENU = [
  { href: "/", label: "Visão geral", icon: <IconHome size={20} /> },
  { href: "/categorias", label: "Categorias", icon: <IconPie size={20} /> },
  { href: "/transacoes", label: "Transações", icon: <IconArrows size={20} /> },
  {
    href: "/transacoes?tab=recorrentes",
    label: "Recorrências",
    icon: <IconCalendarDots size={20} />,
  },
  { href: "/analises", label: "Fluxo de Caixa", icon: <IconFlow size={20} /> },
  { href: "/projecao", label: "Projeção", icon: <IconBars size={20} /> },
  { href: "/contas", label: "Contas", icon: <IconWallet size={20} /> },
  { href: "/investimentos", label: "Investimentos", icon: <IconBars size={20} /> },
  { href: "/cartoes", label: "Cartões", icon: <IconCard size={20} /> },
  { href: "/parcelas", label: "Parcelas", icon: <IconCalendarDots size={20} /> },
  { href: "/metas", label: "Metas", icon: <IconTrophy size={20} /> },
  {
    href: "mailto:kaiquerennan@gmail.com?subject=Suporte",
    label: "Suporte",
    icon: <IconChat size={20} />,
  },
];

export default function BlueHeader({
  title,
  children,
  onAdd,
}: {
  title?: string;
  children?: React.ReactNode;
  /** Ação do "+" (padrão: novo lançamento manual). */
  onAdd?: () => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const hideValues = useHideValues();

  return (
    <header className="px-5 pt-5 pb-2 text-ink">
      <div className="flex items-center justify-between">
        {title && <h1 className="text-2xl font-semibold">{title}</h1>}
        <div className="flex items-center gap-2">
          <button
            aria-label={hideValues ? "Mostrar valores" : "Esconder valores"}
            onClick={toggleHideValues}
            className="h-10 w-10 rounded-full grid place-items-center bg-soft text-ink-dim"
          >
            {hideValues ? <IconEyeOff size={17} /> : <IconEye size={17} />}
          </button>
          <button
            aria-label="Adicionar"
            onClick={() => (onAdd ? onAdd() : setAddOpen(true))}
            className="h-10 w-10 rounded-full grid place-items-center bg-soft text-ink-dim"
          >
            <IconPlus size={17} />
          </button>
        </div>
      </div>
      {children}

      <AddTxSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </header>
  );
}
