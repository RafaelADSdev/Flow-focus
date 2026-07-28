---
target: Visão geral
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-07-27T15-37-24Z
slug: app-app-dashboard-page-tsx
---
#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Período + badge numérico; `gerado_em` não aparece; sem chips dos filtros ativos |
| 2 | Match System / Real World | 2 | “Leads”/BI vs ciclo captar→auditar; fórmula “Recebidos − perdidos” |
| 3 | User Control and Freedom | 3 | Drawer com Escape/Limpar/restore de foco; sem desfazer pós-aplicar além de reabrir |
| 4 | Consistency and Standards | 2 | Nav “Visão geral” vs h1 “Visão geral comercial”; default 60d vs pills Hoje/7/30; KPIs em cards ≠ `kpi-strip` |
| 5 | Error Prevention | 3 | min/max datas; cascata diretoria→equipe→corretor; limpeza no apply |
| 6 | Recognition Rather Than Recall | 2 | Filtros ativos = só contagem; detalhe exige abrir drawer |
| 7 | Flexibility and Efficiency | 2 | Query URL ajuda; zero atalhos/vistas salvas; apply só via drawer |
| 8 | Aesthetic and Minimalist Design | 1 | 4 hero-KPIs tintidos + grade 2×2; gradientes decorativos; viola Regra da Cor Rara |
| 9 | Error Recovery | 2 | Empty por gráfico ok; falhas de sessão/permissão sem recovery na superfície |
| 10 | Help and Documentation | 1 | Só descrição do header; “passe o mouse…”; sem glossário nem próximo passo |
| **Total** | | **20/40** | **Acceptable** |

#### Design Specificity Verdict

**LLM assessment**: Composição category-intercambiável com verniz de domínio. O padrão `page-header` → 4× `overview-kpi-card` → grade 2×2 de `overview-chart-panel` é o clichê analytics que PRODUCT.md/DESIGN.md vetam (hero-metrics, grids de cards idênticos). Flow Focus aparece na cópia e nos dados (Comercial Geral, roleta, gargalo), não na assinatura visual da Central Silenciosa. Troque os rótulos por métricas SaaS genéricas e a UI permanece íntegra.

**Deterministic scan**: Detector CLI nos arquivos da page, filtros, charts e `page-header`, além do diretório `app/(app)/dashboard`: exit 0, **0 findings**. Problemas são de hierarquia Operate, especificidade de produto e ponte insight→ação — fora das regras mecânicas. Sem falsos positivos.

**Visual overlays**: Injeção **não disponível** (sem browser automation MCP). Scan de URL localhost bloqueado pelo Auto-review. Fallback: CLI detector only. Nenhum overlay [Human].

#### Overall Impression

Filtros e o insight de gargalo são craft sólido; o resto ainda é relatório de leads. A maior oportunidade é tornar a Visão Geral uma central de decisão: uma âncora operacional (estado do ciclo / gargalo), KPIs densos sem cards tintidos, e CTAs que levem ao Comercial Geral, Auditorias ou Roletas.

#### What's Working

1. **`DashboardFiltersPanel`** — drawer com Escape, restore de foco, presets, cascata e Limpar/Aplicar.
2. **Insight de gargalo** — quando há dados, é o momento mais “Flow Focus” da página.
3. **Base material** — marfim, `tabular-nums`, empties por gráfico em português, “Veja mais” na roleta.

#### Priority Issues

1. **[P1] Hero-metrics + grade 2×2 genérica**
   - **What**: `overview-kpi-grid` / cards tintidos + `overview-charts-grid` de painéis iguais.
   - **Why it matters**: Viola anti-referências e a Regra da Cor Rara; não parece Central Silenciosa.
   - **Fix**: Âncora de ciclo/gargalo; KPIs em faixa densa tipo `kpi-strip`; um gráfico primário + secundários sob disclosure.
   - **Suggested command**: `$impeccable distill Visão geral`

2. **[P1] Insight sem ponte para ação**
   - **What**: Página 100% observacional; gargalo/perdidos não levam a outras superfícies.
   - **Why it matters**: Operate deveria orientar o próximo passo do líder/diretora.
   - **Fix**: CTA contextual (“Abrir estágio gargalo no Comercial Geral”, “Ver pendências de auditoria”).
   - **Suggested command**: `$impeccable shape Visão geral → ação operacional`

3. **[P1] Filtros ativos só como número**
   - **What**: `overview-filters-badge` + período; dimensões ocultas até abrir o drawer.
   - **Why it matters**: Viola recognition; líder não valida o recorte antes de ler números.
   - **Fix**: Chips removíveis (equipe, corretor, roleta, período) fora do drawer.
   - **Suggested command**: `$impeccable clarify filtros da Visão geral`

4. **[P2] Charts hostis a teclado/leitor e mobile**
   - **What**: “Passe o mouse…”; tooltips Recharts; legenda some ≤760px; SVG sem alternativa tabular.
   - **Why it matters**: Sam perde séries; touch sem hover; cor vira canal único.
   - **Fix**: Sumário/tabela acessível; legendas sempre visíveis; remover dependência de hover.
   - **Suggested command**: `$impeccable audit Visão geral (charts a11y)`

5. **[P2] Frescor, vazio e defaults confusos**
   - **What**: `gerado_em` não renderizado; zeros = quatro empties; default 60d fora das pills.
   - **Why it matters**: Status opaco; empty sem orientação; preset mental ≠ realidade.
   - **Fix**: “Atualizado às…”; empty de página com causa+ação; alinhar default aos presets ou expor “60 dias”.
   - **Suggested command**: `$impeccable harden Visão geral`

#### Persona Red Flags

**Alex (Power User)** — Recortar e ler gargalo em &lt;60s: drawer obrigatório; 60 dias invisível nos pills; gargalo não clicável; hover na roleta é anti-power.

**Sam (Accessibility)** — Charts Recharts sem exposição de séries; “passe o mouse” exclui teclado; legendas somem no mobile; KPIs reforçam significado por cor; drawer sem focus trap explícito.

**Líder comercial** — Vê volume sem limite/bloqueio/fila; “estado antes de ação” ausente; sem atalho de equipe inchada → Roletas / Comercial Geral.

**Diretora/Admin** — `% do volume` em perdidos assusta sem ponte para auditoria; zero rastro de decisão; esteira estática “Comercial Geral” parece controle morto.

#### Minor Observations

- Kicker “Roletas com mais leads” redundante com o h2.
- `BAR_COLORS` e gradientes de área = decoração, não semântica.
- Ícones Inbox/TrendingDown/Activity/Building2 = assinatura de template KPI.
- Suspense só no trigger de Filtros; sem skeleton dos dados.
- Metadata “Visão geral” ≠ h1 “Visão geral comercial”.

#### Questions to Consider

1. Se o sucesso é o ciclo (captar → CRM → auditar → liberar), por que a Visão Geral otimiza volume de leads e não estado do ciclo?
2. Qual é a única decisão que esta página deve habilitar em 10 segundos — e qual elemento a carrega hoje?
3. Removendo os quatro `overview-kpi-card`, a página ainda comunica Flow Focus?
4. Por que três KPIs gritam semáforo enquanto o resto do app reserva cor rara?
5. O gargalo deveria ser um link de comando para o Comercial Geral?

#### Cognitive Load (supporting)

- Failed checklist: Single focus, Chunking, Visual hierarchy, One thing at a time, Minimal choices, Working memory (+ progressive disclosure parcial) — **~6 falhas = alta**.
- Decision points >4: drawer de filtros (pills + datas + dimensões + ações); 8 âncoras no viewport (4 KPIs + 4 charts) sem hierarquia.
