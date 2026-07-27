"use client";

// Nav inferior flutuante: pill escura com 4 destinos fixos (Visão geral,
// Categorias, Transações, Fluxo de Caixa) + um botão separado pra
// esconder/mostrar valores, igual ao app de referência.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { toggleHideValues, useHideValues } from "@/lib/privacy";
import {
  IconArrows,
  IconEye,
  IconEyeOff,
  IconFlow,
  IconHome,
  IconPie,
} from "@/components/icons";

const ITEMS = [
  { href: "/", label: "Visão geral", icon: <IconHome size={21} /> },
  { href: "/categorias", label: "Categorias", icon: <IconPie size={20} /> },
  { href: "/transacoes", label: "Transações", icon: <IconArrows size={20} /> },
  { href: "/analises", label: "Fluxo de Caixa", icon: <IconFlow size={20} /> },
];

function NavItem({
  href,
  active,
  children,
  label,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={`h-11 w-11 rounded-full grid place-items-center transition ${
        active ? "bg-accent text-white" : "text-ink-faint"
      }`}
    >
      {children}
    </Link>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const hideValues = useHideValues();

  if (pathname === "/login") return null;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 pointer-events-none lg:hidden">
      <div className="mx-auto w-full max-w-md px-4 pb-4 pt-2 flex items-center gap-3">
        <div className="pointer-events-auto flex-1 flex items-center justify-between bg-card/95 backdrop-blur-xl border border-edge rounded-full px-2.5 py-2 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6)]">
          {ITEMS.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              active={
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
              }
              label={item.label}
            >
              {item.icon}
            </NavItem>
          ))}
        </div>
        <button
          aria-label={hideValues ? "Mostrar valores" : "Esconder valores"}
          onClick={toggleHideValues}
          className="pointer-events-auto h-12 w-12 rounded-full bg-card/95 backdrop-blur-xl border border-edge grid place-items-center text-ink-faint shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6)]"
        >
          {hideValues ? <IconEyeOff size={19} /> : <IconEye size={19} />}
        </button>
      </div>
    </nav>
  );
}
