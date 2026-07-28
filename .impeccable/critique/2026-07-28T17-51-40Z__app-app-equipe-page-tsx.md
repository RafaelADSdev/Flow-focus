---
target: Equipe
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
timestamp: 2026-07-28T17-51-40Z
slug: app-app-equipe-page-tsx
---
Method: dual-agent (A: b96bfe3a-a379-4e31-b4de-812542a86769 · B: 5ff3a951-40a7-4b75-a359-0a6497bd0f81)

#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | `placeholderData` mantém dados antigos na troca de mês; só spinner discreto e `aria-live` no refetch sinalizam atualização. |
| 2 | Match System / Real World | 3 | Termos de domínio precisos, mas a estrutura ainda espelha pipeline CRM em vez de visão governada Focus. |
| 3 | User Control and Freedom | 3 | Modal fecha bem (Esc, backdrop, focus trap); filtros não persistem na URL. |
| 4 | Consistency and Standards | 3 | Tokens dominam; resíduos de oklch literais em badges; `.export-team-tag` usa inset shadow como borda. |
| 5 | Error Prevention | 3 | Superfície somente-leitura; refetch desabilita durante fetch. |
| 6 | Recognition Rather Than Recall | 3 | `aria-label` nos selects corrigidos; sem legenda na página sobre regra de "crítico" (só `title` nas colunas). |
| 7 | Flexibility and Efficiency | 1 | Sem busca por nome, ordenação por críticos, views salvas ou deep-link. |
| 8 | Aesthetic and Minimalist Design | 3 | Paleta arco-íris removida; ruído residual de N mini-gráficos + gráfico agregado na mesma rolagem. |
| 9 | Error Recovery | 3 | `.export-error` com retry inline; loading é texto puro sem estrutura de recuperação. |
| 10 | Help and Documentation | 2 | Modal explica critérios; página não tem legenda do gráfico nem glossário de "crítico" antes do CTA. |
| **Total** | | **28/40** | **Aceitável — progresso real, gaps de triagem e orientação** |

#### Design Specificity Verdict

**LLM assessment**: O chrome estrutural (`.export-card`, `.export-broker-card`, `.export-dialog`) segue fielmente os tokens Flow Focus. A camada de conteúdo deixou de ser arco-íris Bitrix: `TeamStageChart` usa barras neutras e `--danger` só em `.has-critical`, alinhado ao surface brief. Ainda assim, a composição permanece uma porta do pacote `equipe-export`: grade de cards com mini-gráfico repetido, sem assinatura "Central Silenciosa" (banner preto operacional, visão ordenável). Trocando os rótulos Bitrix, a página ainda se lê como dashboard operacional genérico — só que agora on-brand na cor.

**Deterministic scan**: `detect.mjs --json` rodou limpo (exit 0, `[]`) nos quatro arquivos. A varredura mecânica confirma: zero `style={{` inline nos componentes; `team-stage-chart.tsx:32` usa `style={style}` apenas para `--stage-size` (funcional, não decorativo); raios de painel ≤14px; `border-left` colorido ausente nas classes Equipe; `tabular-nums` presente em todas as classes de métrica exceto `.export-broker-total em`. Inset `box-shadow` em tags é substituto de borda, não violação da Regra da Borda ou Sombra.

**Visual overlays**: Nenhuma automação de navegador disponível nesta sessão — sem overlay `[Human]`.

#### Overall Impression

A rodada anterior (22/40) apontava problemas estruturais de identidade e acessibilidade básica; a maioria foi corrigida. O que resta não é craft quebrado — é produto incompleto para o job da liderança: triar quem precisa de atenção primeiro. A página agora é fiel à marca, mas ainda não é a ferramenta de decisão que Marina precisa para um dia de operação com 20+ corretores.

#### What's Working

- O momento memorável do brief foi construído: `criticalById` no card + `.has-critical` + CTA que escala para primário quando há críticos.
- Disciplina cromática restaurada: etapas neutras, `--danger` reservado a críticos/perdidos — aderente à Regra da Cor Rara.
- Modal mais maduro: focus trap, empty state com ícone+título+causa, agrupamento por urgência com ícone+texto.

#### Priority Issues

- **[P1] Sem triagem para liderança — corretor crítico não sobe**
  **Why it matters**: o job primário do brief é "localizar concentração… sem duplicar o CRM"; com 20+ corretores, rolagem card a card é inviável.
  **Fix**: campo de busca + toggle "Ordenar por críticos" que reordena `activeRows` antes do `grouped`; opcionalmente pinar os 3 piores no topo.
  **Suggested command**: `$impeccable shape`

- **[P2] Legenda de "crítico" ausente na página**
  **Why it matters**: a regra (prazo vencido / 7 dias / 2+ dias parado) só aparece no modal; o líder precisa entender o código visual antes de abrir 15 modais.
  **Fix**: linha muted sob o header do gráfico agregado: "Vermelho = leads críticos nesta etapa".
  **Suggested command**: `$impeccable clarify`

- **[P2] Empty states sem ação explícita**
  **Why it matters**: DESIGN.md pede causa + próxima ação sugerida; texto passivo não fecha o loop.
  **Fix**: botão secundário "Limpar filtros" / "Atualizar sincronização" nos empty states de página.
  **Suggested command**: `$impeccable onboard`

- **[P3] Gráfico inacessível além de `title`**
  **Why it matters**: colunas são `<div>` sem `aria-label`; leitores de tela não obtêm contagem por etapa.
  **Fix**: `aria-label` em cada coluna com nome, contagem e críticos; considerar `role="img"` no container.
  **Suggested command**: `$impeccable harden`

- **[P3] Countdown ao vivo sem região estável**
  **Why it matters**: `setInterval` a cada 1s re-renderiza todos os `LeadRow` sem `aria-live` controlado.
  **Fix**: `aria-live="off"` no container + anunciar só na abertura; ou atualizar a cada 60s com `prefers-reduced-motion`.
  **Suggested command**: `$impeccable harden`

#### Persona Red Flags

**Alex (Power User)**: filtros em `useState` sem `searchParams` — impossível favoritar "equipe X · julho · ativos". Sem busca por nome; com 30 corretores, rolagem manual é o único atalho.

**Sam (Accessibility-Dependent)**: selects e focus trap corrigidos, mas colunas do gráfico são buracos de informação para leitores de tela. Countdown de 1s cria ruído de anúncio. Botão "Leads Críticos" não comunica contagem no `aria-label`.

**Marina (Líder Comercial)**: o memorable moment funciona card a card, mas ela não vê "quem está afogado" em uma vista — precisa ler o footer de cada card. Gráfico agregado mostra concentração por etapa, não por pessoa.

#### Minor Observations

- `export-message` (loading) é texto solto — inconsistente com `.export-error` e `.empty-state`.
- Cabeçalho de grupo duplica nome: `<h3>` + `<TeamTag>` com o mesmo texto.
- Footer mostra "Sem leads críticos" mas o botão permanece "Leads Críticos" em secundário — abre modal vazio.
- Labels de etapa em 0.52–0.62rem — legibilidade limítrofe com 9+ etapas.
- CSS órfão removido — limpeza confirmada.

#### Questions to Consider

- Com o memorable moment resolvido no card, o gráfico agregado ainda merece protagonismo no fold — ou deveria ceder lugar a um ranking de corretores críticos?
- Abrir "Leads Críticos" com zero críticos é feature de auditoria ou fricção que deveria desabilitar o CTA?
- A densidade de um mini-gráfico por corretor escala para 40 pessoas — quando vira lista/tabela ordenável?
- Filtros na URL são requisito de governança ou escopo futuro aceitável?
