---
target: login
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
timestamp: 2026-07-24T12-47-01Z
slug: app-login-page-tsx
---
# Critique — Login (`app/login/page.tsx`)

Method: dual-agent
Target: app/login/page.tsx (+ login-form, login-orbit, brand-mark)
Mode: Operate (auth gate)
Prior: 21/40 → 26/40

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Pending + field alerts; sem feedback de papel pós-login |
| 2 | Match System / Real World | 3 | Ciclo Focus + Bitrix; “operação” um pouco abstrato |
| 3 | User Control and Freedom | 2 | Forgot morto removido; ainda sem recovery |
| 4 | Consistency and Standards | 3 | Tokens/CTA coerentes; font ≠ DESIGN.md |
| 5 | Error Prevention | 3 | Prefill só em demo; schema no submit |
| 6 | Recognition Rather Than Recall | 3 | Labels, placeholder, ciclo visível |
| 7 | Flexibility and Efficiency | 2 | Autocomplete + Enter; gate simples |
| 8 | Aesthetic and Minimalist Design | 3 | Chip e forgot fora; aside ainda dual-narrative |
| 9 | Error Recovery | 2 | Field errors bons; auth genérico; sem reset |
| 10 | Help and Documentation | 2 | Footer Bitrix; sem IT/bloqueio/senha |
| **Total** | | **26/40** | **Acceptable** |

## Design Specificity Verdict

**LLM:** Product-authored no desktop (ivory/black + órbita real Captar→Trabalhar→Auditar→Liberar). Estrutura ainda é split-auth de categoria, mas o ciclo Focus não é intercambiável. Mobile mitiga com `.login-cycle-strip`; perde o plano preto.

**Detector:** CLI 0 findings. Browser inject OK: `[impeccable] No anti-patterns found.` (eyebrow chip sumiu).

**Overlays:** Injeção na sessão automatizada do Assessment B; zero highlights (limpo). Sem aba [Human] nativa do harness.

## Overall Impression

Os P0 de confiança do critique anterior foram resolvidos. O gate está mais Operate e mais honesto. O que falta para “Good” é recovery/ajuda no erro e um pouco mais de autoridade Focus no mobile.

## What's Working

1. Órbita real com labels em pé — artefato mais product-authored.
2. Prefill só em demo; redirect `/` → firstAllowedPath; forgot morto removido.
3. Form com erros por campo, pending, CTA roxo claro.

## Priority Issues

### [P1] Sem caminho de recuperação de senha / bloqueio
- **Why:** Vale emocional sem saída quando a senha falha.
- **Fix:** Reset real ou copy estática (“Peça ao admin/TI Focus”).
- **Suggested command:** `/impeccable harden` ou `/impeccable clarify`

### [P2] Mobile perde aside preto (órbita + quote)
- **Why:** Strip recupera o ciclo, mas some a autoridade visual.
- **Fix:** Faixa escura curta com quote, ou órbita miniatura.
- **Suggested command:** `/impeccable adapt`

### [P2] Erro de auth sem próximo passo
- **Why:** Nomeia o problema, não o recovery.
- **Fix:** Acrescentar next step na mensagem.
- **Suggested command:** `/impeccable clarify`

### [P2] Tipografia runtime ≠ DESIGN.md
- **Why:** Plus Jakarta vs Segoe/Aptos.
- **Fix:** Alinhar token ou atualizar DESIGN.
- **Suggested command:** `/impeccable typeset` ou `/impeccable document`

### [P3] H1 display ainda compete com Entrar
- **Why:** Residual marketing load no gate.
- **Fix:** Rebaixar um degrau ou encurtar support.
- **Suggested command:** `/impeccable quieter` ou `/impeccable distill`

## Persona Red Flags

- **Jordan:** Trava no erro de senha sem “e agora?”.
- **Sam:** A11y do form boa; `noValidate` só no submit.
- **Casey:** Strip ajuda; aside some — menos Focus.
- **Camila:** Prefill/redirect ok; sem porta humana se esquecer a senha.

## Cognitive Load

2 falhas (single focus; hierarchy) → moderada.

## Minor Observations

- CSS órfão `.label-row` / `.text-button` do forgot.
- Ciclo duplicado DOM (strip + orbit).
- Hydration mismatch em `/login` no terminal (dev).

## Questions to Consider

1. Login deve ensinar o ciclo ou só Entrar?
2. Recovery ausente exige porta humana visível?
3. No mobile, strip roxa-suave basta sem o preto?
4. Órbita é confiança ou teatro num gate de 8s?

## Delta vs prior (21/40)

| Prior | Now |
|-------|-----|
| P0 forgot morto | Fixed |
| P0 prefill sempre | Fixed |
| P1 sempre /corretor | Fixed |
| P2 mobile aside | Mitigated (strip) |
| P2 H1 + chip | Mostly fixed (chip gone) |
