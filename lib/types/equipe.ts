export type BitrixTeamUser = {
  ID: string;
  NAME: string;
  LAST_NAME: string;
  fullName: string;
  photo: string | null;
  workPosition: string | null;
  email: string | null;
  departmentIds: number[];
  active: boolean;
  teamName: string | null;
};

export type TeamStageBucket = {
  stageId: string;
  name: string;
  count: number;
  criticos: number;
};

export type BrokerPipelineRow = {
  user: BitrixTeamUser;
  total: number;
  criticos: number;
  perdidos: number;
  ganhos: number;
  totalRelevante: number;
  expirando: number;
  stages: TeamStageBucket[];
};

export type TeamPipeline = {
  ok: boolean;
  error?: string;
  scopeLabel: string;
  categoryId: string;
  categoryName: string;
  departments: { id: number; name: string }[];
  teams: { id: number; name: string; count: number }[];
  members: BitrixTeamUser[];
  stages: { id: string; name: string }[];
  rows: BrokerPipelineRow[];
  totals: {
    totalDeals: number;
    criticos: number;
    stages: Record<string, number>;
    stageCriticos: Record<string, number>;
  };
  updatedAt: string;
};

export type ExpiringLead = {
  dealId: string;
  title: string;
  stageName: string | null;
  deadline: string | null;
  deadlineSource: "quarentena" | "padrao" | "criacao" | null;
  isQuarantine: boolean;
  msRemaining: number;
  daysStagnated: number;
  reason: "prazo" | "sem-movimentacao" | "prazo-e-sem-movimentacao";
  justification: string | null;
  sourceName: string | null;
  isDueRdStation: boolean;
  isRecentlyCreated: boolean;
};

export type ExpiringLeadsResult = {
  ok: boolean;
  error?: string;
  brokerId: string;
  items: ExpiringLead[];
  updatedAt: string;
};

export type BrokerExemption = {
  bitrix_id: string;
  broker_name: string;
  reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
