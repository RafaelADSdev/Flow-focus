alter table public.usuarios
  add column if not exists equipe_nome text;

update public.usuarios u
set equipe_nome = e.nome
from public.equipes e
where e.id = u.equipe_id
  and u.equipe_nome is distinct from e.nome;

create or replace function private.preencher_equipe_nome_usuario()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.equipe_id is null then
    new.equipe_nome := null;
  else
    select e.nome into new.equipe_nome
    from public.equipes e
    where e.id = new.equipe_id;
  end if;
  return new;
end;
$$;

revoke all on function private.preencher_equipe_nome_usuario() from public;

drop trigger if exists usuarios_preencher_equipe_nome on public.usuarios;
create trigger usuarios_preencher_equipe_nome
before insert or update of equipe_id on public.usuarios
for each row execute function private.preencher_equipe_nome_usuario();

create or replace function private.sincronizar_nome_equipe_usuarios()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  update public.usuarios
  set equipe_nome = new.nome
  where equipe_id = new.id
    and equipe_nome is distinct from new.nome;
  return new;
end;
$$;

revoke all on function private.sincronizar_nome_equipe_usuarios() from public;

drop trigger if exists equipes_sincronizar_nome_usuarios on public.equipes;
create trigger equipes_sincronizar_nome_usuarios
after update of nome on public.equipes
for each row
when (old.nome is distinct from new.nome)
execute function private.sincronizar_nome_equipe_usuarios();
