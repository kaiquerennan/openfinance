/**
 * Cliente HTTP do finance-app.
 *
 * O backend protege tudo com um cookie de sessao emitido por POST /auth/login
 * (senha unica, `APP_PASSWORD`). Aqui a sessao e obtida sob demanda, guardada
 * em memoria e renovada automaticamente quando o backend responde 401 — o
 * cookie dura 30 dias, mas o servidor pode reiniciar com outro AUTH_SECRET.
 */

import { loadConfig } from './env.js';

export class FinanceApiError extends Error {}

export class FinanceApi {
  private readonly baseUrl: string;
  private readonly password: string;
  /** Cookie de sessao em memoria; null enquanto nao houver login. */
  private session: string | null = null;
  /** Login em voo, para varias tools concorrentes nao logarem em paralelo. */
  private pendingLogin: Promise<string> | null = null;

  constructor() {
    const config = loadConfig();
    this.baseUrl = config.baseUrl;
    this.password = config.password;
  }

  /** GET em um endpoint do backend, ja autenticado. */
  async get<T>(path: string, query: Record<string, unknown> = {}): Promise<T> {
    const url = new URL(this.baseUrl + path);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }

    let res = await this.fetchWithSession(url, await this.getSession());
    if (res.status === 401) {
      // Sessao caiu (servidor reiniciou, segredo trocado): loga de novo uma vez.
      this.session = null;
      res = await this.fetchWithSession(url, await this.getSession());
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new FinanceApiError(
        `${path} respondeu ${res.status} ${res.statusText}${body ? `: ${body.slice(0, 300)}` : ''}`,
      );
    }
    return (await res.json()) as T;
  }

  private fetchWithSession(url: URL, session: string): Promise<Response> {
    return this.request(url, { headers: { cookie: `session=${session}` } });
  }

  private async getSession(): Promise<string> {
    if (this.session) return this.session;
    // Reaproveita o login em voo em vez de disparar um por tool concorrente.
    this.pendingLogin ??= this.login().finally(() => {
      this.pendingLogin = null;
    });
    return this.pendingLogin;
  }

  private async login(): Promise<string> {
    const res = await this.request(new URL(this.baseUrl + '/auth/login'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: this.password }),
    });

    if (res.status === 401) {
      throw new FinanceApiError(
        'Senha recusada pelo finance-app — FINANCE_APP_PASSWORD precisa ser igual ao APP_PASSWORD do backend.',
      );
    }
    if (!res.ok) {
      throw new FinanceApiError(`Login falhou: ${res.status} ${res.statusText}`);
    }

    const cookie = res.headers
      .getSetCookie()
      .map((c) => /(?:^|;\s*)session=([^;]+)/.exec(c)?.[1])
      .find(Boolean);
    if (!cookie) {
      throw new FinanceApiError('Login nao retornou o cookie de sessao.');
    }
    this.session = cookie;
    return cookie;
  }

  /** fetch com timeout e mensagem util quando o backend nao esta no ar. */
  private async request(url: URL, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
    } catch (err) {
      throw new FinanceApiError(
        `Nao consegui falar com o finance-app em ${this.baseUrl} (${(err as Error).message}). ` +
          'Confira se o backend esta rodando (npm run start:dev) e se FINANCE_API_URL aponta pra ele.',
      );
    }
  }
}
