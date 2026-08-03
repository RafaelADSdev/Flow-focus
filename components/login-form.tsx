"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { loginSchema } from "@/lib/schemas/auth";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/client";

const isDemo = !hasSupabaseEnv();

const AUTH_ERROR =
  "Não foi possível entrar. Confira e-mail e senha. Se não lembrar a senha, peça o reset ao administrador ou à TI da Diretoria Focus.";

export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setEmailError("");
    setPasswordError("");

    const formData = new FormData(event.currentTarget);
    const parsed = loginSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === "email") setEmailError(issue.message);
        if (issue.path[0] === "password") setPasswordError(issue.message);
      }
      return;
    }

    setPending(true);

    if (isDemo) {
      await new Promise((resolve) => setTimeout(resolve, 650));
      router.replace("/corretor");
      return;
    }

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword(parsed.data);
    if (authError) {
      setError(AUTH_ERROR);
      setPending(false);
      return;
    }

    router.replace("/corretor");
    router.refresh();
  }

  return (
    <form className="login-form" onSubmit={onSubmit} noValidate aria-busy={pending}>
      <div className="field">
        <label htmlFor="email">E-mail de acesso ao Bitrix24</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="nome@focus.com.br"
          defaultValue={isDemo ? "lider@focus.com.br" : undefined}
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? "email-error" : undefined}
          disabled={pending}
        />
        {emailError ? (
          <p id="email-error" className="field-error" role="alert">
            {emailError}
          </p>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="password">Senha</label>
        <div className="password-field">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            defaultValue={isDemo ? "flowfocus" : undefined}
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={
              [passwordError ? "password-error" : null, "password-hint", "login-help"]
                .filter(Boolean)
                .join(" ") || undefined
            }
            disabled={pending}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            disabled={pending}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <small id="password-hint" className="field-hint">
          Utilize seu ID do Bitrix24 com 6 dígitos, completando com zeros à esquerda. Exemplo: se seu ID é
          1327, a senha é 001327.
        </small>
        {passwordError ? (
          <p id="password-error" className="field-error" role="alert">
            {passwordError}
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <button className="button button-primary login-submit" disabled={pending}>
        {pending ? (
          <>
            <LoaderCircle size={18} className="spin" />
            Entrando...
          </>
        ) : (
          <>
            Entrar no Flow Focus
            <ArrowRight size={18} />
          </>
        )}
      </button>

      <p id="login-help" className="login-help">
        Esqueceu a senha ou ficou bloqueado? Peça o reset ao administrador ou à TI da Diretoria Focus.
      </p>

      {isDemo ? (
        <p className="demo-note">Modo demonstração: use os dados preenchidos para acessar.</p>
      ) : null}
    </form>
  );
}
