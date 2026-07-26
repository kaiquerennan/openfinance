import {
  BadGatewayException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import {
  PluggyItem,
  PluggyTransaction,
  PluggyV2Page,
} from './pluggy.types';

/** apiKey da Pluggy expira em 2h. Renovamos com 5 min de margem. */
const API_KEY_TTL_MS = 2 * 60 * 60 * 1000;
const RENEW_MARGIN_MS = 5 * 60 * 1000;

interface CachedApiKey {
  value: string;
  /** epoch ms em que o apiKey deve ser considerado vencido (ja com a margem). */
  expiresAt: number;
}

@Injectable()
export class PluggyService implements OnModuleInit {
  private readonly logger = new Logger(PluggyService.name);
  private readonly http: AxiosInstance;
  private readonly clientId: string;
  private readonly clientSecret: string;

  private apiKeyCache: CachedApiKey | null = null;
  /** Evita corridas: varias chamadas simultaneas compartilham a mesma renovacao. */
  private inflightAuth: Promise<string> | null = null;

  constructor(private readonly config: ConfigService) {
    const baseURL = this.config.get<string>(
      'PLUGGY_BASE_URL',
      'https://api.pluggy.ai',
    );
    const clientId = this.config.get<string>('PLUGGY_CLIENT_ID');
    const clientSecret = this.config.get<string>('PLUGGY_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error(
        'PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET sao obrigatorios. Defina-os no .env',
      );
    }

    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.http = axios.create({ baseURL, timeout: 30_000 });
  }

  /**
   * Faz um "warm-up" do apiKey em background (sem bloquear o boot).
   * Se falhar, apenas logamos: o erro reaparece na primeira chamada real.
   */
  onModuleInit(): void {
    this.getApiKey()
      .then(() => this.logger.log('Autenticacao inicial com a Pluggy OK.'))
      .catch((err) =>
        this.logger.warn(
          `Warm-up de autenticacao falhou: ${(err as Error).message}`,
        ),
      );
  }

  // ---------------------------------------------------------------------------
  // Autenticacao
  // ---------------------------------------------------------------------------

  /**
   * Retorna um apiKey valido, renovando automaticamente quando necessario.
   * Nunca expoe clientId/clientSecret.
   */
  private async getApiKey(): Promise<string> {
    const now = Date.now();
    if (this.apiKeyCache && this.apiKeyCache.expiresAt > now) {
      return this.apiKeyCache.value;
    }

    // Se ja existe uma renovacao em andamento, reaproveita.
    if (this.inflightAuth) {
      return this.inflightAuth;
    }

    this.inflightAuth = this.authenticate().finally(() => {
      this.inflightAuth = null;
    });
    return this.inflightAuth;
  }

  private async authenticate(): Promise<string> {
    this.logger.log('POST /auth — renovando apiKey da Pluggy');
    try {
      const { data } = await this.http.post<{ apiKey: string }>('/auth', {
        clientId: this.clientId,
        clientSecret: this.clientSecret,
      });

      if (!data?.apiKey) {
        throw new InternalServerErrorException(
          'Resposta de /auth sem apiKey.',
        );
      }

      this.apiKeyCache = {
        value: data.apiKey,
        expiresAt: Date.now() + API_KEY_TTL_MS - RENEW_MARGIN_MS,
      };
      this.logger.log('apiKey renovado com sucesso.');
      return data.apiKey;
    } catch (err) {
      // Erro de auth nao deve vazar credenciais; remapeamos.
      throw this.mapError(err, 'POST /auth');
    }
  }

  // ---------------------------------------------------------------------------
  // Wrapper HTTP autenticado
  // ---------------------------------------------------------------------------

  private async request<T>(config: AxiosRequestConfig): Promise<T> {
    const apiKey = await this.getApiKey();
    const method = (config.method ?? 'GET').toUpperCase();
    const url = config.url ?? '';
    this.logger.log(`${method} ${url}${this.formatParams(config.params)}`);

    try {
      const { data } = await this.http.request<T>({
        ...config,
        headers: { ...config.headers, 'X-API-KEY': apiKey },
      });
      return data;
    } catch (err) {
      // 401 pode significar apiKey expirado prematuramente: tenta uma renovacao.
      if (this.isStatus(err, 401)) {
        this.logger.warn(
          `401 em ${method} ${url} — invalidando apiKey e tentando novamente.`,
        );
        this.apiKeyCache = null;
        const freshKey = await this.getApiKey();
        try {
          const { data } = await this.http.request<T>({
            ...config,
            headers: { ...config.headers, 'X-API-KEY': freshKey },
          });
          return data;
        } catch (retryErr) {
          throw this.mapError(retryErr, `${method} ${url}`);
        }
      }
      throw this.mapError(err, `${method} ${url}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Endpoints da Pluggy
  // ---------------------------------------------------------------------------

  /** Lista os conectores disponiveis (ex.: MeuPluggy id 200). */
  async getConnectors(): Promise<unknown> {
    return this.request({ method: 'GET', url: '/connectors' });
  }

  /** Gera um connectToken de curta duracao para o widget do frontend. */
  async createConnectToken(): Promise<unknown> {
    const clientUserId = this.config.get<string>(
      'PLUGGY_CLIENT_USER_ID',
      'me',
    );
    return this.request({
      method: 'POST',
      url: '/connect_token',
      data: { clientUserId },
    });
  }

  /** Busca os detalhes de um unico Item. */
  async getItem(itemId: string): Promise<PluggyItem> {
    return this.request({ method: 'GET', url: `/items/${itemId}` });
  }

  /** Lista as contas de um Item. */
  async getAccounts(itemId: string): Promise<{ results: PluggyAccount[] }> {
    return this.request({
      method: 'GET',
      url: '/accounts',
      params: { itemId },
    });
  }

  /** Lista a primeira pagina de transacoes de uma conta (endpoint /v2). */
  async getTransactionsByAccount(
    accountId: string,
    from?: string,
    to?: string,
  ): Promise<PluggyV2Page<PluggyTransaction>> {
    return this.request({
      method: 'GET',
      url: '/v2/transactions',
      params: { accountId, from, to },
    });
  }

  /**
   * Busca TODAS as transacoes de uma conta no /v2/transactions, seguindo o
   * cursor `next` (link para a proxima pagina) ate ele ser null.
   * Usado pelo sync.
   */
  async getAllTransactionsByAccount(
    accountId: string,
    from?: string,
    to?: string,
  ): Promise<PluggyTransaction[]> {
    const all: PluggyTransaction[] = [];

    let data = await this.request<PluggyV2Page<PluggyTransaction>>({
      method: 'GET',
      url: '/v2/transactions',
      params: { accountId, from, to },
    });
    all.push(...(data.results ?? []));

    // `next` vem como URL absoluta ou caminho; o axios lida com ambos.
    let next = data.next;
    while (next) {
      data = await this.request<PluggyV2Page<PluggyTransaction>>({
        method: 'GET',
        url: next,
      });
      all.push(...(data.results ?? []));
      next = data.next;
    }

    return all;
  }

  /**
   * Lista transacoes de TODAS as contas de um Item.
   * Primeiro busca as contas, depois agrega as transacoes de cada uma.
   */
  async getTransactionsByItem(
    itemId: string,
    from?: string,
    to?: string,
  ): Promise<{ accountId: string; results: unknown[] }[]> {
    const accounts = await this.getAccounts(itemId);
    const accountList = accounts.results ?? [];

    const perAccount = await Promise.all(
      accountList.map(async (account) => {
        const txs = await this.getTransactionsByAccount(
          account.id,
          from,
          to,
        );
        return { accountId: account.id, results: txs.results ?? [] };
      }),
    );

    return perAccount;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private formatParams(params?: Record<string, unknown>): string {
    if (!params) return '';
    const entries = Object.entries(params).filter(
      ([, v]) => v !== undefined && v !== null && v !== '',
    );
    if (entries.length === 0) return '';
    const qs = entries
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join('&');
    return `?${qs}`;
  }

  private isStatus(err: unknown, status: number): boolean {
    return axios.isAxiosError(err) && err.response?.status === status;
  }

  /** Mapeia erros da Pluggy para excecoes do NestJS, sem vazar segredos. */
  private mapError(err: unknown, context: string): HttpException {
    if (!axios.isAxiosError(err)) {
      this.logger.error(`Erro inesperado em ${context}: ${String(err)}`);
      return new InternalServerErrorException('Erro interno inesperado.');
    }

    const axiosErr = err as AxiosError<{ message?: string }>;
    const status = axiosErr.response?.status;
    const apiMessage =
      axiosErr.response?.data?.message ?? axiosErr.message ?? 'Erro';

    this.logger.error(
      `Falha em ${context} — status=${status ?? 'N/A'} msg="${apiMessage}"`,
    );

    switch (status) {
      case 400:
        return new HttpException(
          { statusCode: 400, message: `Requisicao invalida: ${apiMessage}` },
          400,
        );
      case 401:
        return new UnauthorizedException(
          'Credenciais Pluggy invalidas ou apiKey expirado.',
        );
      case 403:
        return new ForbiddenException(
          'Acesso negado pela Pluggy para este recurso.',
        );
      case 404:
        return new NotFoundException(
          'Recurso nao encontrado na Pluggy.',
        );
      case 410:
        return new HttpException(
          {
            statusCode: 410,
            message: `Endpoint da Pluggy descontinuado: ${apiMessage}`,
          },
          410,
        );
      case 429:
        return new HttpException(
          {
            statusCode: 429,
            message: 'Limite de requisicoes da Pluggy atingido. Tente novamente em instantes.',
          },
          429,
        );
      case 502:
      case 503:
      case 504:
        return new ServiceUnavailableException(
          'Pluggy temporariamente indisponivel.',
        );
      default:
        if (status === undefined) {
          // Sem resposta: timeout, DNS, rede.
          return new BadGatewayException(
            'Nao foi possivel contatar a Pluggy.',
          );
        }
        return new HttpException(
          { statusCode: status, message: apiMessage },
          status,
        );
    }
  }
}

export interface PluggyAccount {
  id: string;
  [key: string]: unknown;
}
