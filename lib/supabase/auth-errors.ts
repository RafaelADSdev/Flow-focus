export function authErrorMessage(message: string, fallback = "Não foi possível atualizar o acesso no Supabase Auth.") {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("invalid jwt")
    || normalized.includes("token is unverifiable")
    || normalized.includes("jwt kid")
    || normalized.includes("not_admin")
  ) {
    return "Sua sessão de administração expirou ou ficou inconsistente. Saia, entre novamente e repita a operação.";
  }
  if (normalized.includes("password") && (normalized.includes("weak") || normalized.includes("least"))) {
    return "A senha não atende aos requisitos de segurança configurados no Supabase.";
  }
  return fallback;
}
