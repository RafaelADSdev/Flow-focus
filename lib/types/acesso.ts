import type { PerfilUsuario } from "@/lib/database.types";
import type { PaginaAcesso } from "@/lib/auth/paginas-acesso";

export type EquipeOption = {
  id: string;
  nome: string;
};

export type AcessoListItem = {
  id: string;
  email: string;
  nome: string;
  perfil: PerfilUsuario;
  equipeId: string | null;
  equipeNome: string | null;
  bitrixUserId: string | null;
  paginasAcesso: PaginaAcesso[];
  ativo: boolean;
};

export type AcessoManagementData = {
  usuarios: AcessoListItem[];
  equipes: EquipeOption[];
  loadError: string | null;
};
