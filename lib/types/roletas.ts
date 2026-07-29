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

export type RoletasPermissionReceipt = {
  id: string | null;
  registradoEm: string;
  autorNome: string;
  corretoresAlterados: number;
  permissoesAlteradas: number;
  adicionadas: number;
  removidas: number;
};

export type RoletasConfigData = {
  equipe_nome: string;
  viewer_perfil: "corretor" | "lider" | "diretora" | "admin";
  roletas: RoletasConfigRoleta[];
  corretores: RoletasConfigCorretor[];
  gerado_em: string;
  ultimo_recibo: RoletasPermissionReceipt | null;
};
