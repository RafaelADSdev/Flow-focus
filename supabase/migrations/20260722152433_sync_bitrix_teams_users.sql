alter table public.equipes
  add column if not exists bitrix_department_id text,
  add column if not exists bitrix_parent_department_id text,
  add column if not exists bitrix_head_user_id text,
  add column if not exists bitrix_diretoria_id text,
  add column if not exists bitrix_superintendencia_id text;

alter table public.usuarios
  add column if not exists bitrix_user_id text,
  add column if not exists bitrix_department_id text;

create unique index if not exists equipes_bitrix_department_id_idx
  on public.equipes (bitrix_department_id);

create unique index if not exists usuarios_bitrix_user_id_idx
  on public.usuarios (bitrix_user_id);
