export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type PerfilUsuario = "corretor" | "lider" | "diretora" | "admin";
export type StatusOportunidade = "disponivel" | "captada" | "em_trabalho" | "convertida" | "perdida";
export type StatusAuditoria = "pendente" | "aprovado" | "reprovado";

export type Database = {
  public: {
    Tables: {
      usuarios: {
        Row: { id: string; nome: string; email: string; perfil: PerfilUsuario; equipe_id: string | null; equipe_nome: string | null; bitrix_user_id: string | null; bitrix_department_id: string | null; ativo: boolean; criado_em: string; atualizado_em: string };
        Insert: { id: string; nome: string; email: string; perfil?: PerfilUsuario; equipe_id?: string | null; equipe_nome?: string | null; bitrix_user_id?: string | null; bitrix_department_id?: string | null; ativo?: boolean };
        Update: Partial<Database["public"]["Tables"]["usuarios"]["Insert"]>;
        Relationships: [];
      };
      equipes: {
        Row: { id: string; nome: string; lider_id: string | null; bitrix_department_id: string | null; bitrix_parent_department_id: string | null; bitrix_head_user_id: string | null; bitrix_diretoria_id: string | null; bitrix_superintendencia_id: string | null; criada_em: string };
        Insert: { id?: string; nome: string; lider_id?: string | null; bitrix_department_id?: string | null; bitrix_parent_department_id?: string | null; bitrix_head_user_id?: string | null; bitrix_diretoria_id?: string | null; bitrix_superintendencia_id?: string | null };
        Update: Partial<Database["public"]["Tables"]["equipes"]["Insert"]>;
        Relationships: [];
      };
      roletas: {
        Row: { id: string; nome: string; bitrix_funil_id: string; bitrix_category_id: string | null; bitrix_roleta_valor: string | null; descricao: string | null; ativa: boolean; criada_em: string };
        Insert: { id?: string; nome: string; bitrix_funil_id: string; bitrix_category_id?: string | null; bitrix_roleta_valor?: string | null; descricao?: string | null; ativa?: boolean };
        Update: Partial<Database["public"]["Tables"]["roletas"]["Insert"]>;
        Relationships: [];
      };
      oportunidades: {
        Row: { id: string; bitrix_deal_id: string; roleta_id: string; corretor_id: string | null; status: StatusOportunidade; captada_em: string | null; ultima_atualizacao_bitrix: string | null; titulo: string | null; valor: number | null; roleta_atual: string | null; bitrix_stage_id: string | null; bitrix_assigned_by_id: string | null; data_criacao_bitrix: string | null; criado_em: string };
        Insert: { id?: string; bitrix_deal_id: string; roleta_id: string; corretor_id?: string | null; status?: StatusOportunidade; titulo?: string | null; valor?: number | null; roleta_atual?: string | null; bitrix_stage_id?: string | null; bitrix_assigned_by_id?: string | null; data_criacao_bitrix?: string | null; ultima_atualizacao_bitrix?: string | null };
        Update: Partial<Database["public"]["Tables"]["oportunidades"]["Insert"]>;
        Relationships: [];
      };
      roletas_corretor: {
        Row: { roleta_id: string; corretor_id: string; liberado_por: string; liberado_em: string };
        Insert: { roleta_id: string; corretor_id: string; liberado_por: string; liberado_em?: string };
        Update: Partial<Database["public"]["Tables"]["roletas_corretor"]["Insert"]>;
        Relationships: [];
      };
      capturas_diarias: {
        Row: { corretor_id: string; data: string; quantidade_captada: number; limite_do_dia: number; atualizado_em: string };
        Insert: { corretor_id: string; data?: string; quantidade_captada?: number; limite_do_dia?: number };
        Update: Partial<Database["public"]["Tables"]["capturas_diarias"]["Insert"]>;
        Relationships: [];
      };
      auditorias: {
        Row: { id: string; corretor_id: string; lider_id: string; data: string; status: StatusAuditoria; observacoes: string | null; criterios_avaliados: Json; concluida_em: string | null };
        Insert: { id?: string; corretor_id: string; lider_id: string; data?: string; status?: StatusAuditoria; observacoes?: string | null; criterios_avaliados?: Json; concluida_em?: string | null };
        Update: Partial<Database["public"]["Tables"]["auditorias"]["Insert"]>;
        Relationships: [];
      };
      bloqueios: {
        Row: { id: string; corretor_id: string; motivo: string; criado_em: string; expira_em: string | null; liberado_em: string | null; liberado_por: string | null };
        Insert: { id?: string; corretor_id: string; motivo: string; expira_em?: string | null; liberado_em?: string | null; liberado_por?: string | null };
        Update: Partial<Database["public"]["Tables"]["bloqueios"]["Insert"]>;
        Relationships: [];
      };
      logs_auditoria: {
        Row: { id: string; usuario_id: string | null; acao: string; entidade: string; entidade_id: string | null; payload: Json; criado_em: string };
        Insert: { id?: string; usuario_id?: string | null; acao: string; entidade: string; entidade_id?: string | null; payload?: Json };
        Update: Partial<Database["public"]["Tables"]["logs_auditoria"]["Insert"]>;
        Relationships: [];
      };
      webhook_eventos: {
        Row: { id: string; origem: "bitrix"; idempotency_key: string; tipo_evento: string; payload_bruto: Json; processado: boolean; tentativas: number; erro_processamento: string | null; processado_em: string | null; criado_em: string };
        Insert: { id?: string; origem?: "bitrix"; idempotency_key: string; tipo_evento: string; payload_bruto: Json; processado?: boolean; tentativas?: number; erro_processamento?: string | null; processado_em?: string | null };
        Update: Partial<Database["public"]["Tables"]["webhook_eventos"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      captar_oportunidade: { Args: { p_roleta_id: string }; Returns: Json };
      concluir_auditoria: { Args: { p_auditoria_id: string; p_status: StatusAuditoria; p_observacoes: string; p_criterios: Json }; Returns: Json };
      obter_dashboard: { Args: { p_dias?: number }; Returns: Json };
    };
    Enums: {
      perfil_usuario: PerfilUsuario;
      status_oportunidade: StatusOportunidade;
      status_auditoria: StatusAuditoria;
    };
    CompositeTypes: Record<string, never>;
  };
};
