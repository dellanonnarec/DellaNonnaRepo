# Agente local de impressão Della Nonna

Serviço Node.js para receber avisos do Supabase Realtime, recuperar a fila persistente e enviar cupons ESC/POS à fila USB instalada no Windows. O agente não abre uma porta HTTP e não depende do Kanban ou do navegador ficar aberto.

## Preparar o Windows e a impressora

1. Instale o driver da Oivida BSC-58MM e conecte-a por USB.
2. No PowerShell, execute `Get-Printer | Select-Object Name, DriverName, PortName` e copie o nome exato da fila para `PRINTER_NAME` em `.env`.
3. Confirme no manual/driver que a impressora aceita ESC/POS. As especificações recebidas confirmam USB e 58 mm, mas não informam explicitamente a emulação ESC/POS; o primeiro cupom real será necessário para conferir comandos, corte (não enviado por este agente) e acentuação.

## Configurar o Supabase

1. Aplique `supabase/migrations/202610130001_order_print_queue.sql` uma única vez no SQL Editor do projeto Supabase.
2. A migration cria a fila sem preencher pedidos antigos. Um trigger inclui somente novos pedidos inseridos com status `recebido`.
3. Copie este arquivo para `.env` e preencha `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `PRINTER_NAME`.

A chave `service_role` fica somente neste agente local. Nunca use prefixo `VITE_`, nunca copie a chave para o React e não compartilhe o `.env`. Ela ignora RLS e concede acesso amplo ao banco; mantenha o computador da loja protegido e limite o acesso ao arquivo.

## Instalar e executar

Requer Node.js 22 ou superior e Windows com o serviço de impressão ativo.

```powershell
cd "D:\projetos\Della Nonna Pizzaria\printing-agent"
npm install
Copy-Item .env.example .env
# Edite .env antes de continuar
npm start
```

Deixe o processo rodando durante o funcionamento da loja. Para iniciar com o Windows, configure uma tarefa agendada para executar `npm start` no login do usuário que instalou a impressora, com esta pasta como diretório inicial.

## Reprocessar um pedido com falha

O agente tenta novamente falhas recuperáveis até `PRINT_MAX_ATTEMPTS`, com espera crescente. Um trabalho interrompido durante o envio fica em `erro` para evitar reimpressão automática ambígua. Confira se o cupom saiu e então use:

```powershell
npm run retry -- UUID_DO_PEDIDO
```

O argumento é o `id` UUID da tabela `pedidos`, não o número visível do pedido. O agente registra a fila e as falhas em `fila_impressao_pedidos` e também escreve eventos no terminal.

## Limite de confirmação

O Windows confirma que aceitou os bytes na fila de impressão; isso não prova que o papel saiu fisicamente. Se o processo cair no intervalo entre o spooler aceitar o trabalho e o banco confirmar o estado, o agente deixa o pedido para conferência manual, em vez de arriscar uma duplicidade.
