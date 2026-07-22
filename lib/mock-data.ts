export const roletas = [
  { id: "geral", nome: "Comercial - GERAL", descricao: "Negocios perdidos com interesse recente", disponiveis: 48, tom: "violet" },
  { id: "bolsao", nome: "Bolsao", descricao: "Oportunidades antigas para reativacao", disponiveis: 126, tom: "teal" },
  { id: "lancamentos", nome: "Lancamentos", descricao: "Leads de empreendimentos em abertura", disponiveis: 21, tom: "amber" },
] as const;

export const oportunidades = [
  { id: "deal-9281", titulo: "Interesse no Horizonte Park", roleta: "Comercial - GERAL", captadaEm: "2026-07-22T12:18:00-03:00", valor: 680000, status: "Em contato" },
  { id: "deal-9214", titulo: "Apartamento 3 quartos - Centro", roleta: "Bolsao", captadaEm: "2026-07-22T11:42:00-03:00", valor: 540000, status: "Comentario pendente" },
  { id: "deal-9168", titulo: "Studio proximo a universidade", roleta: "Comercial - GERAL", captadaEm: "2026-07-21T16:25:00-03:00", valor: 310000, status: "Atualizado" },
] as const;

export const corretores = [
  { id: "ana", nome: "Ana Ribeiro", email: "ana.ribeiro@focus.com.br", equipe: "Equipe Jordao", roletas: ["geral", "bolsao"], capturados: 6, limite: 6, status: "auditoria" },
  { id: "bruno", nome: "Bruno Costa", email: "bruno.costa@focus.com.br", equipe: "Equipe Jordao", roletas: ["geral", "lancamentos"], capturados: 4, limite: 6, status: "liberado" },
  { id: "carla", nome: "Carla Mendes", email: "carla.mendes@focus.com.br", equipe: "Equipe Jordao", roletas: ["bolsao"], capturados: 6, limite: 6, status: "bloqueado" },
  { id: "diego", nome: "Diego Martins", email: "diego.martins@focus.com.br", equipe: "Equipe Jordao", roletas: ["geral", "bolsao", "lancamentos"], capturados: 2, limite: 6, status: "liberado" },
] as const;

export const auditoriasPendentes = [
  { id: "a1d8fbe0-2a84-4d79-9ba4-0356cac8e639", corretor: "Ana Ribeiro", iniciais: "AR", capturados: 6, atualizados: 5, semContato: 1, ultimaCaptura: "Hoje, 12:18", espera: "3h 24min", equipe: "Equipe Jordao" },
  { id: "e3bdf41a-b801-47c6-870a-f56b66c4882c", corretor: "Lucas Nascimento", iniciais: "LN", capturados: 6, atualizados: 6, semContato: 0, ultimaCaptura: "Ontem, 17:42", espera: "19h 08min", equipe: "Equipe Jordao" },
  { id: "9ac7fbdf-7a73-46f0-bd38-c8864273fc6c", corretor: "Marina Lopes", iniciais: "ML", capturados: 6, atualizados: 4, semContato: 2, ultimaCaptura: "Ontem, 15:06", espera: "21h 44min", equipe: "Equipe Jordao" },
] as const;

export const chartData = [
  { dia: "16 jul", captadas: 18, trabalhadas: 14 },
  { dia: "17 jul", captadas: 27, trabalhadas: 22 },
  { dia: "18 jul", captadas: 24, trabalhadas: 23 },
  { dia: "19 jul", captadas: 12, trabalhadas: 11 },
  { dia: "20 jul", captadas: 9, trabalhadas: 8 },
  { dia: "21 jul", captadas: 31, trabalhadas: 25 },
  { dia: "22 jul", captadas: 22, trabalhadas: 19 },
];
