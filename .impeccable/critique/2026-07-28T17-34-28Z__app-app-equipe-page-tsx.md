---
target: Equipe
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 1
timestamp: 2026-07-28T17-34-28Z
slug: app-app-equipe-page-tsx
---
Method: dual-agent (A: 171ba7a4-5e94-4395-a60f-1f8cabeed7f9 · B: c8614730-1c6a-484e-b9ec-98ab6ec63ba7)

#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Spinner + "Atualizando gráfico…" existem, mas `placeholderData` (dado antigo) exibido durante troca de mês não tem sinal de "desatualizado" além de um spinner discreto. |
| 2 | Match System / Real World | 3 | Termos de domínio precisos, mas o gráfico de etapas espelha a própria paleta do Bitrix24 em vez de uma leitura Flow Focus. |
| 3 | User Control and Freedom | 2 | Filtros (`month`, `bitrixFilter`, `department`) não persistem na URL; modal fecha bem (Esc/clique fora) mas não tem focus trap. |
| 4 | Consistency and Standards | 2 | Chrome de card/botão é fiel à marca; `TeamTag` usa `boxShadow` como borda e cores hex fixas, quebrando a disciplina de tokens do resto do app. |
| 5 | Error Prevention | 3 | Superfície somente-leitura, pouco a prevenir; botão de refetch desabilita durante fetch. |
| 6 | Recognition Rather Than Recall | 3 | Boas contagens inline ("Mostrando X de Y"), mas os `<select>` de status/departamento não têm rótulo acessível associado. |
| 7 | Flexibility and Efficiency | 1 | Sem busca por nome, sem ordenar por críticos, sem views salvas, sem atalhos — fraco para uma ferramenta de uso diário da liderança. |
| 8 | Aesthetic and Minimalist Design | 2 | Paleta arco-íris de etapas/equipes introduz ruído visual incompatível com a quietude da "Central Silenciosa". |
| 9 | Error Recovery | 2 | Card de erro mostra a mensagem mas não embute ação de retry, obrigando o usuário a localizar o botão do cabeçalho. |
| 10 | Help and Documentation | 1 | Nenhuma dica/legenda explica a regra de "crítico" (prazo vencido / 2+ dias sem movimentação) ou o significado das cores do gráfico. |
| **Total** | | **22/40** | **Aceitável — melhorias significativas necessárias** |

#### Design Specificity Verdict

**LLM assessment**: A composição estrutural (`.export-card`, `.export-broker-card`, `.export-dialog`) reutiliza corretamente os tokens Flow Focus (borda, raio, `--surface-raised`). Mas a camada de cor de conteúdo — `TEAM_TONES` e `STAGE_COLORS`, hex fixos em `components/team-dashboard.tsx` (linhas 25-32) e `components/team-stage-chart.tsx` (linhas 5-17) — é uma paleta arco-íris independente, sem relação com o sistema OKLCH, e vários desses hex (`#003172`, `#fff55a`, `#00adf2`) parecem uma cópia direta das cores de etapa do próprio Bitrix24. Ainda mais revelador: `app/globals.css` mantém um bloco totalmente integrado aos tokens e **não utilizado** — "Equipe · mesa de escala operacional" (`.team-state-board`, `.team-department`, `.team-broker-row`, ~linhas 1519-1650) — que corresponde ao padrão de "banner preto" documentado no DESIGN.md. Isso prova que uma versão correta e autoral já foi construída e depois abandonada em favor da porta genérica `export-*`, explicitamente rotulada no código como vinda de "equipe-export/source/team.tsx". Trocando as cores, esta página poderia pertencer a praticamente qualquer dashboard operacional genérico.

**Deterministic scan**: `detect.mjs --json` rodou limpo (exit 0, `[]`, sem findings) nos quatro arquivos-alvo. Isso é uma lacuna conhecida do detector mecânico, não um falso positivo: ele não capta uso semântico de cor fora dos tokens quando implementado via `style={{ background: tone.bg }}` inline. A varredura por grep da Avaliação B confirma exatamente os dois pontos que a Avaliação A citou por número de linha: `components/team-dashboard.tsx:51` e `:85` usam `style={{ background: tone.bg, color: tone.ink, boxShadow: ... }}` inline — o vetor real da violação da "Regra da Cor Rara". A varredura também confirma que nenhum raio de painel excede 16px, que não há `border-left` colorido nas classes realmente usadas por este conjunto, e que `font-variant-numeric: tabular-nums` está presente em todas as classes de métrica localizadas (`.team-stage-number`, `.export-team-tag > strong`, `.export-broker-total strong`, `.export-lead-state > strong`) — a Regra dos Numerais está sendo seguida corretamente.

**Visual overlays**: Nenhuma automação de navegador estava disponível nesta sessão (sem ferramenta Playwright/Puppeteer/browser exposta), então nenhum overlay `[Human]` foi injetado — não há evidência visual ao vivo para esta rodada, apenas leitura de código e CSS.

#### Overall Impression

O esqueleto estrutural desta página é sólido e fiel ao sistema — bordas, raios, elevação plana e espaçamento seguem DESIGN.md à risca. O problema real é que a camada de cor de conteúdo (paleta de equipes e etapas) foi implementada como uma porta direta de um pacote de export genérico, com hex fixos que replicam o Bitrix24 em vez de expressar a identidade "roxo raro, preto operacional, marfim quente" do produto. A maior oportunidade não é redesenhar a página — é terminar o trabalho que já foi começado: existe CSS on-brand não utilizado no próprio `globals.css` que já resolve esse problema para outra variante desta tela.

#### What's Working

- O CTA principal de cada `BrokerCard` escala de `button-secondary` para `button-primary` automaticamente só quando `row.criticos > 0` (linha 114) — a interface sinaliza urgência sozinha em vez de exigir que a liderança interprete números crus, uma execução precisa de "Governança sem fricção".
- `LeadRow` em `expiring-leads-dialog.tsx` (linha 21) combina tonalidade de cor com ícone e texto distintos por estado (vencido/vence hoje/parado), evitando corretamente sinalização só por cor.
- O chrome dos painéis (`.export-card`, `.export-broker-card`, `.export-dialog`) segue corretamente a Regra da Borda ou Sombra (borda só em repouso, sombra só no overlay) e mantém raio ≤16px — o sistema subjacente está correto mesmo onde a cor de conteúdo não está.

#### Priority Issues

- **[P0] Paleta arco-íris fora de tokens espelha o Bitrix, violando a Regra da Cor Rara/Preenchimento**
  **Why it matters**: o roxo deveria ser o único acento saturado, sinalizando estado — aqui a cor é codificação categórica decorativa que reproduz visualmente o kanban do Bitrix24 que o produto deveria distinguir. Isso é o oposto do North Star "A Central Silenciosa".
  **Fix**: renderizar etapas normais em `--muted`/`--surface-strong` neutros, reservando `--danger`/`--primary` só para segmentos críticos/perdidos; substituir os tags de equipe por rótulos planos derivados de token (sem matiz por equipe) ou por uma paleta fechada pequena tirada dos tokens semânticos existentes. Arquivos: `components/team-stage-chart.tsx:5-17`, `components/team-dashboard.tsx:25-32,51,85`.
  **Suggested command**: `$impeccable colorize`

- **[P1] O "memorable moment" do surface brief não foi construído**
  **Why it matters**: o brief pede explicitamente que "o card do corretor conecte a distribuição do pipeline ao modal agrupado de leads críticos", mas a chamada compacta do gráfico em `BrokerCard` (`team-dashboard.tsx:109`) nunca passa `criticalById`, diferente do gráfico agregado (linha 186). O momento de conexão que o brief pede está ausente exatamente onde deveria existir.
  **Fix**: derivar `criticalById` por linha a partir de `row.stages[].criticos` (já disponível em `TeamStageBucket`) e passá-lo ao `TeamStageChart` compacto para destacar o segmento crítico por corretor.
  **Suggested command**: `$impeccable shape`

- **[P2] Estados vazios são texto puro, contrariando a especificação documentada**
  **Why it matters**: DESIGN.md exige ícone + título ink + causa/próxima-ação em muted para todo estado vazio; "nunca tela em branco" está sendo interpretado literalmente demais como "não estar literalmente em branco". Ocorre em "Nenhum corretor ativo no momento." (linha 196), "Nenhum colaborador retornado pelo departamento." (linha 200) e "Nenhum lead crítico. Tudo em dia!" (`expiring-leads-dialog.tsx:56`).
  **Fix**: adicionar ícone primary/success, título ink curto e uma linha muted nomeando a causa provável ("Ajuste o filtro de status ou departamento").
  **Suggested command**: `$impeccable onboard`

- **[P2] Selects de filtro sem nome acessível**
  **Why it matters**: WCAG 2.2 AA exige nome/função/valor — usuários de leitor de tela ouvem só "combobox" sem propósito. Os `<select>` de "Bitrix status" e "Departamento" (`team-dashboard.tsx:172-173`) não têm `aria-label`, diferente dos selects de `MonthFilter` no mesmo arquivo, que usam corretamente `aria-label="Mês"`/`"Ano"`.
  **Fix**: adicionar `aria-label="Status no Bitrix"` / `aria-label="Departamento"`.
  **Suggested command**: `$impeccable harden`

- **[P3] Sem focus trap no modal de leads críticos**
  **Why it matters**: `ExpiringLeadsDialog` (linhas 35-45) trava o scroll do body e foca o botão de fechar ao abrir, mas nunca aprisiona Tab/Shift+Tab dentro do `dialogRef` — usuários de teclado podem tabular para o conteúdo atrás de um modal visualmente travado, desorientador em uma revisão de auditoria de alto risco.
  **Fix**: adicionar um focus trap padrão ciclando Tab dentro do container do diálogo.
  **Suggested command**: `$impeccable harden`

#### Persona Red Flags

**Alex (Power User)**: sem busca/filtro por nome em `activeRows`/`exemptRows` (bloco de render `grouped`, linhas 190-197), força rolagem manual por todos os departamentos para achar um corretor. Sem ordenação por críticos, o corretor mais sobrecarregado não aparece primeiro. Estado de filtro (`month`, `bitrixFilter`, `department` — `useState`, linhas 121-123) não reflete na URL, então Alex não consegue favoritar ou compartilhar "equipe X em julho" com um colega.

**Sam (Accessibility-Dependent)**: `aria-label` ausente nos `<select>` de status/departamento (linhas 172-173) deixa usuários de leitor de tela sem contexto. A falta de focus trap em `ExpiringLeadsDialog` (linhas 35-45) permite que o Tab escape para o fundo da página. O contador regressivo que atualiza a cada segundo (`formatCountdown`, `setInterval` linha 43) não tem controle de pausa nem `aria-live`, então um usuário que precise de mais tempo nunca obtém uma leitura estável da idade de um lead já vencido.

**Marina (Líder Comercial, persona específica do projeto)**: seu trabalho principal — identificar quem está afogado em leads vencidos — exige ler o rodapé de cada card um por um, já que as linhas não são ordenáveis por `row.criticos`. A paleta arco-íris de `STAGE_COLORS` a obriga a reaprender uma legenda de 9 cores que duplica a do próprio Bitrix24, fazendo `/equipe` parecer um espelho do CRM em vez de uma visão própria e governada da Flow Focus. Se sua organização tiver 7+ departamentos, o ciclo de 6 cores de `TEAM_TONES` (linha 49, `index % TEAM_TONES.length`) atribui cores idênticas a duas equipes diferentes em "Equipes no escopo", quebrando o atalho de leitura visual do qual ela depende.

#### Minor Observations

- `TEAM_TONES` com ciclo de 6 cores colide para qualquer escopo com mais de 6 departamentos (caso real de "muitos departamentos").
- Spinner de refresh (`is-spinning`) não anuncia o estado de refetch via `aria-live` para leitores de tela.
- `.export-team-filters > select:nth-of-type(1)/(2)` usam larguras fixas em pixels (200px/220px, linhas 1741-1742) que vão cortar nomes de departamento longos no `<select>` nativo, inconsistente com o tratamento por elipse usado em outros pontos da página.
- O `setInterval` do contador regressivo em `ExpiringLeadsDialog` roda a cada linha por segundo independentemente de ter prazo, um custo de re-render desnecessário para corretores com muitos críticos.
- O estado de erro (`export-error`) é mais bem trabalhado (ícone + título + descrição) do que os estados vazios, mostrando esforço de craft inconsistente entre estados semelhantes no mesmo arquivo.
- CSS on-brand "mesa de escala operacional" (`.team-state-board`, `.team-broker-row`, `border-left`, conversão `data-label`) existe em `app/globals.css` mas não está conectado a nenhuma classe usada por `team-dashboard.tsx` — é órfão de uma versão anterior/diferente da tela.

#### Questions to Consider

- Já existe uma implementação autoral e fiel à marca (`team-state-board`, `team-broker-row`) não utilizada em `globals.css` — substituí-la pela porta genérica `export-*` foi uma decisão deliberada, e esse CSS morto deveria ser removido ou a página deveria ser reconstruída sobre ele?
- Espelhar as próprias cores de etapa do Bitrix24 no gráfico é intencional (memória muscular para corretores) ou um descuido que enfraquece "Flow Focus organiza, Bitrix continua sendo o CRM"?
- Para uma diretora acompanhando 30+ corretores diariamente, uma grade de cards com um gráfico dentro de cada um é a densidade certa, ou uma visão de linha/tabela ordenável (como o padrão adormecido `team-broker-row`) serviria melhor a "localizar concentração... sem duplicar o trabalho do CRM"?
- `month`/`bitrixFilter`/`department` deveriam viver na URL para que uma líder possa compartilhar um link direto para uma visão específica em vez de perdê-la a cada navegação?
