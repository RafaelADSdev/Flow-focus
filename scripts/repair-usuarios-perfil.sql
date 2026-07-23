-- Repare a coluna perfil ausente em public.usuarios (projeto cgjoqgacenvbcnkhjrws).
-- Rode no SQL Editor do Supabase e depois execute: node scripts/backfill-usuarios-perfil.mjs

do $$ begin
  create type public.perfil_usuario as enum ('corretor', 'lider', 'diretora', 'admin');
exception
  when duplicate_object then null;
end $$;

alter table public.usuarios
  add column if not exists perfil public.perfil_usuario not null default 'corretor';

notify pgrst, 'reload schema';
