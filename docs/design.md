---
name: Flow Focus
description: Central de operação comercial — branco no trabalho, preto na navegação e roxo nas decisões.
colors:
  background: "#FFFFFF"
  surface: "#FFFFFF"
  surface-raised: "#FFFFFF"
  surface-strong: "#F0F0F0"
  ink: "#1C1C1C"
  muted: "#5C5C5C"
  line: "#E2E2E2"
  primary: "#3C1048"
  primary-dark: "#1C1C1C"
  primary-hover: "#2D0C36"
  primary-soft: "#EADFED"
  accent: "#FFFFFF"
  border-strong: "#A98DB2"
  dark-hover: "#2B2130"
  dark-line: "#2F2A31"
  on-dark-muted: "#D4D4D4"
  success: "oklch(0.72 0.18 145)"
  success-soft: "oklch(0.95 0.04 145)"
  success-ink: "oklch(0.34 0.11 145)"
  warning: "oklch(0.66 0.17 65)"
  warning-soft: "oklch(0.96 0.035 75)"
  warning-ink: "oklch(0.4 0.11 60)"
  danger: "oklch(0.7 0.16 20)"
  danger-soft: "oklch(0.95 0.045 20)"
  danger-ink: "oklch(0.4 0.14 24)"
typography:
  display:
    fontFamily: "\"Plus Jakarta Sans\", system-ui, sans-serif"
    fontSize: "clamp(2rem, 3.4vw, 3.2rem)"
    fontWeight: 650
    lineHeight: 1.04
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "\"Plus Jakarta Sans\", system-ui, sans-serif"
    fontSize: "clamp(1.65rem, 2.4vw, 2.25rem)"
    fontWeight: 650
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  title:
    fontFamily: "\"Plus Jakarta Sans\", system-ui, sans-serif"
    fontSize: "1.15rem"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  body:
    fontFamily: "\"Plus Jakarta Sans\", system-ui, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: "\"Plus Jakarta Sans\", system-ui, sans-serif"
    fontSize: "0.7rem"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "0.11em"
rounded:
  sm: "10px"
  md: "14px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "42px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: "0 15px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "#2D0C36"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
  button-secondary:
    backgroundColor: "#FFFFFF"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: "0 15px"
    height: "40px"
  status-success:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success-ink}"
    rounded: "{rounded.pill}"
    padding: "5px 8px"
---

# Design System: Flow Focus

## 1. Overview

**Creative North Star: "A Central Silenciosa"**

Uma central de operações ao início da manhã: luz branca, superfícies diretas, navegação preta e roxo reservado para estado e decisão. O sistema prioriza leitura rápida de limites, bloqueios e filas — não impressiona, orienta. A estratégia cromática é **restrita**: identidade aparece na sidebar, no login e em poucos pontos de alta utilidade; o conteúdo operacional vive em branco e cinzas derivados.

Rejeita explicitamente o visual de SaaS genérico, painéis bancários opressivos, gamificação, glassmorphism, gradientes decorativos e grids de cards idênticos.

**Key Characteristics:**

- App shell com sidebar de 248px (82px colapsada) e navegação inferior no mobile
- Cor saturada apenas em navegação, banners de estado e badges — nunca como decoração
- Tabelas densas com fallback para listas estruturadas abaixo de 760px
- Borda **ou** sombra curta em painéis — nunca ambos no mesmo elemento
- Motion de 140–220ms só para feedback, drawers e mudança de estado

## 2. Colors

Paleta oficial preta, branca e roxa; semáforo discreto e independente para status.

### Primary

- **Roxo Focus** (`#3C1048`): botões primários, links de ação, seleção ativa e ícones de destaque.
- **Preto Operacional** (`#1C1C1C`): sidebar, header mobile, painel de login lateral, banner de limite diário e texto principal.
- **Roxo Suave** (`#EADFED`): fundos de destaque leve, pills informativas e badges info.

### Brand Accent

- **Branco Focus** (`#FFFFFF`): canvas principal, texto sobre fundos escuros, barras de progresso e contadores na navegação.

### Neutral

- **Branco** (`#FFFFFF`): fundo principal e cor de contraste sobre preto e roxo.
- **Superfície Clara** (`#FFFFFF`): painéis secundários, resumos de drawer e cabeçalhos de permissão.
- **Tinta** (`#1C1C1C`): texto principal e títulos.
- **Mudo** (`#5C5C5C`): texto secundário, labels de tabela e descrições — contraste ≥4,5:1 sobre branco.
- **Linha** (`#E2E2E2`): divisores, bordas de campo e separadores de lista.

### Status

- **Positivo** — verde vivo sobre verde suave para aprovações, capturas concluídas e estados saudáveis.
- **Alerta / Bronze** — laranja bronze sobre creme suave para pendências, quarentena e filas de auditoria.
- **Negativo** — coral sobre rosa suave para bloqueios, críticos, perdas, reprovações e erros.
- Texto usa sempre o token `*-ink` da mesma família; ícone, rótulo ou forma acompanha a cor para o estado nunca depender apenas do matiz.

### Named Rules

**A Regra da Cor Rara.** O acento saturado ocupa ≤10% de qualquer tela operacional. Sua escassez sinaliza estado — não marca presença de marca.

**A Regra do Preenchimento.** Botões e badges roxos usam texto branco. Fundos suaves de status usam texto escuro da mesma família cromática.

## 3. Typography

**Display / Headline / Body / Label:** `Plus Jakarta Sans`, system-ui, sans-serif — uma única família humanista em pesos 400–720, carregada via `next/font` em todo o produto.

**Character:** Operacional e legível; sem serifas, sem display extravagante. Confiança vem do peso e do espaçamento, não de ornamentos.

### Hierarchy

- **Display** (650, `clamp(2rem, 3.4vw, 3.2rem)`, 1.04): login e momentos de entrada — máximo `-0.04em` de tracking.
- **Headline** (650, `clamp(1.65rem, 2.4vw, 2.25rem)`, 1.12): títulos de página (`page-header h1`).
- **Title** (650, 1.15rem, 1.2): títulos de seção e cards de lista.
- **Body** (400, 0.78–0.95rem, 1.4–1.6): cópia, tabelas, formulários — máximo 70ch em parágrafos descritivos.
- **Label** (650–700, 0.63–0.78rem): cabeçalhos de tabela, microcopy de ambiente (`OPERACAO COMERCIAL` com tracking `0.11em`).

### Named Rules

**A Regra dos Numerais.** Métricas, limites, horários e posições de fila usam `font-variant-numeric: tabular-nums`.

**A Regra do Tracking.** Títulos usam `-0.025em` no dia a dia; display pode ir até `-0.04em` — nunca mais apertado.

## 4. Elevation

Sistema predominantemente **plano com camadas tonais**. Profundidade vem de contraste de superfície (`surface` vs `surface-strong` vs `background`) e bordas `line` — não de sombras empilhadas.

### Shadow Vocabulary

- **Sombra Curta** (`0 4px 8px rgb(28 28 28 / 0.10)`): toasts e elementos flutuantes pontuais.
- **Sombra de Drawer** (`-6px 0 12px rgb(28 28 28 / 0.18)`): painel lateral de auditoria.

### Named Rules

**A Regra da Borda ou Sombra.** Painéis, cards e botões secundários usam borda sólida **ou** sombra curta — nunca `border: 1px` + `box-shadow` largo no mesmo elemento.

**A Regra do Plano em Repouso.** Superfícies de conteúdo ficam planas; sombra aparece só em overlay, toast ou drawer.

## 5. Components

### Buttons

- **Shape:** cantos de 10px (`--radius-sm`), altura mínima 40px.
- **Primary:** fundo roxo Focus, texto branco, peso 650; hover escurece levemente e `translateY(-1px)`.
- **Secondary:** fundo branco, borda roxa suave, texto primary; hover com `primary-soft`.
- **Quiet / Danger:** variantes para ações terciárias e destrutivas.
- **Focus:** outline 3px `rgb(60 16 72 / 0.34)` com offset 2px.

### Status Badges

- **Style:** pill com ponto + rótulo; fundo soft da família semântica.
- **Variants:** success, warning, danger, neutral, info — sempre legíveis sem depender só da cor do ponto.

### Cards / Containers

- **Corner Style:** 14px (`--radius`) em painéis; 10px em banners e resumos.
- **Background:** branco ou `surface`; banner do corretor usa preto operacional.
- **Border:** `1px solid var(--line)` quando não há sombra.
- **Padding:** múltiplos de 8px; painéis principais 24–30px.

### Inputs / Fields

- **Style:** borda `line`, raio 9–10px, fundo branco.
- **Focus:** borda primary + halo `primary-soft` (3px).
- **Placeholder:** `#6D6256` — contraste ≥4,5:1.
- **Error:** banner `danger-soft` com texto escuro vermelho.

### Navigation

- **Sidebar:** 248px, fundo preto operacional, links com estado active em roxo Focus, contador branco em pill.
- **Mobile:** header fixo + bottom nav de 4 itens; badge de contagem em vermelho.
- **Collapsed (≤1080px):** sidebar 82px, só ícones.

### Broker Overview (assinatura)

Banner preto em grid 3 colunas: limite diário com barra branca, estado do ciclo com ícone roxo, CTA de captura. No mobile vira stack vertical.

### Audit Drawer

Painel lateral 570px max, slide-in 220ms, checklist de critérios com checkboxes customizados, footer com ações primária/secundária empilhadas no mobile.

### Empty States

Ícone primary, título ink, descrição muted com causa e próxima ação sugerida — nunca tela em branco sem orientação.

## 6. Do's and Don'ts

### Do:

- **Do** mostrar limite, bloqueio e pendências antes dos botões de captura ou auditoria.
- **Do** usar numerais tabulares em KPIs, filas e horários.
- **Do** converter tabelas em listas com `data-label` abaixo de 760px.
- **Do** respeitar `prefers-reduced-motion` removendo transições e animações.
- **Do** combinar ponto + texto em badges de status.

### Don't:

- **Don't** parecer template SaaS genérico, painel bancário opressivo ou CRM substituto.
- **Don't** usar glassmorphism, gradientes decorativos ou hero-metrics clichê.
- **Don't** empilhar cards idênticos com ícone + título + texto como estrutura padrão.
- **Don't** usar `border-left` colorido >1px como acento em listas ou alertas.
- **Don't** aplicar `border-radius` acima de 16px em painéis (pill em tags/botões é ok).
- **Don't** parear borda 1px com sombra difusa larga no mesmo componente.
- **Don't** esconder conteúdo atrás de animações de entrada — tudo visível por padrão.
