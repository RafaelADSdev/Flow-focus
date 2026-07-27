---
target: roletas
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-07-24T14-34-10Z
slug: app-app-roletas-page-tsx
---
Method: dual-agent (A: 97f4d1ca-5d82-4feb-ad2d-45262faf2f38 · B: d9c829d9-8cd9-4c53-9556-b3ec55ec826a)

#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Feedback de save existe; zero dirty state; sem contagem do que mudou |
| 2 | Match System / Real World | 3 | Vocabulário comercial ok; “roleta” assume domínio |
| 3 | User Control and Freedom | 2 | Sem descartar/reverter edits; refresh perde seleção |
| 4 | Consistency and Standards | 2 | Mobile não vira lista estruturada — fura regra DESIGN.md &lt;760px |
| 5 | Error Prevention | 1 | Toggle livre em Bloqueado; save manda toda a equipe sem diff |
| 6 | Recognition Rather Than Recall | 2 | Sem sticky em Corretor/head — scroll força memória |
| 7 | Flexibility and Efficiency | 1 | Sem bulk por linha/coluna/equipe; sem atalhos |
| 8 | Aesthetic and Minimalist Design | 3 | Plano e sem cards; `config-summary` repete o header |
| 9 | Error Recovery | 2 | Alerts e empties úteis; erros de infra vazam para o líder |
| 10 | Help and Documentation | 1 | Só microcopy do header — nada sobre revogar ou status vs permissão |
| **Total** | | **21/40** | **Acceptable** |

#### Design Specificity Verdict

**Start here.** Metade produto, metade categoria-intercambiável.

**LLM assessment**: Tokens e densidade honram “A Central Silenciosa” (marfim, roxo só em decisão, Plus Jakarta, StatusBadge). A composição — toolbar + matriz de checkboxes ACL — sobrevive se trocar “roleta/corretor” por “workspace/member”. O que ancora Focus é a cópia e o semáforo Liberado/Auditoria/Bloqueado, não a estrutura. Anti-referência “painel bancário denso” está perto demais (`min-width: 980px` sem fallback lista).

**Deterministic scan**: `detect.mjs --json` em `app/(app)/roletas/page.tsx` + `components/roulette-config.tsx` → exit 0, **0 findings**. O detector não pegou os gaps de UX (dirty/diff, sticky, mobile, status vs ação) — são falhas de interação/estado, não de padrões mecânicos no markup.

**Visual overlays**: Sem overlay confiável. Automação de browser não está exposta nesta sessão (só MCP Vercel/Supabase); live-server e injeção de `detect.js` foram pulados. Dev server em `http://localhost:3000/roletas` existe, mas não houve inspeção visual live.

#### Overall Impression

A tela entrega governança Operate com disciplina cromática certa, mas trata permissões de roleta como planilha ACL genérica. O maior gap: **estado operacional (bloqueio/auditoria) está desconectado da ação de marcar acesso**, e salvar não mostra o que mudou — alto risco numa decisão de equipe.

#### What's Working

1. **Roxo como decisão, não decoração** — checked state e CTA primário respeitam a Regra da Cor Rara.
2. **Empty states concretos** — sem roleta / sem corretor / filtros vazios com próximo passo (incl. sync Bitrix).
3. **Densidade Operate sem card soup** — grade + PageHeader alinhados à personalidade precisa do produto.

#### Priority Issues

1. **[P1] Estado desconectado da ação**
   - **What**: Badge Bloqueado/Auditoria é só display; checkboxes seguem editáveis.
   - **Why it matters**: Quebra “estado antes de ação”; líder pode “liberar roleta” a quem não captura.
   - **Fix**: Desabilitar toggles + texto inline “bloqueado — permissão não surte efeito até liberar”; ou fluxo “agendar acesso”.
   - **Suggested command**: `/impeccable clarify` (e `/impeccable harden` para o guardrail)

2. **[P1] Save sem diff / dirty / escape**
   - **What**: Save serializa todos os corretores; botão sempre ativo; sem discard.
   - **Why it matters**: Erro de um clique em equipe grande é silencioso e irreversível na UI.
   - **Fix**: Dirty detection, CTA “Salvar N alterações”, painel de diff, Cancelar/reverter.
   - **Suggested command**: `/impeccable harden`

3. **[P1] Matriz sem âncora no scroll**
   - **What**: Overflow horizontal; coluna Corretor e header não são sticky.
   - **Why it matters**: Após 3–4 roletas o líder marca célula sem saber de quem.
   - **Fix**: `position: sticky` na coluna corretor e no head.
   - **Suggested command**: `/impeccable layout`

4. **[P2] Zero aceleradores para líder**
   - **What**: Só toggle unitário; filtro acha, não configura.
   - **Why it matters**: 20×5 células = abandono ou erro em massa.
   - **Fix**: Marcar coluna, limpar linha, aplicar padrão da equipe.
   - **Suggested command**: `/impeccable distill` (repensar o modelo) ou `/impeccable harden` (bulk)

5. **[P2] Mobile fura o sistema**
   - **What**: Abaixo de 760px só ajusta margem; `min-width: 980px` permanece; alvos ~25×25.
   - **Why it matters**: DESIGN.md exige lista estruturada; pan horizontal com tap ruim.
   - **Fix**: Cards por corretor com switches; alvos ≥44px.
   - **Suggested command**: `/impeccable adapt`

#### Persona Red Flags

**Alex (Power User)**: Sem bulk/atalhos; save cego sem resumo; filtro esconde linhas mas save manda o mapa completo — risco de achar que salvava só o filtrado.

**Jordan (First-Timer)**: “Roleta” + badge Bloqueado ao lado de checkbox parece contraditório; summary não explica consequência de revogar; empty “Nenhuma roleta cadastrada” aponta para “banco”, não para quem resolve.

**Líder comercial Focus**: Fila reduzida a `{disponiveis} oportunidades` no head; sem agrupamento visual por equipe na grade; status operacional misturado com ACL sem hierarquia de decisão.

**Sam (a11y)**: Alvos 25×25; sucesso de save efêmero; input com `pointer-events: none` depende do label.

#### Minor Observations

- Borda unchecked hardcoded `#9b8b78` em vez de token `--line`.
- Ícone `SlidersHorizontal` decorativo no summary.
- Metadata title vs H1 levemente dissonantes.
- `gerado_em` no data nunca aparece — perde frescor do mapa.
- Carga cognitiva: **7/8 checklist failures → high**; matriz inteira como um único plano de decisão.

#### Questions to Consider

1. Se o trabalho do líder é governar acesso a filas, por que a UI é planilha ACL e não mapa “roleta → quem entra → pressão”?
2. E se corretor bloqueado nem aparecesse na matriz editável?
3. Salvar deveria ser o clímax (“3 corretores, 2 roletas”) ou continua botão genérico?
4. Com 8 roletas, a matriz ainda é “governança sem fricção” ou já é o anti-referência bancário?
5. No mobile, esta tela merece matriz — ou configuração profunda é desktop-only por decisão de produto?
