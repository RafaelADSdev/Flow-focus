import type { PerfilUsuario } from "@/lib/database.types";
import type { PaginaAcesso } from "@/lib/auth/paginas-acesso";

export type AppUser = {
  nome: string;
  perfil: PerfilUsuario;
  equipeNome: string | null;
  iniciais: string;
  paginasAcesso: PaginaAcesso[];
};
