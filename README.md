# Della Nonna Pizzaria

## Aplicativo desktop para Windows

O aplicativo Electron abre a Central de impressão, acompanha pedidos com uma sessão autenticada do Supabase e imprime tickets ESC/POS de 58 mm pelo spooler do Windows. A chave `service_role` não é necessária nem incluída no aplicativo.

### Preparar o Supabase

1. Aplique `supabase/migrations/202610130001_order_print_queue.sql` se ainda não estiver aplicada.
2. Aplique `supabase/migrations/202610200001_desktop_print_queue_access.sql` para habilitar o acesso autenticado à fila de impressão.
3. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no `.env` antes de compilar. A chave anon é pública e continua protegida pelas políticas RLS.

### Executar durante o desenvolvimento

```powershell
npm install
npm run desktop:dev
```

Entre com a conta administrativa já utilizada no sistema, selecione a impressora USB instalada e ative a impressão automática. O serviço de fila funciona enquanto o aplicativo desktop estiver aberto e a sessão autenticada permanecer válida.

### Gerar o instalador Windows

Em um ambiente Windows x64 com acesso ao npm:

```powershell
npm install
npm run desktop:installer
```

O instalador NSIS será criado em `release/`. Ele inclui o Electron e as dependências da aplicação; o computador de destino não precisa ter Node.js ou npm. O instalador contém o cliente público do Supabase, nunca a chave `service_role`.

O item “Iniciar com o Windows” controla a inicialização automática no perfil do Windows que executa o aplicativo. “Impressora Windows conectada” indica que o driver/fila está disponível no sistema; a confirmação de papel físico ainda depende da própria impressora.

### Recursos do painel desktop

- Estado de conexão ao Supabase, disponibilidade da fila do Windows e impressão automática.
- Fila com aguardando, impressos, falhas, tentativas, filtros por período/status e busca.
- Detalhes do pedido, impressão manual, reimpressão e teste do equipamento.
- Recuperação da fila por consulta periódica e notificações Realtime enquanto a sessão está ativa.

## Configurações da pizzaria e delivery

O painel administrativo inclui `/admin/configuracoes` para endereço e horários de funcionamento e `/admin/delivery` para configurar taxa dinâmica por distância ou uma taxa fixa, além das faixas dinâmicas. Aplique as migrations `202610210001_pizzeria_delivery_settings.sql`, `202610220001_delivery_fee_manual_fallback.sql`, `202610220002_save_delivery_rules_where.sql` e `202610220003_delivery_fixed_or_dynamic_mode.sql` antes de usar essas páginas.

O checkout busca o CEP pelo ViaCEP e solicita uma cotação da Edge Function `delivery-quote`. No modo dinâmico, com `ORS_API_KEY`, a function geocodifica a origem salva e o endereço do cliente e calcula a distância pela rota `driving-car` do OpenRouteService. No modo fixo, aplica a taxa configurada sem calcular rota. Sem a chave de rotas no modo dinâmico, o checkout ainda permite enviar delivery, mas registra a taxa como pendente de confirmação manual. Ao enviar um pedido, `submit-public-order` recalcula a taxa no servidor; os RPCs de criação de pedido deixam de ser executáveis pelas chaves públicas.

### Publicar as Edge Functions

Configure uma chave do OpenRouteService e a chave `service_role` do projeto como secrets do Supabase. Essas chaves ficam somente no ambiente das Edge Functions e nunca no `.env` do Vite ou no instalador:

```powershell
supabase link --project-ref isaejevdqdqqsvctkcxf
supabase db push
supabase secrets set ORS_API_KEY=sua_chave_openrouteservice SUPABASE_SERVICE_ROLE_KEY=sua_service_role
supabase functions deploy delivery-quote
supabase functions deploy submit-public-order
```

As duas funções permitem chamadas sem sessão JWT porque o checkout é público. Elas validam entrada, consultam configuração por credencial de servidor e só a função de envio cria o pedido, depois de recalcular o trajeto. O OpenRouteService impõe cotas e limites de uso; acompanhe o consumo da chave no painel do provedor.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
