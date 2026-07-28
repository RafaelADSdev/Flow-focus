---
version: 1
slug: "app-app-equipe-page-tsx"
primary_target: "app/(app)/equipe/page.tsx"
related_targets: ["components/team-dashboard.tsx","components/expiring-leads-dialog.tsx","components/team-stage-chart.tsx"]
---

Mode: Operate

Audience: liderança comercial, diretoria e administração durante a operação diária.
Job: localizar concentração por etapa e corretores com leads críticos sem duplicar o trabalho do CRM.
Primary task: filtrar escopo/status/mês, buscar corretor, ordenar por críticos, comparar a distribuição e abrir o detalhe de críticos do corretor.
Content: departamentos e deals do Bitrix24; críticos por prazo em Tentativa/Andamento ou 2+ dias sem movimentação; dispensados separados.
Constraints: autenticação e escopo pelo e-mail Bitrix; densidade legível; responsivo; Bitrix24 permanece o CRM.
Direction: composição fiel ao pacote equipe-export — cabeçalho, filtros, resumo, gráfico, grade de cards por corretor e modal centralizado. Cor restrita aos tokens Flow Focus (etapas neutras/roxo suave; críticos e perdidos em danger).
Memorable moment: seção Prioridade com top 3 críticos; gráfico compacto do card destaca etapas com críticos (`has-critical`); CTA abre modal agrupado por urgência.
