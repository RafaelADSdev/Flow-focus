"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { loginSchema } from "@/lib/schemas/auth";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const formData = new FormData(event.currentTarget);
    const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Revise os campos."); return; }
    setPending(true);
    if (!hasSupabaseEnv()) { await new Promise((resolve) => setTimeout(resolve, 650)); router.push("/corretor"); return; }
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword(parsed.data);
    if (authError) { setError("Não foi possível entrar. Confira e-mail e senha."); setPending(false); return; }
    router.push("/corretor"); router.refresh();
  }

  return <form className="login-form" onSubmit={onSubmit} noValidate>
    <div className="field"><label htmlFor="email">E-mail corporativo</label><input id="email" name="email" type="email" autoComplete="email" placeholder="nome@focus.com.br" defaultValue="lider@focus.com.br" /></div>
    <div className="field"><div className="label-row"><label htmlFor="password">Senha</label><button type="button" className="text-button">Esqueci minha senha</button></div><div className="password-field"><input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" defaultValue="flowfocus" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <button className="button button-primary login-submit" disabled={pending}>{pending ? <><LoaderCircle size={18} className="spin" />Entrando...</> : <>Entrar no Flow Focus<ArrowRight size={18} /></>}</button>
    {!hasSupabaseEnv() && <p className="demo-note">Modo demonstração: use os dados preenchidos para acessar.</p>}
  </form>;
}
