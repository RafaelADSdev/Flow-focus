update public.usuarios
set paginas_acesso = array_append(paginas_acesso, '/equipe')
where perfil in ('lider', 'diretora', 'admin')
  and not ('/equipe' = any(paginas_acesso));

create table if not exists public.broker_exemptions (
  bitrix_id text primary key,
  broker_name text not null,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.broker_exemptions to authenticated;
grant all on public.broker_exemptions to service_role;
alter table public.broker_exemptions enable row level security;

create policy "broker_exemptions_read_authenticated"
  on public.broker_exemptions for select to authenticated using (true);

create policy "broker_exemptions_insert_creator_or_admin"
  on public.broker_exemptions for insert to authenticated
  with check (auth.uid() = created_by or exists (
    select 1 from public.usuarios u where u.id = auth.uid() and u.perfil = 'admin'
  ));

create policy "broker_exemptions_update_creator_or_admin"
  on public.broker_exemptions for update to authenticated
  using (auth.uid() = created_by or exists (
    select 1 from public.usuarios u where u.id = auth.uid() and u.perfil = 'admin'
  ))
  with check (auth.uid() = created_by or exists (
    select 1 from public.usuarios u where u.id = auth.uid() and u.perfil = 'admin'
  ));

create policy "broker_exemptions_delete_creator_or_admin"
  on public.broker_exemptions for delete to authenticated
  using (auth.uid() = created_by or exists (
    select 1 from public.usuarios u where u.id = auth.uid() and u.perfil = 'admin'
  ));
