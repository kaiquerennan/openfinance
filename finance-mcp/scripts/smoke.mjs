/**
 * Smoke test: sobe o servidor MCP por stdio como um cliente real faria,
 * lista as tools e chama cada uma contra o backend que estiver rodando.
 *
 *   npm run build && npm run smoke
 *
 * Exige o finance-app no ar; as credenciais saem do finance-app/.env.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER = resolve(dirname(fileURLToPath(import.meta.url)), '../dist/index.js');

const client = new Client({ name: 'finance-mcp-smoke', version: '1.0.0' });
await client.connect(
  new StdioClientTransport({ command: 'node', args: [SERVER], stderr: 'inherit' }),
);

const { tools } = await client.listTools();
console.log(`\n${tools.length} tools: ${tools.map((t) => t.name).join(', ')}`);

const calls = [
  ['listar_meses', {}],
  ['contas_e_saldos', {}],
  ['investimentos', {}],
  ['orcamentos', {}],
  ['metas', {}],
  ['serie_mensal', { meses: 3 }],
  ['transacoes', { mes: '2026-07', limite: 3 }],
  ['transacoes', { busca: 'uber', limite: 2 }],
  ['relatorio_mensal', {}],
  // Casos de erro: precisam voltar uma mensagem que o modelo consiga usar.
  ['tool_inexistente', {}],
  ['transacoes', { mes: 'julho' }],
];

let falhas = 0;
for (const [name, args] of calls) {
  const res = await client.callTool({ name, arguments: args });
  const text = res.content?.[0]?.text ?? '';
  const esperaErro = name === 'tool_inexistente' || args.mes === 'julho';
  if (Boolean(res.isError) !== esperaErro) falhas++;
  console.log(
    `\n[${res.isError ? 'erro' : ' ok '}] ${name} ${JSON.stringify(args)} — ${text.length} chars`,
  );
  console.log(text.length > 400 ? `${text.slice(0, 400)}\n  …[truncado]` : text);
}

await client.close();
console.log(falhas ? `\n${falhas} chamada(s) com resultado inesperado.` : '\nTudo ok.');
process.exit(falhas ? 1 : 0);
