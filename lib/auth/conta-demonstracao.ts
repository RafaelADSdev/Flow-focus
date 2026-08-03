type ContaDemonstracaoRef = {
  nome?: string | null;
  email?: string | null;
};

/** Contas usadas em homologação não entram em métricas operacionais. */
export function isContaDemonstracao(user: ContaDemonstracaoRef) {
  const nome = String(user.nome ?? "").trim();
  const email = String(user.email ?? "").trim().toLowerCase();
  if (/\bteste\b/i.test(nome)) return true;
  if (/\bteste\b/i.test(email)) return true;
  if (email.startsWith("teste@") || email.startsWith("test@")) return true;
  return false;
}
