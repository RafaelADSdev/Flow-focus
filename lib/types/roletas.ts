export type RoletasConfigRoleta = {
  id: string;
  nome: string;
  disponiveis: number;
};

export type RoletasConfigCorretor = {
  id: string;
  nome: string;
  email: string;
  equipeNome: string | null;
  roletas: string[];
  status: "liberado" | "auditoria" | "bloqueado";
};

export type RoletasConfigData = {
  equipe_nome: string;
  roletas: RoletasConfigRoleta[];
  corretores: RoletasConfigCorretor[];
  gerado_em: string;
};
