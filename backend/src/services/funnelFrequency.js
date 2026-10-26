/**
 * Funnel por frecuencia (laboratorio financiero): análisis semanal de Ramsés.
 *
 * La etapa de cada anuncio la decide Meta y se lee en su frecuencia de los últimos 7 días:
 *   TOF ≈ 1–1,3 · MOF ≈ 1,3–1,8 · BOF ≈ 1,8+   (comercionline.com/presentacion)
 * Cuenta sana = triángulo: gasto y creativos TOF > MOF > BOF; ROAS BOF > MOF > TOF; frecuencia más baja en TOF.
 * El análisis dice a qué parte del funnel le faltan creativos (el próximo test), qué anuncios activos
 * están bajo el break-even (regla de apagado), qué falla en la estructura y cuáles son los ganadores
 * de 90 días agrupados por creativo (los post IDs que van a la campaña de scaling).
 *
 * Corte de apagado = BER en base CON IVA (getScalability basis 'gross'): el ROAS de Meta mide venta con IVA y envío.
 * Escalabilidad = Blended 30 días (sin IVA) ÷ BER (sin IVA): baja < 1,5 ≤ media < 1,8 ≤ alta.
 *
 * Meta se consulta en vivo (dos llamadas: 7 y 90 días). Caché en memoria por cliente, TTL 15 minutos.
 */
import axios from 'axios';
import db from '../config/database.js';
import { withFacebookFallback } from '../utils/facebookClient.js';
import { getScalability } from './scalability.js';
import { todayColombia, addDays } from './clientFinancialsService.js';

const FB_GRAPH_API_URL = 'https://graph.facebook.com/v21.0';
const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map(); // clientId -> { value, expiresAt }

export const STAGES = ['TOF', 'MOF', 'BOF'];
export const TOF_MAX = 1.3;
export const MOF_MAX = 1.8;
export const WINDOW_DAYS = 7;
export const WINNERS_DAYS = 90;
export const WINNERS_MIN_PURCHASES = 5;
// Un anuncio con menos de esto en la semana no tiene frecuencia que leer (≈ US$20, el ejemplo de Ramsés).
export const MIN_SPEND = 80000;
// Lectura de la tabla de Ramsés (él no dio números): parecido = ±20 %, lejos del corte ≥ 1,3×, pegado ≤ 1,15×.
const SIMILAR_TOL = 0.2;
const FAR_FROM_CUT = 1.3;
const NEAR_CUT = 1.15;
const SCALE_MEDIUM = 1.5;
const SCALE_HIGH = 1.8;

const CONVERSION_OBJECTIVES = new Set(['OUTCOME_SALES', 'CONVERSIONS', 'PRODUCT_CATALOG_SALES']);
const RETARGETING_RE = /rmkt|remarketing|retarget|compradores|carrito|visitantes|engag|interacci/i;
const SEGMENT_RE = /medell|\bmde\b|bogot|\bbog\b|\bcali\b|barranq|ciudad|hombres|mujeres|\bmen\b|women|intereses|lookalike|\blal\b/i;

const num = (v) => (v === null || v === undefined ? 0 : Number(v) || 0);
const round = (v, d = 2) => (Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : null);
const ratio = (a, b) => (b > 0 ? round(a / b, 2) : null);

export const stageOf = (freq) => (freq <= TOF_MAX ? 'TOF' : freq <= MOF_MAX ? 'MOF' : 'BOF');

/** El mismo creativo suele estar en varios conjuntos con sufijos (| Url…, | Video, - Copia, .mp4): se cuenta una vez. */
export const creativeKey = (name) => String(name || '').toLowerCase().split('|')[0]
  .split(/\s-\s*cop(?:ia|y)\b/)[0]
  .replace(/\.(mp4|mov)\b/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/^[\s\-/]+|[\s\-/]+$/g, '');

const creativeLabel = (name) => String(name || '').split('|')[0]
  .replace(/\.(mp4|mov)\b|\s+video$|\s-\s*cop(?:ia|y)\b.*$/gi, '')
  .trim();

const isPaused = (a) => (a.campaign_status && a.campaign_status !== 'ACTIVE')
  || (a.adset_status && a.adset_status !== 'ACTIVE')
  || (a.ad_status && a.ad_status !== 'ACTIVE');

const isConversion = (a) => CONVERSION_OBJECTIVES.has(a.campaign_objective || '');

/** Estado del anuncio y post ID (effective_object_story_id), que es lo que se lleva al scaling. */
async function enrichAds(fb, ads) {
  const ids = [...new Set(ads.map((a) => a.ad_id).filter(Boolean))];
  const meta = {};
  for (let i = 0; i < ids.length; i += 50) {
    try {
      const r = await axios.get(`${FB_GRAPH_API_URL}/`, {
        params: { ids: ids.slice(i, i + 50).join(','), fields: 'effective_status,creative{effective_object_story_id}', access_token: fb.accessToken },
      });
      Object.assign(meta, r.data);
    } catch (e) {
      // No es fatal: sin estado del anuncio se usa el de campaña y conjunto
    }
  }
  for (const a of ads) {
    const m = meta[a.ad_id];
    a.ad_status = m?.effective_status || null;
    a.post_id = m?.creative?.effective_object_story_id || null;
  }
  return ads;
}

function summarize(ads) {
  const spend = ads.reduce((s, a) => s + num(a.spend), 0);
  const revenue = ads.reduce((s, a) => s + num(a.revenue), 0);
  const purchases = ads.reduce((s, a) => s + num(a.conversions), 0);
  const impressions = ads.reduce((s, a) => s + num(a.impressions), 0);
  // Frecuencia de la etapa = impresiones ÷ alcance (alcance de cada anuncio ≈ impresiones ÷ frecuencia)
  const reach = ads.reduce((s, a) => s + (num(a.frequency) > 0 ? num(a.impressions) / num(a.frequency) : 0), 0);
  const hookW = ads.filter((a) => a.hook_rate !== null && a.hook_rate !== undefined && num(a.impressions) > 0);
  const hookImp = hookW.reduce((s, a) => s + num(a.impressions), 0);
  return {
    ads: ads.length,
    creatives: new Set(ads.map((a) => creativeKey(a.ad_name))).size,
    spend: round(spend, 0),
    revenue: round(revenue, 0),
    purchases,
    roas: ratio(revenue, spend),
    cpa: purchases > 0 ? round(spend / purchases, 0) : null,
    frequency: reach > 0 ? round(impressions / reach, 2) : null,
    hook_rate: hookImp > 0 ? round(hookW.reduce((s, a) => s + num(a.hook_rate) * num(a.impressions), 0) / hookImp, 1) : null,
  };
}

const ordered = (vals, desc = true) => !vals.some((v) => v === null || v === undefined)
  && (desc ? vals[0] > vals[1] && vals[1] > vals[2] : vals[0] < vals[1] && vals[1] < vals[2]);
const similar = (a, b) => a !== null && b !== null && Math.max(a, b) > 0 && Math.abs(a - b) / Math.max(a, b) <= SIMILAR_TOL;

const CREATIVE_BRIEF = {
  TOF: 'El problema, específico. El hook no muestra ni nombra el producto o la marca. Reacción buscada: "esto puede ser la solución a mi problema".',
  MOF: 'El producto: mecanismo, dudas y objeciones (cómo actúa, en cuánto tiempo, envío). Reacción buscada: "ya entiendo cómo funciona".',
  BOF: 'Prueba social, oferta y urgencia, piezas cortas. Reacción buscada: "lo quiero".',
};

/** Lectura y acción según la tabla de la jornada con Ramsés. */
export function diagnose(stages, checks, cut, total) {
  const { TOF: tof, MOF: mof, BOF: bof } = stages;
  const readings = [];
  const actions = [];
  let missing = null;

  if (!checks.spend) {
    if (tof.spend < mof.spend || tof.spend < bof.spend) {
      missing = 'TOF';
      readings.push(`Triángulo invertido: TOF se lleva solo el ${String(Math.round(tof.spend_share * 1000) / 10).replace('.', ',')} % del gasto. No hay creativos metiendo gente nueva al funnel.`);
      actions.push('Producir creativos TOF. No lanzar BOF nuevos esta semana.');
    } else if (mof.spend < bof.spend) {
      missing = 'MOF';
      readings.push('TOF va bien, pero BOF gasta más que MOF: la gente que entra no recibe contexto antes de que le pidan comprar.');
      actions.push('Producir creativos MOF.');
    }
  } else {
    readings.push('El gasto respeta el triángulo (TOF > MOF > BOF).');
  }

  if (!checks.creatives && !missing) {
    missing = [...STAGES].sort((a, b) => stages[a].creatives - stages[b].creatives)[0];
    readings.push(`Gasto bien repartido, pero hay pocos creativos ${missing} con gasto (${stages[missing].creatives}).`);
    actions.push(`Reforzar creativos ${missing}.`);
  }

  if (tof.roas !== null && mof.roas !== null) {
    if (tof.roas > mof.roas || (bof.roas !== null && tof.roas > bof.roas)) {
      readings.push('El TOF tiene más ROAS que etapas de más abajo. Lo normal es BOF > MOF > TOF: las etapas de abajo no están cerrando.');
      if (!missing) {
        missing = (mof.roas ?? 0) <= (bof.roas ?? 0) ? 'MOF' : 'BOF';
        actions.push(`Mejorar la calidad de los creativos ${missing}.`);
      }
    }
    if (cut && similar(tof.roas, mof.roas)) {
      if (Math.min(tof.roas, mof.roas) >= cut * FAR_FROM_CUT) {
        readings.push('TOF y MOF con ROAS parecido y lejos del corte: hay capacidad de escala.');
        actions.push('Subir presupuesto, esperar 3 días y, si se sostiene con más gasto, seguir subiendo. Esta semana puede no haber test.');
      } else if (Math.max(tof.roas, mof.roas) <= cut * NEAR_CUT) {
        readings.push('TOF y MOF con ROAS parecido pero pegado al corte: el TOF cumple su rol, falta calidad en los creativos.');
        actions.push('Mejorar la calidad de los creativos de la etapa débil antes de subir presupuesto.');
      }
    }
  }
  if (cut && tof.roas !== null && tof.spend > 0 && tof.roas < cut) {
    readings.push('El TOF está bajo el corte. No necesita buen ROAS, pero sí meter gente nueva de forma rentable: mira el blended antes de tocarlo.');
  }
  if (total.frequency !== null && total.frequency > MOF_MAX) {
    readings.push(`Frecuencia general alta (${String(total.frequency).replace('.', ',')}): pasa en cuentas de alta recurrencia o estancadas en BOF.`);
  }
  if (!actions.length) actions.push('Estructura sana: el próximo test va a la etapa con menos creativos ganadores.');
  return { readings, actions, missing, missing_brief: missing ? CREATIVE_BRIEF[missing] : null };
}

function structureAlerts(ads) {
  const campaigns = new Map();
  const adsets = new Map();
  for (const a of ads) {
    const c = campaigns.get(a.campaign_id) || { name: a.campaign_name || '', adsets: new Set() };
    c.adsets.add(a.adset_id);
    campaigns.set(a.campaign_id, c);
    const s = adsets.get(a.adset_id) || { name: a.adset_name || '', ads: 0 };
    s.ads += 1;
    adsets.set(a.adset_id, s);
  }
  const alerts = [];
  const noConv = ads.filter((a) => !isConversion(a));
  if (noConv.length) {
    const names = [...new Set(noConv.map((a) => a.campaign_name))];
    alerts.push({ key: 'no_conversion', title: 'Campañas que no son de conversión', detail: 'Solo campañas de conversión. Si son de WhatsApp, confirmar si esas ventas se miden aparte.', items: names, spend: round(noConv.reduce((s, a) => s + num(a.spend), 0), 0) });
  }
  const multi = [...campaigns.values()].filter((c) => c.adsets.size > 1);
  if (multi.length) alerts.push({ key: 'multi_adset', title: 'Campañas con varios conjuntos', detail: 'Un conjunto por campaña; un segundo solo si se pasan los 50 anuncios.', items: multi.map((c) => c.name) });
  const rmkt = [...new Set([...adsets.values()].filter((s) => RETARGETING_RE.test(s.name)).map((s) => s.name))];
  if (rmkt.length) alerts.push({ key: 'retargeting', title: 'Conjuntos que parecen retargeting', detail: 'Solo en marcas de muy alta recurrencia. Su frecuencia sale alta por la audiencia, no porque Meta los use como BOF. Se lee por el nombre: confírmalo en Ads Manager.', items: rmkt });
  const seg = [...new Set([...adsets.values()].filter((s) => SEGMENT_RE.test(s.name)).map((s) => s.name))];
  if (seg.length) alerts.push({ key: 'segmentation', title: 'Conjuntos que parecen tener segmentación cerrada', detail: 'El método es segmentación 100 % abierta: el targeting lo hacen los creativos. Se lee por el nombre: confírmalo en Ads Manager.', items: seg });
  const full = [...adsets.values()].filter((s) => s.ads > 50);
  if (full.length) alerts.push({ key: 'full_adset', title: 'Conjuntos con más de 50 anuncios', detail: 'Pasar a un segundo conjunto.', items: full.map((s) => s.name) });
  return { campaigns: campaigns.size, adsets: adsets.size, alerts };
}

/** Ganadores de 90 días agrupados por creativo (todas sus copias sumadas). */
export function groupWinners(ads, cut, minPurchases = WINNERS_MIN_PURCHASES) {
  const groups = new Map();
  for (const a of ads) {
    if (num(a.spend) <= 0 || !isConversion(a)) continue;
    const k = creativeKey(a.ad_name);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(a);
  }
  const out = [];
  for (const copies of groups.values()) {
    copies.sort((x, y) => num(y.spend) - num(x.spend));
    const spend = copies.reduce((s, a) => s + num(a.spend), 0);
    const revenue = copies.reduce((s, a) => s + num(a.revenue), 0);
    const purchases = copies.reduce((s, a) => s + num(a.conversions), 0);
    const roas = spend > 0 ? revenue / spend : 0;
    if ((cut === null || roas >= cut) && purchases >= minPurchases) {
      const main = copies[0];
      out.push({
        creative: creativeLabel(main.ad_name) || main.ad_name,
        spend: round(spend, 0), revenue: round(revenue, 0), purchases, roas: round(roas, 2),
        copies: copies.length,
        post_ids: new Set(copies.map((a) => a.post_id).filter(Boolean)).size,
        // La copia que más gastó es la que se lleva al scaling (su post trae la prueba social acumulada)
        main: { ad_id: main.ad_id, post_id: main.post_id || null, campaign: main.campaign_name, adset: main.adset_name, roas: round(num(main.roas), 2), spend: round(num(main.spend), 0), active: !isPaused(main) },
      });
    }
  }
  return out.sort((a, b) => b.spend - a.spend);
}

const scaleLevel = (blended, ber) => {
  if (!blended || !ber) return null;
  const r = blended / ber;
  return { ratio: round(r, 2), level: r >= SCALE_HIGH ? 'alta' : r >= SCALE_MEDIUM ? 'media' : 'baja' };
};
const STRUCTURE = {
  baja: '1 campaña con un conjunto de scaling y conjuntos de test adentro.',
  media: '1 campaña de scaling + 1 campaña de testing.',
  alta: '1 campaña de scaling + varias campañas de testing, cada test de 3–5 creativos con ~100 USD/día por 72 h.',
};

const slimAd = (a) => ({
  ad_id: a.ad_id, ad_name: a.ad_name, adset_name: a.adset_name, campaign_name: a.campaign_name, post_id: a.post_id || null,
  stage: a.stage || null, frequency: round(num(a.frequency), 2), spend: round(num(a.spend), 0), revenue: round(num(a.revenue), 0),
  roas: round(num(a.roas), 2), purchases: num(a.conversions), hook_rate: a.hook_rate === null || a.hook_rate === undefined ? null : round(num(a.hook_rate), 1),
  paused: isPaused(a),
});

/**
 * @param {{ clientId:number, orgId:number, force?:boolean }} args
 */
export async function getFunnelFrequency({ clientId, orgId, force = false }) {
  const hit = cache.get(clientId);
  if (!force && hit && hit.expiresAt > Date.now()) return { ...hit.value, cached: true };

  const fbCred = await db.prepare('SELECT access_token, ad_account_id FROM client_facebook_credentials WHERE client_id = ?').get(clientId);
  const end = addDays(todayColombia(), -1); // la semana cerrada hasta ayer
  const start = addDays(end, -(WINDOW_DAYS - 1));
  const winnersStart = addDays(end, -(WINNERS_DAYS - 1));
  if (!fbCred?.ad_account_id) {
    return { client_id: clientId, connected: false, start, end, message: 'Sin cuenta de Meta conectada.' };
  }

  // Corte (BER con IVA, para comparar con el ROAS de Meta) y escalabilidad (sin IVA). Secuencial: el primero refresca el COGS.
  const gross = await getScalability({ clientId, orgId, basis: 'gross' });
  const net = await getScalability({ clientId, orgId, basis: 'net' });
  const cut = gross?.ber?.value ?? null;
  const scale = scaleLevel(net?.blended?.last30, net?.ber?.value);

  const { result } = await withFacebookFallback(fbCred, async (fb) => {
    const [week, long] = await Promise.all([fb.getAdLevelInsights(start, end), fb.getAdLevelInsights(winnersStart, end)]);
    await enrichAds(fb, [...week, ...long]);
    return { week, long };
  }, 'Funnel');

  const withSpend = result.week.filter((a) => num(a.spend) > 0);
  const totalSpend = withSpend.reduce((s, a) => s + num(a.spend), 0);
  const noConversion = withSpend.filter((a) => !isConversion(a));
  const conversion = withSpend.filter(isConversion);
  const lowSignal = conversion.filter((a) => num(a.spend) < MIN_SPEND);
  const signal = conversion.filter((a) => num(a.spend) >= MIN_SPEND);
  for (const a of signal) a.stage = stageOf(num(a.frequency));

  const stages = Object.fromEntries(STAGES.map((s) => [s, summarize(signal.filter((a) => a.stage === s))]));
  const classified = STAGES.reduce((s, k) => s + stages[k].spend, 0);
  for (const s of STAGES) stages[s].spend_share = classified > 0 ? round(stages[s].spend / classified, 4) : null;
  const total = summarize(signal);

  const checks = {
    spend: ordered(STAGES.map((s) => stages[s].spend)),
    creatives: ordered(STAGES.map((s) => stages[s].creatives)),
    roas: ordered(STAGES.map((s) => stages[s].roas), false),
    frequency: stages.TOF.ads > 0,
  };

  const below = cut === null ? [] : signal.filter((a) => num(a.roas) < cut).sort((x, y) => num(y.spend) - num(x.spend));

  const value = {
    client_id: clientId,
    connected: true,
    start, end,
    updated_at: new Date().toISOString(),
    thresholds: { tof_max: TOF_MAX, mof_max: MOF_MAX, min_spend: MIN_SPEND },
    cut,
    ber_net: net?.ber?.value ?? null,
    blended_30d: net?.blended?.last30 ?? null,
    scalability: scale ? { ...scale, structure: STRUCTURE[scale.level] } : null,
    spend_total: round(totalSpend, 0),
    spend_low_signal: round(lowSignal.reduce((s, a) => s + num(a.spend), 0), 0),
    ads_low_signal: lowSignal.length,
    spend_no_conversion: round(noConversion.reduce((s, a) => s + num(a.spend), 0), 0),
    stages,
    total,
    checks,
    diagnosis: diagnose(stages, checks, cut, total),
    below_cut: { active: below.filter((a) => !isPaused(a)).map(slimAd), paused: below.filter(isPaused).map(slimAd) },
    structure: structureAlerts(withSpend),
    winners: { start: winnersStart, end, min_purchases: WINNERS_MIN_PURCHASES, items: groupWinners(result.long, cut) },
    ads: signal.sort((x, y) => STAGES.indexOf(x.stage) - STAGES.indexOf(y.stage) || num(y.spend) - num(x.spend)).map(slimAd),
    method: {
      stage: 'La etapa la decide Meta y se lee en la frecuencia de 7 días: TOF ≤ 1,3 · MOF ≤ 1,8 · BOF > 1,8.',
      triangle: 'Cuenta sana: gasto y creativos TOF > MOF > BOF; ROAS BOF > MOF > TOF; frecuencia más baja en TOF.',
      cut: 'Corte de apagado = break-even con IVA, porque el ROAS de Meta cuenta la venta con IVA y envío. Se apaga solo lo que en 7 días quede debajo.',
      winners: `Ganadores: creativos con ROAS ≥ corte y al menos ${WINNERS_MIN_PURCHASES} compras en ${WINNERS_DAYS} días, sumando todas sus copias. Al scaling se lleva el post de la copia que más gastó.`,
      source: 'Ramsés @ramDTC · comercionline.com/presentacion',
    },
  };
  cache.set(clientId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return { ...value, cached: false };
}

export default { getFunnelFrequency, groupWinners, diagnose, stageOf, creativeKey };
