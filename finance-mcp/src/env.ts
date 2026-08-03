/**
 * Configuracao do servidor.
 *
 * As variaveis podem vir do ambiente (FINANCE_API_URL / FINANCE_APP_PASSWORD),
 * mas o padrao e ler o proprio `finance-app/.env` que esta ao lado no
 * monorepo. Assim a senha do app nao precisa ser copiada para o arquivo de
 * configuracao do cliente MCP — existe um unico lugar com o segredo, e trocar
 * a senha do app nao quebra o MCP.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BACKEND_ENV = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../finance-app/.env',
);

/** Parser minimo de .env: `CHAVE=valor`, ignorando comentarios e aspas. */
function readBackendEnv(): Record<string, string> {
  let raw: string;
  try {
    raw = readFileSync(BACKEND_ENV, 'utf8');
  } catch {
    return {};
  }
  const values: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    values[match[1]] = match[2].trim().replace(/^["'](.*)["']$/, '$1');
  }
  return values;
}

export interface Config {
  baseUrl: string;
  password: string;
}

export function loadConfig(): Config {
  const backend = readBackendEnv();
  const port = process.env.FINANCE_API_PORT ?? backend.PORT ?? '3334';
  const password = process.env.FINANCE_APP_PASSWORD ?? backend.APP_PASSWORD ?? '';

  if (!password) {
    throw new Error(
      `Senha do app nao encontrada: defina FINANCE_APP_PASSWORD ou deixe APP_PASSWORD em ${BACKEND_ENV}.`,
    );
  }

  return {
    baseUrl: (process.env.FINANCE_API_URL ?? `http://localhost:${port}`).replace(/\/$/, ''),
    password,
  };
}
