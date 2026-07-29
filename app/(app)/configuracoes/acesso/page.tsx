import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { AccessManagementPanel } from "@/components/access-management-panel";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getAcessoManagementData } from "@/lib/data/acesso";
import { hasBitrixEnv } from "@/lib/bitrix/client";
import { hasSupabaseSecretKey } from "@/lib/supabase/env";

export const metadata = { title: "Gestão de acesso" };

export default async function AccessManagementPage() {
  await requireAdmin();
  const data = await getAcessoManagementData();

  return (
    <div className="admin-page">
      <header className="admin-hero">
        <div className="admin-hero-copy">
          <span className="admin-eyebrow">Administração</span>
          <div className="admin-hero-title">
            <ShieldCheck size={24} strokeWidth={1.8} aria-hidden="true" />
            <h1>Gestão de acesso</h1>
          </div>
          <p>Crie, edite ou desative acessos. Ajuste a visão, a esteira e a equipe de cada usuário.</p>
        </div>
        <Link href="/configuracoes" className="button button-secondary admin-back">
          <ArrowLeft size={16} />
          Voltar às configurações
        </Link>
      </header>
      <AccessManagementPanel
        usuarios={data.usuarios}
        equipes={data.equipes}
        canManage={hasSupabaseSecretKey()}
        canSyncBitrix={hasSupabaseSecretKey() && hasBitrixEnv()}
        loadError={data.loadError}
      />
    </div>
  );
}
