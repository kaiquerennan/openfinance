// Mapa de navegação do app: uma única lista, usada pela barra inferior, pelo
// menu "Mais", pela barra lateral do desktop e pelos atalhos da home. Assim um
// destino tem o mesmo nome e o mesmo ícone em todo lugar.

import {
  IconArrows,
  IconBars,
  IconCalendarDots,
  IconCard,
  IconFlow,
  IconHome,
  IconPie,
  IconRepeat,
  IconTrend,
  IconTrophy,
  IconWallet,
} from "@/components/icons";

export interface NavItem {
  href: string;
  label: string;
  /** O que a pessoa encontra lá — aparece no menu "Mais". */
  hint: string;
  icon: (size: number) => React.ReactNode;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

/** Destinos fixos da barra inferior, na ordem em que aparecem. */
export const PRIMARY_NAV: NavItem[] = [
  {
    href: "/",
    label: "Início",
    hint: "Quanto ainda dá pra gastar e o que pede atenção",
    icon: (s) => <IconHome size={s} />,
  },
  {
    href: "/categorias",
    label: "Categorias",
    hint: "Gasto do mês por categoria e limites",
    icon: (s) => <IconPie size={s} />,
  },
  {
    href: "/transacoes",
    label: "Transações",
    hint: "Extrato com busca e filtros",
    icon: (s) => <IconArrows size={s} />,
  },
];

/** Tudo que não cabe na barra, agrupado pelo que a pessoa quer resolver. */
export const SECONDARY_GROUPS: NavGroup[] = [
  {
    title: "A pagar",
    items: [
      {
        href: "/cartoes",
        label: "Cartões",
        hint: "Faturas, vencimento e limite",
        icon: (s) => <IconCard size={s} />,
      },
      {
        href: "/recorrentes",
        label: "Contas fixas",
        hint: "Assinaturas e cobranças mensais",
        icon: (s) => <IconRepeat size={s} />,
      },
      {
        href: "/parcelas",
        label: "Parcelas",
        hint: "Compras parceladas ainda a pagar",
        icon: (s) => <IconCalendarDots size={s} />,
      },
    ],
  },
  {
    title: "Planejar",
    items: [
      {
        href: "/metas",
        label: "Metas",
        hint: "Objetivos e aportes",
        icon: (s) => <IconTrophy size={s} />,
      },
      {
        href: "/projecao",
        label: "Projeção",
        hint: "Saldo previsto para os próximos meses",
        icon: (s) => <IconTrend size={s} />,
      },
      {
        href: "/analises",
        label: "Análises",
        hint: "Fluxo de caixa, gastos e receitas",
        icon: (s) => <IconFlow size={s} />,
      },
    ],
  },
  {
    title: "Patrimônio",
    items: [
      {
        href: "/contas",
        label: "Contas",
        hint: "Saldos, reserva e bancos",
        icon: (s) => <IconWallet size={s} />,
      },
      {
        href: "/investimentos",
        label: "Investimentos",
        hint: "Posições e aportes",
        icon: (s) => <IconBars size={s} />,
      },
    ],
  },
];

export const SECONDARY_NAV: NavItem[] = SECONDARY_GROUPS.flatMap((g) => g.items);

/** Grupos completos (barra lateral do desktop). */
export const ALL_GROUPS: NavGroup[] = [
  { title: "Dia a dia", items: PRIMARY_NAV },
  ...SECONDARY_GROUPS,
];

export function navItem(href: string) {
  return [...PRIMARY_NAV, ...SECONDARY_NAV].find((i) => i.href === href);
}

export function isActive(href: string, pathname: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
