---
target: roletas
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-07-29T13-32-30Z
slug: app-app-roletas-page-tsx
---
Method: dual-agent (A: roletas_design_review · B: roletas_detector_browser)

## Design Health Score

| # | Heurística | Score | Questão-chave |
|---|---|---:|---|
| 1 | Visibilidade do status do sistema | 3/4 | Mudanças, salvamento e sync têm feedback; falta recibo persistente e histórico. |
| 2 | Correspondência sistema/mundo real | 3/4 | O vocabulário de roleta e auditoria é natural; “sync”, “category 36” e “Supabase” vazam implementação. |
| 3 | Controle e liberdade | 2/4 | Há descartar, Esc e `beforeunload`, mas sync e navegação interna podem apagar o rascunho; não existe undo pós-save. |
| 4 | Consistência e padrões | 3/4 | Tokens, badges e agrupamento são coesos; nome sublinhado abre modal e “Fechar” não conclui a operação. |
| 5 | Prevenção de erros | 1/4 | Replicação em massa não tem preview/confirmação e o sync permanece habilitado com alterações pendentes. |
| 6 | Reconhecimento em vez de lembrança | 2/4 | A lista mostra apenas “n de total”; é preciso abrir cada corretor para saber quais roletas estão liberadas. |
| 7 | Flexibilidade e eficiência | 2/4 | Busca, filtro e replicação ajudam; faltam origem explícita, revisão em lote e atalhos claros. |
| 8 | Estética e minimalismo | 3/4 | A linguagem é sóbria; a toolbar pode chegar a seis controles concorrentes e o cabeçalho não orienta. |
| 9 | Reconhecer, diagnosticar e recuperar erros | 2/4 | Erros de save preservam o estado, mas perda por refresh/sync não oferece recuperação. |
| 10 | Ajuda e documentação | 1/4 | Tooltips e instrução curta existem, mas não explicam impacto, alcance, histórico ou o modelo de salvamento. |
| **Total** |  | **22/40** | **Aceitável — melhorias importantes para uma governança confiável.** |

## Design Specificity Verdict

**Autoral, mas ainda parcialmente intercambiável.** A paleta marfim/preto/roxo, os estados “Bloqueado / Em auditoria / Liberado”, o agrupamento por equipe e a fila disponível dentro do modal ligam a superfície à “Central Silenciosa” e ao ciclo comercial. Porém, a estrutura principal ainda é uma tabela administrativa genérica de pessoa, equipe, contagem e status. Sem autoria, última alteração, resumo das roletas e impacto operacional na lista, ela perde a promessa mais singular do Flow Focus: toda ação relevante deixa rastro.

**Avaliação independente de design:** a fundação é disciplinada e legível, mas os momentos de maior risco — replicar, sincronizar e salvar — têm menos contexto e segurança do que a leitura cotidiana.

**Varredura determinística:** a execução única sobre `app/(app)/roletas/page.tsx` retornou `[]`, exit code 0 e zero achados. Isso não comprova que a implementação está limpa: o alvo é uma rota fina e o JSON não demonstrou travessia do componente importado `components/roulette-config.tsx`. Não houve falso positivo; houve limitação de cobertura.

**Overlays visuais:** não há overlay confiável. Em sessões novas de desktop e mobile, `/roletas` respondeu 307 e redirecionou para `/login`. A mutação de DOM funcionou no login, mas injetar o detector ali atribuiria evidências à superfície errada; por isso o live server e `detect.js` foram corretamente omitidos.

## Overall Impression

A superfície transmite calma e controle no estado de leitura. A grande oportunidade não é adicionar decoração: é tornar o commit de uma política de roletas tão verificável quanto a promessa de auditoria do produto. Hoje a experiência começa bem, atravessa um vale de confiança nas ações em massa e termina com uma confirmação efêmera.

### Carga cognitiva

**Moderada: 3 de 8 critérios falham.** Foco único, chunking, agrupamento, sequência no modal e divulgação progressiva funcionam. Falham hierarquia — cabeçalho sem descrição —, escolhas mínimas — até seis controles na toolbar — e memória de trabalho — fechar o modal não salva, e replicar depende de lembrar filtro e origem implícita. Com muitas roletas, o grid do modal também vira uma parede de opções sem busca ou agrupamento.

### Jornada emocional

- **Entrada:** sensação de controle; equipes e badges dão orientação rápida.
- **Exploração:** o modal melhora a confiança ao mostrar equipe, status, seleção e fila.
- **Vale:** “Replicar de [nome]” altera várias pessoas sem preview de alcance ou diferenças.
- **Compromisso:** “Fechar” apenas encerra o modal; o usuário ainda precisa perceber o rascunho e salvar fora dele.
- **Final:** “Alterações salvas” dura 3,2 segundos, sem autor, horário, resumo do lote ou caminho para revisão.

## What’s Working

1. **Estado antes da ação.** O status aparece antes da edição; bloqueados recebem fundo e badge, têm toggles desabilitados e explicação de consequência no modal.
2. **Boa governança local do rascunho.** A tela conta células e corretores alterados, habilita salvar só quando necessário, oferece descartar e usa `beforeunload`.
3. **Densidade progressiva.** A lista serve à varredura e o modal concentra as escolhas, com fila disponível, ações de marcar/limpar e alvos de 44px.

## Priority Issues

### [P1] Sincronizar pode apagar alterações pendentes

**Por que importa:** o botão de sync não é desabilitado quando `changeStats.dirty` é verdadeiro. O refresh muda o snapshot e repõe `baseline` e `selected` a partir do servidor; uma líder pode perder dezenas de ajustes sem confirmação.

**Correção:** bloquear sync enquanto houver rascunho ou abrir uma decisão explícita: “Salvar e sincronizar / Descartar e sincronizar / Cancelar”. Proteger também a navegação interna, não só `beforeunload`.

**Comando sugerido:** `$impeccable harden`.

### [P1] Replicação em massa tem origem implícita e alcance pouco claro

**Por que importa:** a origem é o primeiro corretor editável ordenado e a ação sobrescreve todos os corretores visíveis/liberados. O texto não informa total afetado, diferenças nem exceções; um filtro esquecido muda o alcance.

**Correção:** exigir escolha explícita do modelo, resumir “Aplicar 3 roletas de Ana a 12 corretores da Equipe X” e mostrar preview do diff, bloqueados e confirmação.

**Comando sugerido:** `$impeccable clarify`.

### [P1] A tela não entrega o rastro prometido pelo produto

**Por que importa:** salvar permissões é uma decisão de governança, mas o feedback some após 3,2 segundos. Não há autor, horário, resumo do lote, última alteração ou histórico acessível.

**Correção:** criar recibo persistente após salvar, exibir “última alteração por/em”, registrar alcance e origem das ações em massa e oferecer acesso ao histórico.

**Comando sugerido:** `$impeccable shape`.

### [P2] “Fechar” não explica o fluxo em dois estágios

**Por que importa:** os toggles mudam um rascunho; fechar o modal não conclui nem salva. Isso favorece a interpretação errada de que a operação terminou.

**Correção:** renomear para “Concluir seleção”, dizer que as mudanças ficarão pendentes e mostrar uma barra persistente de revisão/salvamento com resumo por corretor.

**Comando sugerido:** `$impeccable clarify`.

### [P2] O modal está incompleto para teclado e leitor de tela

**Por que importa:** não há foco inicial, trap ou restauração de foco. O handler ignora Esc quando o foco está em um checkbox, e “Clique nos quadrados” descreve aparência/gesto em vez da ação.

**Correção:** implementar foco inicial, trap e retorno ao gatilho; permitir Esc em qualquer foco quando não estiver salvando; trocar a copy por “Selecione as roletas”; anunciar mudanças pendentes em `aria-live`.

**Comando sugerido:** `$impeccable audit`.

## Persona Red Flags

**Alex — power user:** a configuração individual é rápida, mas equipes exigem modais repetidos. A ação em massa depende de filtro e origem automática; não há revisão “somente alterados”, atalhos documentados ou caminho de lote seguro.

**Sam — teclado/leitor de tela:** Esc falha no checkbox; o dialog não gerencia nem devolve foco; a instrução é visual (“clique nos quadrados”); a grade de quatro colunas não demonstra o fallback móvel em lista previsto no design system. Em compensação, os toggles têm alvo de 44px, nome acessível e foco visível; badges combinam ponto e texto.

**Marina — líder comercial:** não vê quais roletas compõem “2 de 4” sem abrir cada pessoa; pode replicar o modelo errado, perder o lote ao sincronizar e termina sem recibo durável da política aplicada.

**Helena — diretora/admin:** não encontra autoria, horário ou justificativa; não há preview de alterações em massa nem histórico; uma divergência operacional acaba investigada fora do Flow Focus.

## Minor Observations

- `PageHeader` é chamado sem descrição, embora o componente a exija; a página perde propósito e orientação no primeiro bloco.
- O nome sublinhado parece link, mas abre modal; uma indicação explícita de edição seria mais previsível.
- Empty states explicam causa e próximo passo, incluindo “Limpar filtros”.
- “sync de pessoas”, “category 36” e “Supabase” devem ficar em logs ou áreas técnicas.
- Muitas roletas aparecem em grid plano, sem busca, categoria ou ordenação explícita.
- O contêiner combina borda e sombra difusa, contrariando a regra “borda ou sombra” de `DESIGN.md`.
- Alterações concorrentes entre abas não têm conflito, versão ou aviso; o save envia todas as atribuições.

## Questions to Consider

1. Se uma líder alterou 20 corretores, qual recibo ela precisa para confiar que a política foi aplicada corretamente?
2. A replicação deve começar pela escolha consciente de um modelo, em vez de assumir o primeiro nome da lista?
3. O modal deveria concluir um rascunho ou salvar diretamente por corretor?
4. Quando sincronização e rascunho entram em conflito, a regra deve ser salvar primeiro, bloquear ou revisar o conflito?
