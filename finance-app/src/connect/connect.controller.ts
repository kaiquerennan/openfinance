import { Controller, Get, Header } from '@nestjs/common';

/**
 * Pagina minima (dev) que abre o Pluggy Connect Widget para criar um Item
 * e revelar o itemId. Servida em GET /connect.
 */
@Controller('connect')
export class ConnectController {
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  page(): string {
    return CONNECT_HTML;
  }
}

const CONNECT_HTML = /* html */ `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Finance App — Conectar banco (Pluggy)</title>
  <script src="https://cdn.pluggy.ai/pluggy-connect/v2.8.2/pluggy-connect.js"></script>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 640px; margin: 40px auto; padding: 0 16px; color: #1a1a2e; }
    h1 { font-size: 1.4rem; }
    button { font-size: 1rem; padding: 10px 18px; border: 0; border-radius: 8px; cursor: pointer; }
    .primary { background: #6c5ce7; color: #fff; }
    .primary:disabled { opacity: .5; cursor: default; }
    .ok { background: #00b894; color: #fff; }
    .card { margin-top: 24px; padding: 16px; border: 1px solid #ddd; border-radius: 10px; display: none; }
    code { background: #f1f1f5; padding: 2px 6px; border-radius: 4px; word-break: break-all; }
    .item-id { font-size: 1.1rem; font-weight: 600; }
    pre { background: #0f0f1e; color: #e6e6fa; padding: 12px; border-radius: 8px; overflow: auto; max-height: 320px; }
    .muted { color: #666; font-size: .9rem; }
  </style>
</head>
<body>
  <h1>Conectar banco via Pluggy</h1>
  <p class="muted">Clique abaixo para abrir o widget, escolha o <strong>MeuPluggy</strong> e autentique. Ao concluir, o <code>itemId</code> aparece aqui.</p>

  <button id="connect" class="primary">Conectar banco</button>

  <div id="result" class="card">
    <p>✅ Item criado! Seu <strong>itemId</strong>:</p>
    <p class="item-id"><code id="itemId">—</code></p>
    <button id="sync" class="ok">Sincronizar agora</button>
    <pre id="syncOut" style="display:none"></pre>
  </div>

  <script>
    let currentItemId = null;

    async function openWidget() {
      const btn = document.getElementById('connect');
      btn.disabled = true;
      btn.textContent = 'Gerando token...';
      try {
        const resp = await fetch('/pluggy/connect-token', { method: 'POST' });
        if (!resp.ok) throw new Error('Falha ao gerar connect-token: HTTP ' + resp.status);
        const data = await resp.json();
        const connectToken = data.accessToken || data.connectToken;
        if (!connectToken) throw new Error('Resposta sem accessToken');

        const widget = new PluggyConnect({
          connectToken,
          includeSandbox: false,
          connectorIds: [200], // foca no MeuPluggy
          onSuccess: (itemData) => {
            currentItemId = itemData && itemData.item && itemData.item.id;
            document.getElementById('itemId').textContent = currentItemId || '(nao retornado)';
            document.getElementById('result').style.display = 'block';
          },
          onError: (err) => {
            alert('Erro no Pluggy Connect: ' + JSON.stringify(err));
          },
          onClose: () => {
            btn.disabled = false;
            btn.textContent = 'Conectar banco';
          },
        });
        widget.init();
        btn.textContent = 'Conectar banco';
        btn.disabled = false;
      } catch (e) {
        alert(e.message);
        btn.disabled = false;
        btn.textContent = 'Conectar banco';
      }
    }

    async function syncNow() {
      if (!currentItemId) return;
      const out = document.getElementById('syncOut');
      out.style.display = 'block';
      out.textContent = 'Sincronizando ' + currentItemId + ' ...';
      try {
        const resp = await fetch('/pluggy/items/' + currentItemId + '/sync', { method: 'POST' });
        const data = await resp.json();
        out.textContent = JSON.stringify(data, null, 2);
      } catch (e) {
        out.textContent = 'Erro: ' + e.message;
      }
    }

    document.getElementById('connect').addEventListener('click', openWidget);
    document.getElementById('sync').addEventListener('click', syncNow);
  </script>
</body>
</html>`;
