alter table public.usuarios
  add column if not exists foto_url text;

comment on column public.usuarios.foto_url is
  'URL da foto de perfil sincronizada do usuário no Bitrix24.';
