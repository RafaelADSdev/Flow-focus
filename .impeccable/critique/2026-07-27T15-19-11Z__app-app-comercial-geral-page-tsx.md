---
target: Comercial geral
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-07-27T15-19-11Z
slug: app-app-comercial-geral-page-tsx
---
#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Sync e toast de move bons; sucesso silencioso; warning cai no mesmo canal de erro |
| 2 | Match System / Real World | 3 | Vocabulário Bitrix/fase/roleta certo; cores de estágio intermediárias sem significado de esteira |
| 3 | User Control and Freedom | 2 | Rollback de drag falho ok; sem undo pós-sucesso; teclado sem caminho visível para escolher fase |
| 4 | Consistency and Standards | 3 | PageHeader/buttons/drawer alinhados; sinal de coluna só por cor |
| 5 | Error Prevention | 2 | Move de fase e Transferir (drawer/lote) escrevem no Bitrix sem confirmação — inclusive S/F |
| 6 | Recognition Rather Than Recall | 3 | Card mostra corretor/equipe/stale; valor só no drawer; filtros ativos viram só badge numérico |
| 7 | Flexibility and Efficiency | 3 | Lote + auto-sync + DnD; atalhos invisíveis; max-height freia scan de fila |
| 8 | Aesthetic and Minimalist Design | 2 | Chrome por card + arco-íris de fases fere a Regra da Cor Rara |
| 9 | Error Recovery | 2 | “Fechar” com ícone RotateCcw sugere retry e só dismiss; falha exige re-arrastar |
| 10 | Help and Documentation | 2 | Summary ensina o grip; empty sem próxima ação; zero ajuda de teclado/lote/risco Bitrix |
| **Total** | | **25/40** | **Acceptable** |

#### Design Specificity Verdict

**LLM assessment**: A superfície carrega DNA Flow Focus em tokens e copy — marfim, roxo em roleta/primary-soft, tipografia densa, numerais tabulares no sync, e Bitrix nomeado em “Abrir no Bitrix24”, toasts de atualização e sync. Roleta, equipe/corretor e “dias sem mover” ancoram o ciclo Focus. Ainda assim, a composição é um kanban de pipeline CRM recolorido: colunas iguais, cards com grip, `stageColors` cíclicos e barra `kanban-column-signal` / `kanban-card-topline` por fase. Falta a assinatura Operate de “A Central Silenciosa” — banner preto de estado-antes-ação, capacidade/limites da equipe, rastro de auditoria — o que torna a tela category-interchangeable se trocar os rótulos Bitrix.

**Deterministic scan**: Detector CLI (`detect.mjs --json`) nos três arquivos-alvo e no diretório da page: exit 0, **0 findings**. O scan mecânico está limpo; os problemas desta critique são de UX operacional, semântica de cor, prevenção de erro e feedback — fora do alcance das regras do detector. Nenhum falso positivo.

**Visual overlays**: Injeção de overlay **não disponível** nesta sessão (sem ferramenta de browser automation). Fallback: CLI detector only. Nenhum overlay [Human] foi produzido.

#### Overall Impression

Base sólida de produto (sync legível, Bitrix explícito, stale com texto+ícone, lote com progressive disclosure), mas o momento crítico — mudar fase ou transferir no Bitrix — ainda se comporta como Trello: fricção zero no lugar errado, sucesso silencioso e arco-íris de fases que dilui o roxo Focus. A maior oportunidade é transformar o move em governança perceptível (confirmação em S/F, toast com desfazer, cor rara) sem perder a densidade operacional.

#### What's Working

1. **Bitrix como destino explícito** — description da página, toast `kanban-moving` e CTA “Abrir no Bitrix24” no drawer reforçam “não somos o CRM”.
2. **Estado de sync legível** — `kanban-sync-control` com horário + countdown tabular antes de confiar no quadro.
3. **Stale não é só cor** — `kanban-stale` combina ícone + “N dias sem mover”; lote entra via progressive disclosure (`Transferir em lote` → toolbar).

#### Priority Issues

1. **[P0] Move/transferência Bitrix sem fricção de confirmação**
   - **What**: Drag entre colunas e botões “Transferir” (drawer/lote) commitam no Bitrix sem dialog/undo — inclusive estágios S/F.
   - **Why it matters**: Viola Error Prevention e “toda ação deixa rastro” perceptível; risco de ganho/perda acidental.
   - **Fix**: Confirmar mudanças para S/F (e opcionalmente qualquer fase); toast de sucesso com desfazer curto; distinguir warning de erro.
   - **Suggested command**: `$impeccable harden Comercial Geral kanban`

2. **[P1] Cores de estágio e sinal só-cromático**
   - **What**: `stageColors` cíclicos + `kanban-column-signal` / topline / badge de contagem tintidos.
   - **Why it matters**: Quebra a Regra da Cor Rara; status intermediário vira decoração; coluna diferenciada só por cor enfraquece WCAG.
   - **Fix**: Neutro nas fases P; roxo só em seleção/decisão; S/F nos tokens success/danger com rótulo (ponto + texto).
   - **Suggested command**: `$impeccable colorize comercial-kanban-board`

3. **[P1] Feedback de erro/sucesso confuso**
   - **What**: Sucesso silencioso; warning em `setError`; “Fechar” com `RotateCcw` em `kanban-error`.
   - **Why it matters**: Peak-end fraco; recuperação errada; líderes não confiam no resultado.
   - **Fix**: `aria-live` de sucesso (“Movido para {fase}”); warning visual distinto; Retry real vs dismiss com ícone X.
   - **Suggested command**: `$impeccable clarify kanban states`

4. **[P2] Densidade de scan operacional**
   - **What**: Cards com 6+ campos; colunas com scroll interno (~5 slots); Sync+Filtros competindo no header; resumo só “N negócios no período”.
   - **Why it matters**: Carga cognitiva alta (6 falhas no checklist) para líder varrendo filas o dia todo; falta estado de capacidade antes de transferir.
   - **Fix**: Resumo de fila (capacidade/stale por coluna); valor opcional no card; chips dos filtros ativos; altura alinhada ao viewport.
   - **Suggested command**: `$impeccable distill Comercial Geral`

5. **[P2] A11y de DnD e drawer**
   - **What**: Grip com `aria-label` mas sem instrução de teclado; drawer sem restaurar foco ao card; metas ~0.64rem no limite AA.
   - **Why it matters**: Teclado-only e leitores não fecham o loop Operate com segurança.
   - **Fix**: Menu “Mover para…” acessível; devolver foco; contraste/tamanho AA nos metas.
   - **Suggested command**: `$impeccable audit comercial-kanban-board`

#### Persona Red Flags

**Alex (Power User)** — Ação: arrastar negócio ou transferir em lote.
- KeyboardSensor existe, mas não há UI “Mover para fase…”; acelerador invisível.
- `max-height` do `kanban-column-body` força scroll por coluna; scan de dezenas de cards é lento.
- Valor só no drawer; comparar negócios exige abrir um a um.
- Sem undo após transfer/lote bem-sucedido.

**Sam (Accessibility)** — Mesma ação via teclado/leitor.
- `kanban-column-signal` é faixa só de cor (`aria-hidden`).
- Modo batch muda o significado do clique no título sem anúncio persistente.
- Sucesso de move sem live region (só o toast de “Atualizando…”).
- Metas `0.64rem` / sync `0.66rem` no limite de legibilidade AA.

**Líder comercial** (persona do produto) — Monitorar filas e rebalancear equipe.
- Sem estado de capacidade/limites antes de “Transferir em lote” (quebra “estado antes de ação”).
- Select de corretores é lista plana sem carga destacada.
- Resumo não mostra gargalo por fase/equipe.
- Filtro de equipe enterrado no drawer.

**Diretora/Admin** (persona do produto) — Auditar movimentações / KPIs.
- Nenhum rastro na UI de quem moveu/transferiu ou quando.
- Sync confirma Bitrix/Supabase, mas não há link a histórico/auditoria.
- Governança reduz-se a filtrar + olhar colunas — sem KPI de ciclo nesta superfície.

#### Minor Observations

- `kanban-card.is-selected` usa borda + `box-shadow` inset — tensiona “borda ou sombra”.
- Empty state: “O quadro ainda não está disponível” sem CTA Sync/Filtros.
- `kanban-summary` mistura métrica e microcopy de drag — dois jobs num strip.
- Contagem duplicada no header da coluna (`p` “N negócios” + `strong` pill).

#### Questions to Consider

1. Se Bitrix é o CRM, por que esta tela permite mudar fase com a mesma fricção de um Trello — e não só inspecionar + transferir com rastro?
2. O que um líder precisa ver em 3 segundos que “N negócios no período” não responde — capacidade por equipe ou envelhecimento por coluna?
3. A roleta roxa em *todo* card ainda é decisão, ou já virou decoração que dilui o roxo Focus?
4. Transferir em lote sem confirmar e sem undo é governança sem fricção — ou fricção zero no lugar errado?
5. Como seria o peak-end se o fim de um move fosse “Fase atualizada no Bitrix · Desfazer 8s” em vez do silêncio após o toast?

#### Cognitive Load (supporting)

- Failed checklist: Single focus, Chunking, Visual hierarchy, One thing at a time, Minimal choices, Working memory — **6 falhas = alta**.
- Decision points >4: drop targets = todas as colunas; selects de corretores; drawer de filtros (Diretoria/Equipe/Corretor/Roleta) + presets de período.
