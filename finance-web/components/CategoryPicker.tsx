"use client";

// Lista pesquisável de categorias, usada onde é preciso escolher uma: filtro
// de transações e lançamento manual. (A correção de categoria de uma
// transação tem regras próprias e vive em CategorySheet.)

import { useState } from "react";
import { CATEGORY_OPTIONS } from "@/lib/categories";
import { inputCls } from "@/components/ui";
import { IconCheck, IconSearch } from "@/components/icons";

export default function CategoryPicker({
  value,
  onPick,
  options = CATEGORY_OPTIONS,
}: {
  value: string | null;
  onPick: (key: string) => void;
  /** Restringe às categorias que fazem sentido no contexto. */
  options?: { key: string; label: string; icon: string }[];
}) {
  const [query, setQuery] = useState("");
  const term = query.trim().toLowerCase();
  const list = term ? options.filter((o) => o.label.toLowerCase().includes(term)) : options;

  return (
    <div className="space-y-3">
      {options.length > 8 && (
        <label className="flex items-center gap-2 bg-soft rounded-2xl px-4">
          <span className="text-ink-faint">
            <IconSearch size={16} />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar categoria"
            className={`${inputCls} bg-transparent px-0`}
          />
        </label>
      )}
      <div className="max-h-[50dvh] overflow-y-auto -mx-1 px-1">
        {list.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => onPick(o.key)}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left ${
              o.key === value ? "bg-soft" : ""
            }`}
          >
            <span className="text-lg">{o.icon}</span>
            <span className="flex-1 text-[15px] font-medium text-ink">{o.label}</span>
            {o.key === value && (
              <span className="text-accent">
                <IconCheck size={14} />
              </span>
            )}
          </button>
        ))}
        {list.length === 0 && (
          <p className="text-sm text-ink-faint text-center py-6">
            Nenhuma categoria com esse nome.
          </p>
        )}
      </div>
    </div>
  );
}
