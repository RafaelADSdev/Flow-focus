# Flow Focus — Agent Context

## Design Context

Este projeto usa o Impeccable para decisões de design. Antes de qualquer trabalho visual, leia:

- **[PRODUCT.md](./PRODUCT.md)** — register `product`, usuários (corretor, líder, diretora, admin), propósito, personalidade, anti-referências e princípios estratégicos.
- **[DESIGN.md](./DESIGN.md)** — tokens OKLCH, tipografia, componentes e regras visuais (Creative North Star: **A Central Silenciosa**).
- **[.impeccable/design.json](./.impeccable/design.json)** — sidecar com ramps, motion, breakpoints e snippets de componentes para live mode.

### Princípios que guiam toda interface

1. Estado antes de ação — limites e bloqueios visíveis antes de capturar ou auditar.
2. Governança sem fricção — permissões complexas como escolhas simples.
3. Bitrix24 é o CRM; Flow Focus organiza ciclo e auditoria.
4. Toda ação relevante deixa rastro compreensível.
5. Densidade legível para um dia inteiro de operação.

### Stack

Next.js 16 (App Router) · Supabase · TanStack Query · CSS global em `app/globals.css` (sem Tailwind).

### Comandos Impeccable úteis

- `$impeccable craft <feature>` — construir feature end-to-end
- `$impeccable critique <surface>` — revisão UX com score
- `$impeccable polish <component>` — passagem final antes de ship
- `$impeccable live` — variantes visuais no browser (config em `.impeccable/live/config.json`)
