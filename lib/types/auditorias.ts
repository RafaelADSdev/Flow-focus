export type AuditoriaLeadItem = {
  id: string;
  bitrix_deal_id: string;
  titulo: string;
  captada_em: string;
  etapa_atual: string;
  ultima_atualizacao: string | null;
  tentativa_contato_ok: boolean;
  comentario_bitrix_ok: boolean;
  etapa_atualizada_ok: boolean;
};

export type AuditoriaFilaItem = {
  id: string;
  corretor_id: string;
  corretor: string;
  equipe: string;
  capturados: number;
  atualizados: number;
  sem_contato: number;
  ultima_captura: string | null;
  espera_minutos: number;
  leads: AuditoriaLeadItem[];
};

export type AuditoriasPainelData = {
  aguardando: number;
  aprovadas_semana: number;
  bloqueados: number;
  tempo_medio_horas: number;
  tempo_medio_variacao_min: number;
  fila: AuditoriaFilaItem[];
  gerado_em: string;
};
