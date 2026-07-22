import type { PerfilUsuario } from "@/lib/database.types";

export type AppUser = {
  nome: string;
  perfil: PerfilUsuario;
  equipeNome: string | null;
  iniciais: string;
};
