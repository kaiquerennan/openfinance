#!/usr/bin/env node
/**
 * Servidor MCP do finance-app.
 *
 * Fala MCP por stdio e traduz cada tool em um GET autenticado no backend
 * NestJS (http://localhost:3334 por padrao). Assim o cliente — Claude Code,
 * Claude Desktop — puxa so o contexto que a pergunta pede, em vez de receber
 * um dump do extrato inteiro.
 *
 * Config por env: FINANCE_API_URL e FINANCE_APP_PASSWORD.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { FinanceApi } from './api.js';
import { TOOLS } from './tools.js';

async function main() {
  // Falha aqui (sem senha configurada) e melhor que falhar na primeira tool:
  // o cliente MCP mostra o erro de startup, nao um "tool failed" generico.
  const api = new FinanceApi();

  const server = new Server(
    { name: 'finance-mcp', version: '0.1.0' },
    {
      capabilities: { tools: {} },
      instructions:
        'Dados financeiros pessoais reais, sincronizados de bancos via Open Finance (Pluggy). ' +
        'Valores em BRL. Comece por listar_meses para saber o intervalo disponivel; para numeros ' +
        'de um mes prefira relatorio_mensal em vez de somar transacoes na mao. Nao invente ' +
        'valores: se uma tool nao retornou o dado, diga que nao ha dado.',
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = TOOLS.find((t) => t.name === request.params.name);
    if (!tool) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Tool desconhecida: ${request.params.name}` }],
      };
    }

    try {
      const result = await tool.run(api, (request.params.arguments ?? {}) as any);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      // Erro vira resultado de tool, nao excecao de protocolo: o modelo le a
      // mensagem e pode corrigir o argumento ou avisar que o backend caiu.
      return {
        isError: true,
        content: [{ type: 'text', text: (err as Error).message }],
      };
    }
  });

  await server.connect(new StdioServerTransport());
  // stdout e o canal do protocolo — todo log vai para stderr.
  console.error('finance-mcp pronto (stdio)');
}

main().catch((err) => {
  console.error(`finance-mcp falhou ao iniciar: ${(err as Error).message}`);
  process.exit(1);
});
