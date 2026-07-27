---
target: login
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 1
timestamp: 2026-07-24T12-32-15Z
slug: app-login-page-tsx
---
# Critique — Login (`app/login/page.tsx`)

Method: dual-agent
Target: app/login/page.tsx (+ login-form)
Mode: Operate (auth gate)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Pending claro; sem validação por campo; pós-login sem feedback de papel |
| 2 | Match System / Real World | 3 | Linguagem Focus ok; ciclo real no aside |
| 3 | User Control and Freedom | 1 | "Esqueci minha senha" morto; sem recovery; destino fixo |
| 4 | Consistency and Standards | 2 | CTA morto quebra padrão; font DESIGN≠runtime; redirect único |
| 5 | Error Prevention | 2 | Prefill permanente de demo; noValidate; schema só no submit |
| 6 | Recognition Rather Than Recall | 3 | Labels bons; ciclo no aside reforça modelo mental |
| 7 | Flexibility and Efficiency | 2 | Autocomplete ok; sempre /corretor |
| 8 | Aesthetic and Minimalist Design | 2 | Forte visualmente, mas H1/marketing + chip competem com a tarefa |
| 9 | Error Recovery | 2 | Alert genérico; sem path de senha |
| 10 | Help and Documentation | 1 | Footer Bitrix; zero ajuda de bloqueio/senha |
| **Total** | | **21/40** | **Acceptable** |

## Design Specificity Verdict

**LLM:** Product-authored no desktop (split marfim/preto + órbita Captar→Trabalhar→Auditar→Liberar). Ainda carrega estrutura de categoria (split auth clássico, trust pill, H1 de marketing). Mobile perde o aside e fica bem mais intercambiável. Tipografia runtime (Plus Jakarta) diverge do DESIGN.md (Segoe/Aptos).

**Detector:** CLI em TSX limpo (0 findings). Browser com CSS vivo: 1 hit `hero-eyebrow-chip` em `.login-tag` ("Acesso seguro da Diretoria Focus"). Discrepância esperada — estilo do chip está em globals.css, fora do alvo CLI.

**Overlays:** Injeção sucedeu na sessão automatizada do Assessment B (não há aba [Human] nativa neste harness para o usuário ver overlay ao vivo).

## Overall Impression

Composição e cromática da Central Silenciosa funcionam; o gate Operate ainda compete com marketing e contém duas quebras de confiança (forgot morto + credenciais demo pré-preenchidas).

## What's Working

1. Split ivory/black materializa a identidade sem purple wallpaper.
2. Órbita do ciclo é o artefato mais product-authored da superfície.
3. Form enxuto: labels corporativos, toggle de senha com aria-label, pending com spinner, CTA claro.

## Priority Issues

### [P0] "Esqueci minha senha" sem handler
- **Why:** Quebra confiança no momento de maior risco.
- **Fix:** Remover até existir fluxo, ou ligar reset real.
- **Suggested command:** `/impeccable harden` ou `/impeccable clarify`

### [P0] Credenciais demo sempre em defaultValue
- **Why:** Em produção com Supabase ainda pré-preenche — anti-trust e risco operacional.
- **Fix:** Prefill só quando `!hasSupabaseEnv()`.
- **Suggested command:** `/impeccable harden`

### [P1] Redirect sempre para /corretor
- **Why:** Líder/diretora/admin caem no lugar errado.
- **Fix:** Destino por perfil / páginas de acesso.
- **Suggested command:** `/impeccable harden`

### [P2] Aside some no mobile (≤760px)
- **Why:** Perde âncora de marca/ciclo; página vira form genérico.
- **Fix:** Faixa compacta do ciclo ou quote curta acima do form.
- **Suggested command:** `/impeccable adapt`

### [P2] H1 de marketing + chip eyebrow competem com "Entrar"
- **Why:** Extraneous load no gate; detector confirma chip anti-pattern.
- **Fix:** Headline operacional; remover ou rebaixar `.login-tag`.
- **Suggested command:** `/impeccable distill` ou `/impeccable quieter`

## Persona Red Flags

- **Jordan:** Órbita+H1+quote sem "o que fazer agora"; forgot morto; prefill confunde modo.
- **Sam:** BrandMark em div+alt vazio frágil; erro não associado a campo; forgot focável sem ação.
- **Casey:** Aside sumido; H1 ainda grande em viewport estreita.
- **Camila (corretora Focus):** Prefill + trust pill cheiram a demo; dead forgot e redirect errado destroem "preciso e confiável".

## Cognitive Load

2 checklist failures (single focus; visual hierarchy) → **moderada**.

## Minor Observations

- `.login-panel > .brand` absolute sem `position: relative` no panel.
- Blockquote sem atribuição.
- DESIGN.md tipografia ≠ `--font-sans` Plus Jakarta.
- Quote/órbita: teatro de confiança vs quietude Operate.

## Questions to Consider

1. O login deve ensinar o ciclo, ou Camila só precisa de silêncio e "Entrar"?
2. Por que mostrar "Esqueci minha senha" se recovery não existe?
3. Se o aside some no mobile, o que resta que não poderia ser de outro produto?
4. Prefill de demo vale o custo de parecer staging?
