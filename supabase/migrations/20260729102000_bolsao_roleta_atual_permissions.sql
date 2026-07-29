-- Propaga permissões da roleta monolítica do bolsão para roletas por Roleta Atual (Bitrix).
WITH roleta_antiga AS (
  SELECT id
  FROM public.roletas
  WHERE bitrix_funil_id = '36:C36:NEW:focus'
     OR (lower(nome) IN ('bolsão', 'bolsao') AND lower(bitrix_roleta_valor) = 'focus')
  LIMIT 1
),
roletas_bolsao AS (
  SELECT id
  FROM public.roletas
  WHERE bitrix_category_id = '36'
    AND ativa = true
    AND nome <> 'Comercial Geral · Focus'
    AND (bitrix_funil_id IS NULL OR bitrix_funil_id NOT LIKE '%:dashboard')
)
INSERT INTO public.roletas_corretor (roleta_id, corretor_id, liberado_por, liberado_em)
SELECT rb.id, rc.corretor_id, rc.liberado_por, rc.liberado_em
FROM public.roletas_corretor rc
JOIN roleta_antiga ra ON rc.roleta_id = ra.id
CROSS JOIN roletas_bolsao rb
ON CONFLICT (roleta_id, corretor_id) DO NOTHING;

UPDATE public.roletas r
SET ativa = false
FROM (
  SELECT id
  FROM public.roletas
  WHERE bitrix_funil_id = '36:C36:NEW:focus'
     OR (lower(nome) IN ('bolsão', 'bolsao') AND lower(bitrix_roleta_valor) = 'focus')
  LIMIT 1
) AS antiga
WHERE r.id = antiga.id
  AND NOT EXISTS (
    SELECT 1 FROM public.oportunidades o WHERE o.roleta_id = r.id
  );
