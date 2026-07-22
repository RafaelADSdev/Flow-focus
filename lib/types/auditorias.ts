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
