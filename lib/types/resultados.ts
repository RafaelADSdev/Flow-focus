export type ResultadoBucket = "total" | "andamento" | "vendas" | "perdidos" | "retornaram" | "quarentena";

export type ResultadoLead = {
  id: string;
  bitrixDealId: string;
  cliente: string;
  corretorId: string;
  corretor: string;
  equipe: string;
  captadaEm: string;
  etapaAtual: string;
  ultimaAtualizacao: string | null;
  situacao: string;
  bucket: Exclude<ResultadoBucket, "total">;
};

export type ResultadoCapturaEquipe = {
  equipeId: string;
  equipe: string;
  total: number;
};

export type ResultadoTopCorretor = {
  corretorId: string;
  corretor: string;
  equipe: string;
  total: number;
};

export type ResultadosData = {
  indicadores: Record<ResultadoBucket, number>;
  leads: ResultadoLead[];
  capturasPorEquipe: ResultadoCapturaEquipe[];
  topCorretores: ResultadoTopCorretor[];
  geradoEm: string;
};
