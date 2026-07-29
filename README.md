# Flow Focus

Scaffold da plataforma de redistribuicao e auditoria de oportunidades comerciais da Diretoria Focus, integrado ao Bitrix24 e construído com Next.js, Supabase, TanStack Query, Zod e Recharts.

## Sumario

- [O que esta entrega inclui](#o-que-esta-entrega-inclui)
- [Decisoes tecnicas](#decisoes-tecnicas)
- [Suposicoes documentadas](#suposicoes-documentadas)
- [Requisitos](#requisitos)
- [Rodando localmente](#rodando-localmente)
- [Banco, migration e tipos](#banco-migration-e-tipos)
- [Edge Function do Bitrix24](#edge-function-do-bitrix24)
- [Cerca virtual (geofencing)](#cerca-virtual-geofencing)
- [Validacao](#validacao)
- [Estrutura principal](#estrutura-principal)
- [Proximos passos recomendados](#proximos-passos-recomendados)

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
- O sync do Bolsão pagina pelo cursor `next` do Bitrix (não só por `total/50`) e reporta também o total Focus na category (qualquer etapa) para comparar com o Focus Analytics.
- Cada valor distinto de "Roleta Atual" gera sua propria roleta (chave canonica: minusculo, sem acento e sem espacos nas pontas), em vez de um bolsão monolítico. `oportunidades.roleta_atual` guarda o valor original do Bitrix para rastreabilidade, e `roletas.bitrix_roleta_valor` guarda a chave canonica usada para casar novas oportunidades com a roleta certa.
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

A migration inicial esta em `supabase/migrations/20260722142912_initial_flow_focus_schema.sql`; as demais em `supabase/migrations/` sao incrementais e devem ser aplicadas em ordem cronologica pelo proprio CLI. Destaques recentes:

- `20260729102000_bolsao_roleta_atual_permissions.sql` e `20260729120000_split_bolsao_by_roleta_atual.sql`: migram o bolsão monolítico para uma roleta por valor de "Roleta Atual", propagando as liberacoes de corretor existentes.
- `20260729141135_geofence_sessions.sql`, `20260729143543_geofence_configuracao.sql` e `20260729151632_lock_down_geofence_rpcs.sql`: schema da cerca virtual e reforco de RLS/RPC (ver [Cerca virtual (geofencing)](#cerca-virtual-geofencing)).

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
npx supabase secrets set BITRIX24_CAPTURE_CATEGORY_ID=16
npx supabase secrets set BITRIX24_CAPTURE_STAGE_ID=C16:UC_PZR1SI
npx supabase secrets set BITRIX24_CORRETOR_FIELD=UF_CRM_1726664928
npx supabase secrets set BITRIX24_ROULETTE_FIELD=UF_CRM_1726667595972
npx supabase secrets set BITRIX24_ROULETTE_TAG=Focus
npx supabase secrets set BITRIX24_POOL_NAME=Bolsão
npx supabase secrets set BITRIX24_COMERCIAL_SYNC_START_YEAR=2025
npx supabase secrets set BITRIX24_SUPERINTENDENCY_DEPARTMENT_ID=444
npx supabase secrets set BITRIX24_DIRECTORATE_DEPARTMENT_ID=442
npx supabase secrets set BITRIX24_TEAM_DEPARTMENT_IDS=454,448,551
npx supabase functions deploy bitrix-webhook --no-verify-jwt
```

`BITRIX24_FILTER_*` define a origem do bolsão (Comercial Geral · Encaminhamento de leads); `BITRIX24_CAPTURE_*` define o destino ao captar (Comercial · GERAL · Tentativa de Contato). Todas essas variaveis tambem precisam existir em `.env.local` para os scripts locais (veja `.env.example`).

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

A carga valida a hierarquia ate a superintendencia Jordao (`444`), cria as contas no Supabase Auth sem senha e sem enviar convites, e associa os responsaveis dos departamentos como lideres. Os demais usuarios ativos entram como corretores. Use `{"action":"sync_all"}` para sincronizar pessoas, o bolsão e o histórico do Comercial Geral (ano corrente) na mesma chamada. Para só o Comercial Geral: `{"action":"sync_comercial_geral"}`. A ativacao do acesso pode ser feita posteriormente por magic link, recuperacao de senha ou convite explicito.

Para carga local via CLI (ano inteiro, com vínculo de corretor pelo responsável no Bitrix):

```bash
node scripts/sync-bitrix-comercial-geral-focus.mjs
# ou YEAR=2025 node scripts/sync-bitrix-comercial-geral-focus.mjs
```

Na aplicação, a sincronização do Comercial Geral cobre por padrão o ano atual e o anterior, pois um negócio antigo pode ser capturado ou movimentado hoje. Em bases com histórico maior, ajuste `BITRIX24_COMERCIAL_SYNC_START_YEAR`.

`usuarios.equipe_id` preserva a chave estrangeira, enquanto `usuarios.equipe_nome` mostra diretamente o nome legivel da equipe. Triggers mantem os dois campos consistentes e propagam futuras alteracoes no nome da equipe.

## Cerca virtual (geofencing)

As rotas operacionais (`/corretor`, `/roletas`, `/equipe`, `/auditorias`, as configuracoes sensiveis, `/dashboard` e `/comercial-geral`) exigem uma geo-sessao valida. O indice `/configuracoes` e `/configuracoes/localizacao` sao as excecoes administrativas de recuperacao. Quando a sessao nao existe ou expirou, `proxy.ts` redireciona para `/verificar-localizacao` antes da renderizacao dos Server Components; isso evita enviar os dados protegidos no HTML ou no payload RSC. O mesmo proxy devolve `403` em JSON para qualquer rota sob `/api/dados/*` sem geo-sessao.

O navegador monitora a posicao com `watchPosition` e o servidor calcula a distancia pela formula de Haversine. Uma validacao aprovada cria um cookie `geo_sessao` assinado, `httpOnly`, `Secure`, `SameSite=Strict` e com expiracao curta. O heartbeat renova a sessao apenas enquanto a ultima posicao continua valida. Se GPS, permissao ou rede falharem, a UI fecha imediatamente; cookie e sessao de banco expiram em ate `GEO_SESSION_SECONDS`.

Configure localmente em `.env.local` e repita na Vercel em **Project Settings -> Environment Variables**, para **Production** e **Preview**:

```dotenv
OFFICE_LAT=latitude-do-escritorio
OFFICE_LNG=longitude-do-escritorio
OFFICE_RADIUS_METERS=150
GEO_SESSION_SECONDS=30
GEO_SESSION_SECRET=segredo-aleatorio-com-32-ou-mais-caracteres
```

Depois que a migration estiver aplicada, um administrador pode alterar o ponto central e o raio em **Configuracoes -> Localizacao do escritorio**. A configuracao salva no Supabase tem prioridade sobre `OFFICE_LAT`, `OFFICE_LNG` e `OFFICE_RADIUS_METERS`; as variaveis continuam como fallback de bootstrap. A pagina de localizacao e o indice de configuracoes nao exigem uma geo-sessao previa, mas continuam protegidos por autenticacao e perfil `admin`, evitando que uma configuracao ausente bloqueie a propria recuperacao do perimetro.

`OFFICE_*`, `GEO_SESSION_SECONDS` e `GEO_SESSION_SECRET` sao exclusivamente server-side e nunca recebem o prefixo `NEXT_PUBLIC_`. Gere um segredo dedicado (por exemplo, `openssl rand -base64 32`); por compatibilidade, o servidor usa `SUPABASE_SECRET_KEY`/`SUPABASE_SERVICE_ROLE_KEY` como fallback. O projeto ja usa a publishable key atual do Supabase em `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, em vez da antiga anon key.

As migrations `20260729141135_geofence_sessions.sql`, `20260729143543_geofence_configuracao.sql` e `20260729151632_lock_down_geofence_rpcs.sql` precisam ser aplicadas no Supabase. As duas primeiras armazenam a sessao curta, o perimetro ativo e um historico privado das alteracoes; as coordenadas dos usuarios nunca sao persistidas. Juntas, elas acrescentam policies RLS restritivas as tabelas expostas e revogam de `anon`/`authenticated` as RPCs `SECURITY DEFINER` (`captar_oportunidade`, `concluir_auditoria`, `obter_carteira`, `obter_config_roletas`, `obter_painel_auditorias`) que contornariam RLS, mantendo o acesso apenas via `service_role`. As consultas sensiveis do app continuam no servidor Next.js com a secret key, depois do bloqueio no proxy:

```bash
npx supabase db push
```

Nao foi usado um claim booleano no JWT: ele poderia continuar verdadeiro durante toda a vida do access token. A sessao curta no banco permite que RLS compare `expires_at` com `now()` sem depender de refresh de JWT a cada 15 segundos. A Geolocation API requer HTTPS (a Vercel ja fornece) ou `localhost`.

Importante: coordenadas entregues pelo navegador podem ser simuladas por software ou por um dispositivo comprometido. A implementacao impede bypass por UI, cookie editado, chamada direta ao Data API e expiração esquecida, mas geofencing web nao equivale a atestacao de hardware antifraude.

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
