/**

 * Importa deals Focus do Comercial Geral (category 16) do ano inteiro

 * para public.oportunidades — alimenta a Visão geral.

 *

 * Uso: node scripts/sync-bitrix-comercial-geral-focus.mjs

 * Opcional: YEAR=2026 node scripts/sync-bitrix-comercial-geral-focus.mjs

 *

 * Progresso em .sync-comercial-geral-progress.json

 */

import fs from "node:fs";

import path from "node:path";

import { createClient } from "@supabase/supabase-js";



function loadEnvFile(fileName) {

  const filePath = path.join(process.cwd(), fileName);

  if (!fs.existsSync(filePath)) return;

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {

    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");

    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();

    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");

    if (!process.env[key]) process.env[key] = value;

  }

}



loadEnvFile(".env.local");

loadEnvFile(".env");



const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";

const bitrixBaseUrl = (process.env.BITRIX24_BASE_URL ?? "").replace(/\/$/, "");

const categoryId = process.env.BITRIX24_CAPTURE_CATEGORY_ID ?? "16";

const rouletteField = process.env.BITRIX24_ROULETTE_FIELD ?? "UF_CRM_1726667595972";

const rouletteTag = process.env.BITRIX24_ROULETTE_TAG ?? "Focus";

const year = Number(process.env.YEAR ?? new Date().getFullYear());

const now = new Date();



function listWeekPeriods(targetYear = year) {

  const lastMonth = targetYear === now.getFullYear() ? now.getMonth() : 11;

  const periods = [];



  for (let month = 0; month <= lastMonth; month += 1) {

    const monthLabel = `${targetYear}-${String(month + 1).padStart(2, "0")}`;

    const monthStart = new Date(targetYear, month, 1, 0, 0, 0);

    const monthEnd = targetYear === now.getFullYear() && month === now.getMonth()

      ? new Date(now)

      : new Date(targetYear, month + 1, 0, 23, 59, 59);



    let cursor = new Date(monthStart);

    let weekNum = 1;



    while (cursor <= monthEnd) {

      const weekEnd = new Date(cursor);

      weekEnd.setDate(weekEnd.getDate() + 6);

      weekEnd.setHours(23, 59, 59, 0);

      if (weekEnd > monthEnd) weekEnd.setTime(monthEnd.getTime());



      periods.push({

        label: `${monthLabel} · semana ${weekNum}`,

        monthLabel,

        weekNum,

        isLastWeekOfMonth: weekEnd.getTime() >= monthEnd.getTime(),

        dateFrom: cursor.toISOString().slice(0, 19),

        dateTo: weekEnd.toISOString().slice(0, 19),

      });



      cursor = new Date(weekEnd);

      cursor.setDate(cursor.getDate() + 1);

      cursor.setHours(0, 0, 0, 0);

      weekNum += 1;

    }

  }



  return periods;

}



const weekPeriods = listWeekPeriods();



if (!supabaseUrl || !secretKey || !bitrixBaseUrl) {

  console.error("Configure NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY e BITRIX24_BASE_URL em .env.local");

  process.exit(1);

}



const supabase = createClient(supabaseUrl, secretKey, { auth: { persistSession: false } });

const progressFile = path.join(process.cwd(), ".sync-comercial-geral-progress.json");



function chunks(items, size) {

  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>

    items.slice(index * size, (index + 1) * size),

  );

}



function rouletteValue(deal) {

  const value = deal[rouletteField];

  return Array.isArray(value) ? String(value[0] ?? "").trim() : String(value ?? "").trim();

}



function isFocus(deal) {

  return rouletteValue(deal).toLocaleLowerCase().includes(rouletteTag.toLocaleLowerCase());

}



function stageWithSemantic(deal) {

  const stage = String(deal.STAGE_ID ?? "").trim();

  const semantic = String(deal.STAGE_SEMANTIC_ID ?? "").trim().toUpperCase();

  if (!stage) return semantic ? `#${semantic}` : null;

  if (!semantic) return stage;

  return `${stage}#${semantic}`;

}



function sleep(ms) {

  return new Promise((resolve) => setTimeout(resolve, ms));

}



function readResumeState() {

  try {

    return JSON.parse(fs.readFileSync(progressFile, "utf8"));

  } catch {

    return {};

  }

}



function reportProgress(payload) {

  const state = readResumeState();

  const next = {

    percent: payload.percent ?? state.percent ?? 0,

    message: payload.message ?? state.message ?? "",

    current: payload.current ?? state.current ?? null,

    completedWeeks: payload.completedWeeks ?? state.completedWeeks ?? [],

    completedMonths: payload.completedMonths ?? state.completedMonths ?? [],

    importados: payload.importados ?? state.importados ?? 0,

    elegiveis: payload.elegiveis ?? state.elegiveis ?? 0,

    com_corretor: payload.com_corretor ?? state.com_corretor ?? 0,

    weekTotal: weekPeriods.length,

    updated_at: new Date().toISOString(),

  };



  console.log(`[SYNC ${next.percent}%] ${next.message}`);

  fs.writeFileSync(progressFile, JSON.stringify(next, null, 2));

  return next;

}



async function bitrixCallPage(method, params) {

  const url = new URL(`${bitrixBaseUrl}/${method}.json`);

  params?.forEach((value, key) => url.searchParams.append(key, value));



  for (let attempt = 1; attempt <= 12; attempt += 1) {

    const response = await fetch(url, { method: "POST", signal: AbortSignal.timeout(45_000) });

    if (response.status === 429 && attempt < 12) {

      const waitMs = Math.min(30_000, 3_000 * attempt);

      reportProgress({

        percent: readResumeState().percent ?? 0,

        message: `Aguardando Bitrix (429) · tentativa ${attempt}/12 · ${Math.round(waitMs / 1000)}s`,

      });

      await sleep(waitMs);

      continue;

    }

    if (!response.ok) throw new Error(`Bitrix HTTP ${response.status}`);

    const body = await response.json();

    if (body.error || body.result === undefined) {

      throw new Error(body.error_description ?? body.error ?? "Resposta inválida do Bitrix");

    }

    return body;

  }



  throw new Error("Bitrix HTTP 429");

}



async function fetchPage(start, period) {

  const dealFields = [

    "ID", "TITLE", "CATEGORY_ID", "STAGE_ID", "STAGE_SEMANTIC_ID",

    "OPPORTUNITY", "ASSIGNED_BY_ID", "DATE_CREATE", "DATE_MODIFY", rouletteField,

  ];



  const params = new URLSearchParams({

    "filter[CATEGORY_ID]": categoryId,

    [`filter[=%${rouletteField}]`]: `%${rouletteTag}%`,

    "filter[>=DATE_CREATE]": period.dateFrom,

    "filter[<=DATE_CREATE]": period.dateTo,

    start: String(start),

  });

  dealFields.forEach((field) => params.append("select[]", field));



  return bitrixCallPage("crm.deal.list", params);

}



async function fetchPeriodDeals(period) {

  const first = await fetchPage(0, period);

  const total = first.total ?? first.result.length;

  const pageCount = Math.max(1, Math.ceil(total / 50));

  const starts = Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) => (index + 1) * 50);

  const deals = [...first.result];



  for (const start of starts) {

    const page = await fetchPage(start, period);

    deals.push(...page.result);

    await sleep(700);

  }



  return { total, deals };

}



function buildRows(eligible, roulette, corretorByBitrixId, existingByDeal) {

  return eligible.map((deal) => {

    const dealId = String(deal.ID);

    const existing = existingByDeal.get(dealId);

    const assigned = String(deal.ASSIGNED_BY_ID ?? "") || null;

    const mappedCorretor = assigned ? corretorByBitrixId.get(assigned) ?? null : null;

    const value = rouletteValue(deal);

    const dateCreate = String(deal.DATE_CREATE ?? "") || null;

    const corretorId = existing?.corretor_id ?? mappedCorretor;

    const captadaEm = existing?.captada_em ?? (corretorId && dateCreate ? dateCreate : null);



    return {

      bitrix_deal_id: dealId,

      roleta_id: existing?.roleta_id ?? roulette.id,

      titulo: String(deal.TITLE ?? `Negócio #${dealId}`),

      valor: Number(deal.OPPORTUNITY ?? 0) || 0,

      roleta_atual: value || null,

      bitrix_stage_id: stageWithSemantic(deal),

      bitrix_assigned_by_id: assigned,

      data_criacao_bitrix: dateCreate,

      ultima_atualizacao_bitrix: String(deal.DATE_MODIFY ?? dateCreate ?? new Date().toISOString()),

      corretor_id: corretorId,

      captada_em: captadaEm,

    };

  });

}



async function main() {

  const dateFrom = weekPeriods[0]?.dateFrom ?? `${year}-01-01T00:00:00`;

  const dateTo = weekPeriods[weekPeriods.length - 1]?.dateTo ?? `${year}-12-31T23:59:59`;

  const monthCount = new Set(weekPeriods.map((period) => period.monthLabel)).size;



  const existingResume = readResumeState();
  const hasResume = (existingResume.completedWeeks?.length ?? 0) > 0;

  if (hasResume) {
    reportProgress({
      message: `Retomando · ${existingResume.completedWeeks.length}/${weekPeriods.length} semanas · ${existingResume.importados ?? 0} importados`,
    });
  } else {
    reportProgress({
      percent: 0,
      message: `Iniciando · ${monthCount} meses · ${weekPeriods.length} semanas (${dateFrom.slice(0, 10)} → ${dateTo.slice(0, 10)})`,
      completedWeeks: [],
      completedMonths: [],
      importados: 0,
      elegiveis: 0,
      com_corretor: 0,
    });
  }



  const funilId = `${categoryId}:*:${rouletteTag.toLocaleLowerCase()}:dashboard`;

  const { data: roulette, error: rouletteError } = await supabase

    .from("roletas")

    .upsert({

      nome: "Comercial Geral · Focus",

      bitrix_funil_id: funilId,

      bitrix_category_id: String(categoryId),

      bitrix_roleta_valor: rouletteTag,

      descricao: `Histórico Focus da category ${categoryId} para Visão geral (${year})`,

      ativa: true,

    }, { onConflict: "bitrix_funil_id" })

    .select("id")

    .single();



  if (rouletteError) throw rouletteError;



  const { data: usuarios, error: usuariosError } = await supabase

    .from("usuarios")

    .select("id, bitrix_user_id")

    .not("bitrix_user_id", "is", null);



  if (usuariosError) throw usuariosError;



  const corretorByBitrixId = new Map(

    (usuarios ?? []).map((usuario) => [String(usuario.bitrix_user_id), usuario.id]),

  );



  const resume = readResumeState();

  const completedWeeks = new Set(resume.completedWeeks ?? []);

  const completedMonths = new Set(resume.completedMonths ?? []);

  const startWeekIndex = Number(process.env.START_WEEK ?? weekPeriods.findIndex((period) => !completedWeeks.has(period.label)));

  const safeStart = startWeekIndex >= 0 ? startWeekIndex : 0;



  let encontrados = 0;

  let baixados = 0;

  let elegiveis = resume.elegiveis ?? 0;

  let importados = resume.importados ?? 0;

  let comCorretor = resume.com_corretor ?? 0;



  for (let weekIndex = safeStart; weekIndex < weekPeriods.length; weekIndex += 1) {

    const period = weekPeriods[weekIndex];

    if (completedWeeks.has(period.label)) continue;



    reportProgress({

      percent: Math.min(99, Math.round((weekIndex / weekPeriods.length) * 100)),

      current: period.label,

      message: `Baixando ${period.label} (${period.dateFrom.slice(0, 10)} → ${period.dateTo.slice(0, 10)})`,

      completedWeeks: [...completedWeeks],

      completedMonths: [...completedMonths],

      importados,

      elegiveis,

      com_corretor: comCorretor,

    });



    const periodResult = await fetchPeriodDeals(period);

    encontrados += periodResult.total;

    baixados += periodResult.deals.length;



    const eligible = periodResult.deals.filter(

      (deal) => String(deal.CATEGORY_ID ?? "") === String(categoryId) && isFocus(deal),

    );

    elegiveis += eligible.length;



    if (eligible.length) {

      const dealIds = eligible.map((deal) => String(deal.ID));

      const existingRows = (

        await Promise.all(

          chunks(dealIds, 300).map(async (ids) => {

            const { data, error } = await supabase

              .from("oportunidades")

              .select("bitrix_deal_id, roleta_id, corretor_id, captada_em")

              .in("bitrix_deal_id", ids);

            if (error) throw error;

            return data ?? [];

          }),

        )

      ).flat();

      const existingByDeal = new Map(existingRows.map((row) => [row.bitrix_deal_id, row]));

      const rows = buildRows(eligible, roulette, corretorByBitrixId, existingByDeal);

      comCorretor += rows.filter((row) => row.corretor_id).length;



      for (const batch of chunks(rows, 200)) {

        const { error } = await supabase.from("oportunidades").upsert(batch, { onConflict: "bitrix_deal_id" });

        if (error) throw error;

        importados += batch.length;

      }

    }



    completedWeeks.add(period.label);

    const weekPercent = Math.min(99, Math.round(((weekIndex + 1) / weekPeriods.length) * 100));



    let message = `✓ ${period.label} concluída · ${eligible.length} leads · ${importados} no total`;

    if (period.isLastWeekOfMonth && !completedMonths.has(period.monthLabel)) {

      completedMonths.add(period.monthLabel);

      message = `✓ Mês ${period.monthLabel} concluído · ${importados} importados no total (${weekPercent}%)`;

    }



    reportProgress({

      percent: weekPercent,

      current: period.label,

      message,

      completedWeeks: [...completedWeeks],

      completedMonths: [...completedMonths],

      importados,

      elegiveis,

      com_corretor: comCorretor,

    });



    await sleep(800);

  }



  reportProgress({

    percent: 100,

    message: `Concluído · ${importados} leads importados (${comCorretor} com corretor)`,

    completedWeeks: [...completedWeeks],

    completedMonths: [...completedMonths],

    importados,

    elegiveis,

    com_corretor: comCorretor,

  });



  console.log(JSON.stringify({

    ok: true,

    categoryId,

    periodo: { de: dateFrom, ate: dateTo },

    semanas: weekPeriods.length,

    meses: monthCount,

    encontrados,

    baixados,

    elegiveis,

    importados,

    com_corretor: comCorretor,

    roleta_id: roulette.id,

  }, null, 2));

}



main().catch((error) => {

  console.error(error);

  process.exit(1);

});


