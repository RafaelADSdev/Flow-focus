import type { PerfilUsuario } from "@/lib/database.types";

export function mapPerfil(value: string | null | undefined): PerfilUsuario {
  switch (value) {
    case "admin":
      return "admin";
    case "diretora":
    case "diretor":
      return "diretora";
    case "lider":
    case "leader":
      return "lider";
    default:
      return "corretor";
  }
}

export function canManageOperacao(perfil: PerfilUsuario | null) {
  return perfil === "lider" || perfil === "diretora" || perfil === "admin";
}

export function canViewResultados(perfil: PerfilUsuario | null) {
  return perfil === "admin" || perfil === "diretora";
}
