---
version: 1
slug: "app-app-configuracoes-localizacao-page-tsx"
primary_target: "app/(app)/configuracoes/localizacao/page.tsx"
related_targets: ["components/geofence-settings-form.tsx"]
---

Mode: Operate

Audience: administradores responsaveis pelo acesso territorial da operacao.
Job: definir com seguranca o ponto central e o raio que liberam o Flow Focus.
Primary task: capturar ou informar coordenadas, ajustar o raio, conferir a previa e salvar.
Content: configuracao ativa, origem do valor, coordenadas, raio, autor e momento da ultima alteracao.
Constraints: acesso exclusivo de admin; funcionar sem geo-sessao para permitir bootstrap e recuperacao; sem mapas externos; validacao server-side; responsivo e acessivel.
Direction: extensao direta da Central Silenciosa, com formulario marfim e um instrumento escuro de leitura do perimetro. Roxo permanece reservado para captura e salvamento.
Memorable moment: a leitura circular do raio responde aos valores do formulario e torna o limite territorial compreensivel antes de salvar.
