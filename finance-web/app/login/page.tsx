"use client";

// Login por senha única (app pessoal, sem cadastro de usuário).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Field, inputCls, PrimaryButton } from "@/components/ui";
import { IconEye, IconEyeOff } from "@/components/icons";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!password) return;
    setLoading(true);
    setError(null);
    try {
      await api.login(password);
      router.push("/");
      router.refresh();
    } catch (e) {
      setError((e as Error).message || "Senha incorreta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-2xl font-bold text-ink">
            Visor <span className="text-accent">•</span>
          </div>
          <div className="text-sm text-ink-dim mt-1">
            Suas finanças, só suas.
          </div>
        </div>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Field label="Senha">
            <div className="relative">
              <input
                className={`${inputCls} pr-12`}
                type={visible ? "text" : "password"}
                autoFocus
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              {/* Ver o que digitou evita errar a senha e esbarrar no limite de tentativas. */}
              <button
                type="button"
                aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
                onClick={() => setVisible((v) => !v)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 w-9 grid place-items-center text-ink-dim"
              >
                {visible ? <IconEyeOff size={17} /> : <IconEye size={17} />}
              </button>
            </div>
          </Field>
          {error && <p className="text-xs text-neg">{error}</p>}
          <PrimaryButton type="submit" disabled={loading || !password}>
            {loading ? "Entrando…" : "Entrar"}
          </PrimaryButton>
        </form>
      </div>
    </div>
  );
}
