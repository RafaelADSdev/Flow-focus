"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, RefreshCw, Search, Trash2, UserPlus } from "lucide-react";
import { atualizarAcesso, criarAcesso, desativarAcesso, reativarAcesso, sincronizarEquipesBitrix } from "@/lib/actions/acesso";
import { appPageOptions, pageLabel, type VisiblePaginaAcesso } from "@/lib/auth/paginas-acesso";
import {
  defaultPaginasForPerfil,
  editarAcessoSchema,
  esteiraDashboardLabel,
  novoAcessoSchema,
  perfilLabels,
  type NovoAcessoInput,
} from "@/lib/schemas/acesso";
import type { AcessoListItem, EquipeOption } from "@/lib/types/acesso";
import { initials } from "@/lib/utils";
import { StatusBadge } from "./status-badge";

const perfilOptions = Object.entries(perfilLabels) as Array<[NovoAcessoInput["perfil"], string]>;

const emptyForm: NovoAcessoInput = {
  email: "",
  senha: "",
  perfil: "lider",
  esteira: "geral",
  equipeId: null,
  paginasAcesso: defaultPaginasForPerfil("lider"),
};

type AccessManagementPanelProps = {
  usuarios: AcessoListItem[];
  equipes: EquipeOption[];
  canManage: boolean;
  canSyncBitrix: boolean;
  loadError?: string | null;
};

export function AccessManagementPanel({
  usuarios,
  equipes,
  canManage,
  canSyncBitrix,
  loadError = null,
}: AccessManagementPanelProps) {
  const router = useRouter();
  const [form, setForm] = useState<NovoAcessoInput>(emptyForm);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [syncPending, startSyncTransition] = useTransition();
  const [syncNotice, setSyncNotice] = useState("");

  const filtered = useMemo(
    () => usuarios.filter((user) => [user.email, user.nome, user.equipeNome ?? ""].join(" ").toLowerCase().includes(query.toLowerCase())),
    [query, usuarios],
  );

  const needsTeam = form.perfil === "corretor" || form.perfil === "lider";
  const visiblePages = appPageOptions.filter((page) => (
    !("adminOnly" in page) || !page.adminOnly || form.perfil === "admin"
  ));

  function updateField<K extends keyof NovoAcessoInput>(key: K, value: NovoAcessoInput[K]) {
    setSaved(false);
    setError("");
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "perfil") {
        const perfil = value as NovoAcessoInput["perfil"];
        if (!["corretor", "lider"].includes(perfil)) {
          next.equipeId = null;
        }
        next.paginasAcesso = defaultPaginasForPerfil(perfil);
      }
      return next;
    });
  }

  function togglePage(href: VisiblePaginaAcesso) {
    if (href === "/corretor") return;
    setSaved(false);
    setError("");
    setForm((current) => {
      const selected = new Set(current.paginasAcesso);
      if (selected.has(href)) selected.delete(href);
      else selected.add(href);
      selected.add("/corretor");
      const nextPages = visiblePages.map((page) => page.href).filter((page) => selected.has(page));
      return {
        ...current,
        paginasAcesso: nextPages.length ? nextPages : defaultPaginasForPerfil(current.perfil),
      };
    });
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setError("");
    setSaved(false);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) {
      setError("Configure SUPABASE_SECRET_KEY no servidor para criar e editar acessos.");
      return;
    }

    startTransition(async () => {
      if (editingId) {
        const parsed = editarAcessoSchema.safeParse({ ...form, id: editingId });
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? "Revise os campos do formulário.");
          return;
        }
        const result = await atualizarAcesso(parsed.data);
        if (!result.ok) {
          setError(result.error);
          return;
        }
      } else {
        const parsed = novoAcessoSchema.safeParse(form);
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? "Revise os campos do formulário.");
          return;
        }
        const result = await criarAcesso(parsed.data);
        if (!result.ok) {
          setError(result.error);
          return;
        }
      }

      setSaved(true);
      resetForm();
      router.refresh();
      setTimeout(() => setSaved(false), 2400);
    });
  }

  function startEdit(user: AcessoListItem) {
    setEditingId(user.id);
    setSaved(false);
    setError("");
    setForm({
      email: user.email,
      senha: "",
      perfil: user.perfil,
      esteira: "geral",
      equipeId: user.equipeId,
      paginasAcesso: user.paginasAcesso,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function syncTeamsFromBitrix() {
    if (!canSyncBitrix) {
      setError("Configure SUPABASE_SECRET_KEY e BITRIX24_BASE_URL para sincronizar as equipes.");
      return;
    }

    startSyncTransition(async () => {
      setError("");
      setSaved(false);
      setSyncNotice("");

      const result = await sincronizarEquipesBitrix();
      if (!result.ok) {
        setError(result.error);
        return;
      }

      const { summary } = result;
      setSyncNotice(
        `Equipes sincronizadas: ${summary.usuariosAtivos} ativos no Bitrix, ${summary.contasCriadas} conta${summary.contasCriadas === 1 ? "" : "s"} nova${summary.contasCriadas === 1 ? "" : "s"}, ${summary.desativados} desativado${summary.desativados === 1 ? "" : "s"}.`,
      );
      router.refresh();
    });
  }

  function toggleAccess(user: AcessoListItem) {
    if (!canManage) {
      setError("Configure SUPABASE_SECRET_KEY no servidor para alterar acessos.");
      return;
    }

    startTransition(async () => {
      const result = user.ativo ? await desativarAcesso(user.id) : await reativarAcesso(user.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (editingId === user.id) resetForm();
      router.refresh();
    });
  }

  return (
    <div className="access-page">
      {saved ? (
        <div className="success-banner">
          <Check size={18} />
          Acesso salvo com sucesso.
          <button type="button" onClick={() => setSaved(false)} aria-label="Fechar aviso">
            ×
          </button>
        </div>
      ) : null}

      {syncNotice ? (
        <div className="success-banner" role="status">
          <Check size={18} />
          {syncNotice}
          <button type="button" onClick={() => setSyncNotice("")} aria-label="Fechar aviso">
            ×
          </button>
        </div>
      ) : null}

      {!canManage ? (
        <p className="form-error access-config-warning" role="status">
          A gestão de acesso exige `SUPABASE_SECRET_KEY` no `.env.local` para criar, editar e desativar usuários no Supabase Auth.
        </p>
      ) : null}

      {loadError ? (
        <p className="form-error access-config-warning" role="alert">
          Não foi possível carregar os acessos: {loadError}
        </p>
      ) : null}

      <section className="access-card">
        <div className="access-card-heading">
          <span className="access-card-icon" aria-hidden="true">
            <UserPlus size={18} />
          </span>
          <div>
            <h2>{editingId ? "Editar acesso" : "Novo acesso"}</h2>
            <p>Cria a conta no Supabase Auth e define visão, páginas, esteira e equipe. Na edição, informe uma nova senha apenas se quiser alterá-la.</p>
          </div>
        </div>

        <form className="access-form" onSubmit={onSubmit} noValidate>
          <div className="access-form-grid access-form-grid-2">
            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                placeholder="usuario@empresa.com"
                autoComplete="off"
                disabled={Boolean(editingId) || pending}
              />
            </div>
            <div className="field">
              <label htmlFor="senha">{editingId ? "Nova senha" : "Senha temporária"}</label>
              <input
                id="senha"
                name="senha"
                type="password"
                value={form.senha}
                onChange={(event) => updateField("senha", event.target.value)}
                placeholder={editingId ? "Deixe em branco para manter a atual" : "Mínimo 6 caracteres"}
                autoComplete="new-password"
                disabled={pending}
              />
              {editingId ? (
                <small className="field-hint">
                  Preencha somente se quiser redefinir a senha deste acesso. Mínimo de 6 caracteres.
                </small>
              ) : null}
            </div>
          </div>

          <div className="field access-profile-field">
            <label htmlFor="perfil">Visão</label>
            <select
              id="perfil"
              name="perfil"
              value={form.perfil}
              onChange={(event) => updateField("perfil", event.target.value as NovoAcessoInput["perfil"])}
              disabled={pending}
            >
              {perfilOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="field access-choice-fieldset">
            <legend>Páginas liberadas</legend>
            <p className="field-hint access-pages-hint">
              Minha carteira fica sempre liberada. Ao mudar a visão, as demais páginas voltam ao padrão: corretor só carteira; líder e diretora veem Roletas, Equipe e Auditorias; Configurações só admin.
            </p>
            <div className="access-choice-group">
              {visiblePages.map((page) => {
                const locked = page.href === "/corretor";
                const checked = locked || form.paginasAcesso.includes(page.href);
                return (
                  <label key={page.href} className={`access-choice-card${checked ? " is-checked" : ""}${locked ? " is-locked" : ""}`}>
                    <input
                      type="checkbox"
                      name="paginas"
                      value={page.href}
                      checked={checked}
                      onChange={() => togglePage(page.href)}
                      disabled={pending || locked}
                    />
                    <span className="access-choice-indicator checkbox" aria-hidden="true">
                      <Check size={11} strokeWidth={3} />
                    </span>
                    <span className="access-choice-label">{page.label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="field access-choice-fieldset">
            <legend>Esteira do dashboard</legend>
            <div className="access-choice-group">
              <label className="access-choice-card is-checked">
                <input type="radio" name="esteira" value="geral" checked readOnly />
                <span className="access-choice-indicator radio" aria-hidden="true" />
                <span className="access-choice-label">{esteiraDashboardLabel}</span>
              </label>
            </div>
          </fieldset>

          {needsTeam ? (
            <fieldset className="field access-choice-fieldset">
              <legend>Equipe</legend>
              {equipes.length ? (
                <div className="access-choice-group">
                  {equipes.map((equipe) => {
                    const checked = form.equipeId === equipe.id;
                    return (
                      <label key={equipe.id} className={`access-choice-card${checked ? " is-checked" : ""}`}>
                        <input
                          type="radio"
                          name="equipe"
                          value={equipe.id}
                          checked={checked}
                          onChange={() => updateField("equipeId", equipe.id)}
                          disabled={pending}
                        />
                        <span className="access-choice-indicator radio" aria-hidden="true" />
                        <span className="access-choice-label">{equipe.nome}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="field-hint">Nenhuma equipe sincronizada. Execute a sincronização do Bitrix antes de criar líderes e corretores.</p>
              )}
            </fieldset>
          ) : null}

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="access-form-actions">
            {editingId ? (
              <button type="button" className="button button-quiet" onClick={resetForm} disabled={pending}>
                Cancelar edição
              </button>
            ) : null}
            <button type="submit" className="button button-primary" disabled={pending || !canManage}>
              <UserPlus size={16} />
              {pending ? "Salvando..." : editingId ? "Salvar alterações" : "Criar acesso"}
            </button>
          </div>
        </form>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>Acessos cadastrados</h2>
            <p>Edite visão, páginas, equipe ou senha. Use a sincronização para refletir entradas e saídas das equipes no Bitrix24.</p>
          </div>
        </div>

        <div className="toolbar">
          <label className="search-box">
            <Search size={18} />
            <span className="sr-only">Buscar acesso</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por e-mail, nome ou equipe" />
          </label>
          <span className="toolbar-spacer" />
          <button
            type="button"
            className="button button-secondary"
            onClick={syncTeamsFromBitrix}
            disabled={!canSyncBitrix || syncPending || pending}
          >
            <RefreshCw size={16} className={syncPending ? "spin" : undefined} />
            {syncPending ? "Sincronizando..." : "Sincronizar equipes do Bitrix"}
          </button>
          <span className="access-count">{filtered.length} acessos</span>
        </div>

        <div className="access-table access-table-with-pages">
          <div className="access-head">
            <span>Usuário</span>
            <span>Visão</span>
            <span>Páginas</span>
            <span>Equipe</span>
            <span>Situação</span>
            <span>Ações</span>
          </div>
          {filtered.map((user) => (
            <div className="access-row" key={user.id}>
              <span className="broker-cell">
                <span className="avatar avatar-light">{initials(user.nome)}</span>
                <span>
                  <strong>{user.nome}</strong>
                  <small>{user.email}</small>
                </span>
              </span>
              <span>{perfilLabels[user.perfil]}</span>
              <span className="access-pages-cell">
                {user.paginasAcesso.map((href) => pageLabel(href)).join(", ")}
              </span>
              <span>
                <strong>{user.equipeNome ?? "Todas"}</strong>
              </span>
              <span>{user.ativo ? <StatusBadge tone="success">Ativo</StatusBadge> : <StatusBadge tone="neutral">Inativo</StatusBadge>}</span>
              <span className="access-actions">
                <button type="button" className="icon-button" onClick={() => startEdit(user)} aria-label={`Editar ${user.nome}`} disabled={pending}>
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => toggleAccess(user)}
                  aria-label={user.ativo ? `Desativar ${user.nome}` : `Reativar ${user.nome}`}
                  disabled={pending || !canManage}
                >
                  <Trash2 size={16} />
                </button>
              </span>
            </div>
          ))}
        </div>

        {!filtered.length ? (
          <div className="empty-state">
            <Search size={24} />
            <h2>Nenhum acesso encontrado</h2>
            <p>Tente outro termo de busca ou crie um novo acesso acima.</p>
            <button type="button" className="button button-secondary" onClick={() => setQuery("")}>
              Limpar busca
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
