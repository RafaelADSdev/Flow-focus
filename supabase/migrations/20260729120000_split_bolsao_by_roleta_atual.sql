-- Separa oportunidades do bolsão monolítico por roleta_atual (Roleta Atual no Bitrix).
-- Usa lower(trim) como chave canônica para evitar violar roletas_categoria_valor_idx.

-- 1) Vincula oportunidades a roletas já existentes (mesma category + mesmo valor canônico).
UPDATE public.oportunidades o
SET roleta_id = r.id
FROM public.roletas r
WHERE o.roleta_atual IS NOT NULL
  AND trim(o.roleta_atual) <> ''
  AND r.bitrix_category_id = '36'
  AND lower(trim(o.roleta_atual)) = lower(r.bitrix_roleta_valor);

-- 2) Cria roletas só para valores que ainda não existem na category 36.
WITH grouped AS (
  SELECT
    lower(trim(o.roleta_atual)) AS canonical_key,
    min(trim(o.roleta_atual)) AS display_nome
  FROM public.oportunidades o
  WHERE o.roleta_atual IS NOT NULL
    AND trim(o.roleta_atual) <> ''
  GROUP BY lower(trim(o.roleta_atual))
),
to_insert AS (
  SELECT g.*
  FROM grouped g
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.roletas r
    WHERE r.bitrix_category_id = '36'
      AND lower(r.bitrix_roleta_valor) = g.canonical_key
  )
)
INSERT INTO public.roletas (nome, bitrix_funil_id, bitrix_category_id, bitrix_roleta_valor, descricao, ativa)
SELECT
  display_nome AS nome,
  '36:C36:NEW:' || left(
    regexp_replace(
      regexp_replace(lower(display_nome), '[^a-z0-9]+', '-', 'g'),
      '^-+|-+$',
      '',
      'g'
    ),
    80
  ) AS bitrix_funil_id,
  '36' AS bitrix_category_id,
  canonical_key AS bitrix_roleta_valor,
  'Leads do bolsão (C36:NEW) com Roleta Atual: ' || display_nome AS descricao,
  true AS ativa
FROM to_insert;

-- 3) Vincula oportunidades às roletas recém-criadas (e qualquer outra ainda pendente).
UPDATE public.oportunidades o
SET roleta_id = r.id
FROM public.roletas r
WHERE o.roleta_atual IS NOT NULL
  AND trim(o.roleta_atual) <> ''
  AND r.bitrix_category_id = '36'
  AND lower(trim(o.roleta_atual)) = lower(r.bitrix_roleta_valor);

-- 4) Normaliza bitrix_roleta_valor legado para a chave canônica (lower trim).
UPDATE public.roletas r
SET bitrix_roleta_valor = lower(trim(r.bitrix_roleta_valor))
WHERE r.bitrix_category_id = '36'
  AND r.bitrix_roleta_valor IS NOT NULL
  AND r.bitrix_roleta_valor <> lower(trim(r.bitrix_roleta_valor));

WITH roleta_antiga AS (
  SELECT id
  FROM public.roletas
  WHERE bitrix_funil_id = '36:C36:NEW:focus'
     OR (lower(nome) IN ('bolsão', 'bolsao') AND lower(bitrix_roleta_valor) = 'focus')
),
roletas_novas AS (
  SELECT id
  FROM public.roletas
  WHERE bitrix_category_id = '36'
    AND ativa = true
    AND nome <> 'Comercial Geral · Focus'
    AND (bitrix_funil_id IS NULL OR bitrix_funil_id NOT LIKE '%:dashboard')
    AND id NOT IN (SELECT id FROM roleta_antiga)
)
INSERT INTO public.roletas_corretor (roleta_id, corretor_id, liberado_por, liberado_em)
SELECT rn.id, rc.corretor_id, rc.liberado_por, rc.liberado_em
FROM public.roletas_corretor rc
JOIN roleta_antiga ra ON rc.roleta_id = ra.id
CROSS JOIN roletas_novas rn
ON CONFLICT (roleta_id, corretor_id) DO NOTHING;

UPDATE public.roletas r
SET ativa = false
WHERE (
    r.bitrix_funil_id = '36:C36:NEW:focus'
    OR (lower(r.nome) IN ('bolsão', 'bolsao') AND lower(r.bitrix_roleta_valor) = 'focus')
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.oportunidades o WHERE o.roleta_id = r.id
  );
