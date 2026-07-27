---
target: minha carteira
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-07-24T13-53-23Z
slug: app-app-corretor-page-tsx
---
# Critique — Minha carteira (`app/(app)/corretor/page.tsx`)

Method: dual-agent
Target: Minha carteira / BrokerPanel
Mode: Operate
Note: Browser landed on /login (unauthenticated); CLI scan of corretor TSX was clean. Scores from Assessment A (source + CSS).

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | CTA “Limite atingido” para auditoria/bloqueio |
| 2 | Match System / Real World | 3 | Linguagem Focus/Bitrix; Sparkles leve |
| 3 | User Control and Freedom | 2 | Histórico morto; sem undo |
| 4 | Consistency and Standards | 3 | Captar secondary vs decisão roxa |
| 5 | Error Prevention | 3 | Disable por limite/ciclo/fila ok |
| 6 | Recognition Rather Than Recall | 3 | Contagens ok; falta deep-link Bitrix |
| 7 | Flexibility and Efficiency | 2 | Uma captura/clique; sem atalhos |
| 8 | Aesthetic and Minimalist Design | 3 | Densidade boa; ruído Sparkles |
| 9 | Error Recovery | 2 | Erro claro; pouco next step no bloqueio |
| 10 | Help and Documentation | 2 | Sem “por que estou bloqueado?” no CTA |
| **Total** | | **25/40** | **Acceptable** |

## Design Specificity Verdict

**LLM:** Product-authored — overview preto com limite/ciclo antes de captar; listas densas; Bitrix no discurso. Não é dashboard SaaS genérico. Vazamentos: Sparkles/tons rotativos; Captar sem roxo de decisão.

**Detector:** CLI 0 findings nos TSX da carteira. Browser inject OK mas redirecionou para /login; único live hit `tiny-text` no login (fora de escopo).

**Overlays:** Sessão automatizada; sem overlay útil da superfície autenticada.

## Overall Impression

O overview cumpre “estado antes de ação”. A maior quebra de confiança é o CTA que diz “Limite atingido” quando o ciclo é auditoria/bloqueio — Camila lê o dia errado.

## What's Working

1. `.broker-overview` materializa limite + ciclo antes de Captar.
2. Densidade Operate (roulette rows + tabela) sem card-bloat.
3. Copy aponta Bitrix como CRM.

## Priority Issues

### [P1] CTA mentiroso (“Limite atingido” ≠ auditoria/bloqueio)
- Fix: rótulos distintos por estado.
- Suggested: `/impeccable clarify`

### [P1] `.cycle-state` sem severidade visual
- Fix: ícone/tom por estado (liberada / auditoria / bloqueado).
- Suggested: `/impeccable colorize` ou `clarify`

### [P1] “Ver histórico completo” morto
- Fix: remover ou ligar rota real.
- Suggested: `/impeccable harden` ou `clarify`

### [P2] Captar em button-secondary (decisão sem roxo)
- Fix: primary quando liberado e há fila.
- Suggested: `/impeccable layout` ou `polish`

### [P2] Pós-captura / bridge Bitrix fracos
- Fix: banner com título + deep-link; ação por linha.
- Suggested: `/impeccable harden` ou `delight`

## Persona Red Flags

- **Camila:** overview bom; CTA mentiroso quebra confiança no bloqueio.
- **Alex:** histórico morto; 1 captura/clique.
- **Sam:** progresso sem progressbar; tabela não semântica.
- **Casey:** Captar full-width ok; contagem desalinhada no mobile.

## Cognitive Load

2 falhas (hierarchy; progressive disclosure) → moderada. Risco se N>4 roletas.

## Minor Observations

- Tons de roleta por índice, não por identidade.
- Auto-sync engole erro.
- Empty states com h2 competem com page header.

## Questions to Consider

1. Captar deveria ser o elemento mais roxo da página?
2. Sistema recomenda próxima fila ou corretor escolhe entre N?
3. Pós-captura empurra para Bitrix ou só registra?
4. Bloqueio e limite merecem o mesmo cadeado?
