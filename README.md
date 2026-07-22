# Flow Focus

Scaffold da plataforma de redistribuicao e auditoria de oportunidades comerciais da Diretoria Focus, integrado ao Bitrix24 e construído com Next.js, Supabase, TanStack Query, Zod e Recharts.

## O que esta entrega inclui

- App Router com telas de login, painel do corretor, configuracao de roletas, auditoria e produtividade.
- Componentes responsivos com estados de carregamento, erro, vazio, limite atingido e feedback de sucesso.
- Autenticacao Supabase por e-mail/senha com sessao em cookies e renovacao em `proxy.ts`.
- Client Supabase tipado para browser e servidor.
- Migration Postgres com tabelas, enums, indices, RLS por perfil/equipe e grants explicitos para a Data API.
- RPC transacional `captar_oportunidade`, protegida contra concorrencia com `FOR UPDATE SKIP LOCKED`.
- RPC `concluir_auditoria`, que aprova/libera ou reprova/bloqueia e registra o log.
- Edge Function `bitrix-webhook`, com sincronizacao inicial paginada, segredo proprio, persistencia do payload bruto, idempotencia, processamento e reprocessamento.
- Dashboard de produtividade lendo dados reais pelo RPC `obter_dashboard` do Supabase.
- Job `pg_cron` para liberar bloqueios vencidos e registrar a manutencao diaria.

As telas operacionais restantes ainda usam dados demonstrativos; o dashboard de produtividade ja consulta o Supabase.

## Decisoes tecnicas

**Login por e-mail e senha.** E a opcao de menor dependencia para a primeira entrega e funciona bem com contas corporativas controladas. SSO/OIDC pode ser adicionado depois sem alterar o modelo de usuarios.

**Recharts para os dashboards.** Foi escolhido em vez de Tremor para manter controle direto sobre semantica, responsividade e aparencia dos poucos graficos necessarios, sem introduzir um segundo sistema visual.

**Autorizacao no banco.** A interface esconde acoes fora do perfil, mas a protecao real esta no RLS e nas RPCs. O campo `perfil` e copiado de `raw_app_meta_data`; `user_metadata` nunca participa de decisoes de autorizacao.

**Captura atomica.** Limite, bloqueio, autorizacao da roleta, selecao da oportunidade e incremento do contador acontecem na mesma transacao. Isso evita duas capturas concorrentes da mesma oportunidade ou acima do limite.

**Reset sem apagar historico.** `capturas_diarias` usa a chave `(corretor_id, data)`. No primeiro acesso de um novo dia nasce um contador em zero; o job nao sobrescreve dias anteriores, preservando o dashboard e a auditoria.

## Suposicoes documentadas

- O limite diario padrao e 6 e permanece um teto por dia. Aprovar uma auditoria remove o bloqueio e habilita o proximo lote quando ainda houver capacidade no dia ou no inicio do proximo dia; nao eleva silenciosamente o teto diario.
- A importacao do Bitrix24 aceita somente negocios da categoria `36`, etapa `C36:NEW` ("Nova entrada") e cujo campo `UF_CRM_1726667595972` ("Roleta Atual") contenha a tag `Focus` em qualquer posicao.
- Todos os negocios elegiveis entram em uma unica roleta `Bolsao`; o valor completo de "Roleta Atual" permanece em `oportunidades.roleta_atual` para rastreabilidade.
- A URL em `BITRIX24_BASE_URL` inclui o caminho autenticado do webhook outbound quando necessario, por exemplo `https://conta.bitrix24.com.br/rest/usuario/token`.
- Horarios de negocio e o `current_date` do limite seguem o timezone configurado no Postgres. Configure o projeto Supabase para `America/Sao_Paulo` antes da producao.
- O scaffold usa senha minima de 6 caracteres localmente para acompanhar o padrao do Supabase CLI; producao deve usar 10+ caracteres e MFA para Diretora/Admin.

## Requisitos

- Node.js 20.9 ou superior
- npm 10 ou superior
- Docker Desktop ou runtime compativel, para executar o Supabase local
- Supabase CLI, ja instalada como dependencia de desenvolvimento

## Rodando localmente

```bash
npm install
copy .env.example .env.local
npx supabase start
npx supabase db reset
npm run dev
```

Abra `http://localhost:3000`. Sem `.env.local`, o frontend entra automaticamente em modo demonstracao e aceita os dados preenchidos no login. Com as variaveis configuradas, o login usa o Supabase Auth real.

Depois de `npx supabase start`, copie a API URL e a publishable key exibidas pelo CLI para `.env.local`. Nunca exponha `SUPABASE_SECRET_KEY` com prefixo `NEXT_PUBLIC_`.

## Banco, migration e tipos

A migration inicial esta em `supabase/migrations/20260722142912_initial_flow_focus_schema.sql`.

```bash
# Recriar o banco local, aplicar migration e seed
npx supabase db reset

# Conferir migrations
npx supabase migration list --local

# Regenerar os tipos depois de qualquer mudanca de schema
npx supabase gen types typescript --local > lib/database.types.ts

# Verificar alertas de seguranca e performance
npx supabase db advisors
```

No projeto hospedado:

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

Se as tabelas nao aparecerem na API, confirme as configuracoes da Data API. A migration usa `GRANT` explicito para `authenticated` e habilita RLS em todas as tabelas publicas; uma coisa nao substitui a outra.

## Edge Function do Bitrix24

Configure os segredos:

```bash
npx supabase secrets set BITRIX24_WEBHOOK_SECRET=um-segredo-forte
npx supabase secrets set BITRIX24_BASE_URL=https://conta.bitrix24.com.br/rest/usuario/token
npx supabase secrets set BITRIX24_FILTER_CATEGORY_ID=36
npx supabase secrets set BITRIX24_FILTER_STAGE_ID=C36:NEW
npx supabase secrets set BITRIX24_ROULETTE_FIELD=UF_CRM_1726667595972
npx supabase secrets set BITRIX24_ROULETTE_TAG=Focus
npx supabase secrets set BITRIX24_POOL_NAME=Bolsão
npx supabase secrets set BITRIX24_SUPERINTENDENCY_DEPARTMENT_ID=444
npx supabase secrets set BITRIX24_DIRECTORATE_DEPARTMENT_ID=442
npx supabase secrets set BITRIX24_TEAM_DEPARTMENT_IDS=454,448,551
npx supabase functions deploy bitrix-webhook --no-verify-jwt
```

O endpoint nao usa JWT porque o Bitrix24 e um sistema externo. Em vez disso, exige `x-flow-focus-secret`; mantenha o valor fora da URL sempre que o Bitrix permitir header customizado.

Teste local com o mock:

```bash
npx supabase functions serve bitrix-webhook --no-verify-jwt --env-file .env.local
curl -X POST http://127.0.0.1:54321/functions/v1/bitrix-webhook \
  -H "content-type: application/json" \
  -H "x-flow-focus-secret: troque-por-um-segredo-forte" \
  --data @supabase/functions/bitrix-webhook/mock-payload.json
```

Para reprocessar um evento com falha, envie um novo `POST` autenticado com o header `x-reprocess-event-id: UUID_DO_EVENTO`. O payload bruto fica em `webhook_eventos`; a tabela nao possui policy para usuarios autenticados comuns.

Para fazer a carga inicial e reconciliar os negocios que estao atualmente em "Nova entrada":

```bash
curl -X POST https://SEU_PROJECT_REF.supabase.co/functions/v1/bitrix-webhook \
  -H "content-type: application/json" \
  -H "x-flow-focus-secret: SEU_SEGREDO" \
  --data '{"action":"sync"}'
```

No Bitrix24, crie um webhook de saida para os eventos de negocio adicionado e atualizado, apontando para a URL da funcao com `?secret=SEU_SEGREDO`. O webhook REST de leitura precisa do escopo `event` para executar `event.bind`; como o acesso atual nao possui esse escopo, o vinculo deve ser criado na interface do Bitrix ou por uma credencial adicional autorizada. A funcao sempre rele o negocio e reaplica os tres filtros, portanto eventos de outras etapas ou roletas nao entram na fila.

Para sincronizar as equipes Focus Total (`454`), Focus Lider (`448`) e Focus Elite (`551`), seus lideres e corretores ativos:

```bash
curl -X POST https://SEU_PROJECT_REF.supabase.co/functions/v1/bitrix-webhook \
  -H "content-type: application/json" \
  -H "x-flow-focus-secret: SEU_SEGREDO" \
  --data '{"action":"sync_people"}'
```

A carga valida a hierarquia ate a superintendencia Jordao (`444`), cria as contas no Supabase Auth sem senha e sem enviar convites, e associa os responsaveis dos departamentos como lideres. Os demais usuarios ativos entram como corretores. Use `{"action":"sync_all"}` para sincronizar pessoas e oportunidades na mesma chamada. A ativacao do acesso pode ser feita posteriormente por magic link, recuperacao de senha ou convite explicito.

`usuarios.equipe_id` preserva a chave estrangeira, enquanto `usuarios.equipe_nome` mostra diretamente o nome legivel da equipe. Triggers mantem os dois campos consistentes e propagam futuras alteracoes no nome da equipe.

## Validacao

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Estrutura principal

```text
app/                         rotas e estados globais do Next.js
components/                  app shell e componentes de dominio
lib/schemas/                 schemas Zod compartilhados
lib/supabase/                clients browser/server e sessao
supabase/migrations/         schema, RLS, RPCs e cron
supabase/functions/          webhook Bitrix24 e payload de teste
PRODUCT.md                   contexto estrategico do produto
DESIGN.md                    tokens e regras visuais
```

## Proximos passos recomendados

1. Conectar cada tela aos queries/mutations reais do TanStack Query.
2. Criar usuarios de teste para os quatro perfis e testes de RLS por matriz de acesso.
3. Mapear etapas e categorias reais do Bitrix24, incluindo assinatura/autenticacao suportada pelo tenant.
4. Adicionar MFA para perfis privilegiados, observabilidade da Edge Function e alertas para eventos em erro.
