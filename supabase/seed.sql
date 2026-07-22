-- Dados operacionais de desenvolvimento. Usuarios devem ser criados pelo Supabase Auth.
insert into public.roletas (nome, bitrix_funil_id, descricao) values
  ('Comercial - GERAL', '0', 'Negocios perdidos com interesse recente'),
  ('Bolsao', 'bolsao', 'Oportunidades antigas para reativacao'),
  ('Lancamentos', 'lancamentos', 'Leads de empreendimentos em abertura')
on conflict (bitrix_funil_id) do nothing;
