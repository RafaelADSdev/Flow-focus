import type { PerfilUsuario } from "@/lib/database.types";

export function getTimeGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function greetingForName(nome: string, date = new Date()) {
  const firstName = nome.trim().split(/\s+/)[0] ?? nome;
  return `${getTimeGreeting(date)}, ${firstName}`;
}

const perfilLabels: Record<PerfilUsuario, string> = {
  corretor: "Corretor",
  lider: "Líder",
  diretora: "Diretora",
  admin: "Administrador",
};

export function formatUserRole(perfil: PerfilUsuario, equipeNome: string | null) {
  const role = perfilLabels[perfil];
  return equipeNome ? `${role} · ${equipeNome}` : role;
}
