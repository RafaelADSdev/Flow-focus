---
name: Flow Focus
description: Central de operação comercial — superfícies claras, indigo profundo na navegação, cor reservada para estado e decisão.
colors:
  background: "oklch(1 0 0)"
  surface: "oklch(0.975 0.006 268.5)"
  surface-strong: "oklch(0.94 0.012 268.5)"
  ink: "oklch(0.22 0.025 268.5)"
  muted: "oklch(0.47 0.025 268.5)"
  line: "oklch(0.9 0.012 268.5)"
  primary: "oklch(0.43 0.15 268.5)"
  primary-dark: "oklch(0.24 0.075 268.5)"
  primary-soft: "oklch(0.93 0.035 268.5)"
  accent: "oklch(0.77 0.15 175)"
  success: "oklch(0.55 0.13 155)"
  success-soft: "oklch(0.94 0.04 155)"
  warning: "oklch(0.67 0.14 75)"
  warning-soft: "oklch(0.95 0.04 75)"
  danger: "oklch(0.56 0.19 28)"
  danger-soft: "oklch(0.95 0.035 28)"
typography:
  display:
    fontFamily: "\"Segoe UI Variable\", \"Aptos\", \"Segoe UI\", sans-serif"
    fontSize: "clamp(2rem, 3.4vw, 3.2rem)"
    fontWeight: 650
    lineHeight: 1.04
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "\"Segoe UI Variable\", \"Aptos\", \"Segoe UI\", sans-serif"
    fontSize: "clamp(1.65rem, 2.4vw, 2.25rem)"
    fontWeight: 650
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  title:
    fontFamily: "\"Segoe UI Variable\", \"Aptos\", \"Segoe UI\", sans-serif"
    fontSize: "1.15rem"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  body:
    fontFamily: "\"Segoe UI Variable\", \"Aptos\", \"Segoe UI\", sans-serif"
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: "\"Segoe UI Variable\", \"Aptos\", \"Segoe UI\", sans-serif"
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
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "0 15px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "oklch(0.38 0.15 268.5)"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
  button-secondary:
    backgroundColor: "#ffffff"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: "0 15px"
    height: "40px"
  status-success:
    backgroundColor: "{colors.success-soft}"
    textColor: "oklch(0.36 0.12 155)"
    rounded: "{rounded.pill}"
    padding: "5px 8px"
---

# Design System: Flow Focus

## 1. Overview

**Creative North Star: "A Central Silenciosa"**

Uma central de operações ao início da manhã: luz clara, superfícies diretas, navegação em indigo profundo e cor reservada para estado e decisão. O sistema prioriza leitura rápida de limites, bloqueios e filas — não impressiona, orienta. A estratégia cromática é **restrita**: identidade aparece na sidebar, no login e em poucos pontos de alta utilidade; o conteúdo operacional vive em branco e cinzas tintados de índigo.

Rejeita explicitamente o visual de SaaS genérico, painéis bancários opressivos, gamificação, glassmorphism, gradientes decorativos e grids de cards idênticos.

**Key Characteristics:**

- App shell com sidebar de 248px (82px colapsada) e navegação inferior no mobile
- Cor saturada apenas em navegação, banners de estado e badges — nunca como decoração
- Tabelas densas com fallback para listas estruturadas abaixo de 760px
- Borda **ou** sombra curta em painéis — nunca ambos no mesmo elemento
- Motion de 140–220ms só para feedback, drawers e mudança de estado

## 2. Colors

Paleta índigo-operacional com acento teal para contadores e progresso; semáforo discreto para status.

### Primary

- **Índigo Operacional** (`oklch(0.43 0.15 268.5)`): botões primários, links de ação, ícones de destaque em listas.
- **Índigo Profundo** (`oklch(0.24 0.075 268.5)`): sidebar, header mobile, painel de login lateral, banner de limite diário do corretor.
- **Índigo Suave** (`oklch(0.93 0.035 268.5)`): fundos de destaque leve, pills informativas, badges info.

### Tertiary

- **Teal de Progresso** (`oklch(0.77 0.15 175)`): barras de progresso, contadores na navegação, pontos de ênfase em ciclos ativos.

### Neutral

- **Branco Puro** (`oklch(1 0 0)`): fundo principal e superfícies de trabalho.
- **Superfície** (`oklch(0.975 0.006 268.5)`): painéis secundários, resumos de drawer, cabeçalhos de permissão.
- **Tinta** (`oklch(0.22 0.025 268.5)`): texto principal e títulos.
- **Mudo** (`oklch(0.47 0.025 268.5)`): texto secundário, labels de tabela, descrições — contraste ≥4,5:1 sobre branco.
- **Linha** (`oklch(0.9 0.012 268.5)`): divisores, bordas de campo e separadores de lista.

### Status

- **Sucesso** / **Sucesso Suave** — aprovações, capturas concluídas.
- **Alerta** / **Alerta Suave** — pendências, filas de auditoria.
- **Perigo** / **Perigo Suave** — bloqueios, reprovações, erros de formulário.

### Named Rules

**A Regra da Cor Rara.** O acento saturado ocupa ≤10% de qualquer tela operacional. Sua escassez sinaliza estado — não marca presença de marca.

**A Regra do Preenchimento.** Botões e badges saturados usam texto branco. Fundos suaves de status usam texto escuro da mesma família cromática.

## 3. Typography

**Display / Headline / Body / Label:** `Segoe UI Variable`, `Aptos`, `Segoe UI`, sans-serif — uma única família humanista de sistema em pesos 400–720.

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

- **Sombra Curta** (`0 4px 8px oklch(0.2 0.03 268.5 / 0.08)`): toasts e elementos flutuantes pontuais.
- **Sombra de Drawer** (`-6px 0 12px oklch(0.15 0.03 268.5 / 0.16)`): painel lateral de auditoria.

### Named Rules

**A Regra da Borda ou Sombra.** Painéis, cards e botões secundários usam borda sólida **ou** sombra curta — nunca `border: 1px` + `box-shadow` largo no mesmo elemento.

**A Regra do Plano em Repouso.** Superfícies de conteúdo ficam planas; sombra aparece só em overlay, toast ou drawer.

## 5. Components

### Buttons

- **Shape:** cantos de 10px (`--radius-sm`), altura mínima 40px.
- **Primary:** fundo índigo operacional, texto branco, peso 650; hover escurece levemente e `translateY(-1px)`.
- **Secondary:** fundo branco, borda índigo clara, texto primary; hover com `primary-soft`.
- **Quiet / Danger:** variantes para ações terciárias e destrutivas.
- **Focus:** outline 3px `oklch(0.74 0.13 268.5 / 0.5)` com offset 2px.

### Status Badges

- **Style:** pill com ponto + rótulo; fundo soft da família semântica.
- **Variants:** success, warning, danger, neutral, info — sempre legíveis sem depender só da cor do ponto.

### Cards / Containers

- **Corner Style:** 14px (`--radius`) em painéis; 10px em banners e resumos.
- **Background:** branco ou `surface`; banner do corretor usa `primary-dark`.
- **Border:** `1px solid var(--line)` quando não há sombra.
- **Padding:** múltiplos de 8px; painéis principais 24–30px.

### Inputs / Fields

- **Style:** borda `line`, raio 9–10px, fundo branco.
- **Focus:** borda primary + halo `primary-soft` (3px).
- **Placeholder:** `oklch(0.5 0.02 268.5)` — contraste ≥4,5:1.
- **Error:** banner `danger-soft` com texto escuro vermelho.

### Navigation

- **Sidebar:** 248px, fundo `primary-dark`, links com estado active em índigo médio, contador teal em pill.
- **Mobile:** header fixo + bottom nav de 4 itens; badge de contagem em vermelho.
- **Collapsed (≤1080px):** sidebar 82px, só ícones.

### Broker Overview (assinatura)

Banner escuro em grid 3 colunas: limite diário com barra teal, estado do ciclo com ícone circular, CTA de captura. No mobile vira stack vertical.

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
