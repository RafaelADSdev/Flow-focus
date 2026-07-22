export type CarteiraRoleta = {
  id: string;
  nome: string;
  descricao: string;
  disponiveis: number;
};

export type CarteiraCaptura = {
  id: string;
  bitrix_deal_id: string;
  titulo: string;
  roleta: string;
  captada_em: string;
  valor: number;
  status: "disponivel" | "captada" | "em_trabalho" | "convertida" | "perdida";
};

export type CarteiraData = {
  nome: string;
  perfil: "corretor" | "lider" | "diretora" | "admin";
  capturados: number;
  limite: number;
  estado_ciclo: "captacao_liberada" | "auditoria_pendente" | "bloqueado";
  roletas: CarteiraRoleta[];
  capturas_recentes: CarteiraCaptura[];
  gerado_em: string;
};
