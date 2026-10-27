import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Copy, HelpCircle, Loader2, RefreshCw, X } from 'lucide-react';
import { growthAPI } from '../../../utils/api';
import { fmtMoney, fmtMoneyShort, fmtX, fmtInt, fmtPct, fmtPctNum, dayShort, fmtRelative } from './format';

const MONO = { fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace" };

const STAGE_INFO = {
  TOF: { name: 'TOF', who: 'No te conoce', goal: 'Meter gente nueva al funnel de forma rentable', range: 'frecuencia ≤ 1,3', color: 'var(--accent)' },
  MOF: { name: 'MOF', who: 'Te conoce, no te entiende', goal: 'Dar contexto, explicar el mecanismo, romper objeciones', range: '1,3 – 1,8', color: '#F59E0B' },
  BOF: { name: 'BOF', who: 'Te conoce y sabe cómo funciona', goal: 'Terminar de convertir: prueba social, oferta, urgencia', range: 'más de 1,8', color: '#121212' },
};
const STAGES = ['TOF', 'MOF', 'BOF'];
const SCALE = {
  alta: 'bg-[rgb(var(--accent-rgb)/0.15)] text-[var(--accent-deep)]',
  media: 'bg-amber-100 text-amber-800',
  baja: 'bg-red-100 text-red-700',
};

const Label = ({ children, className = '' }) => (
  <div className={`text-[10px] uppercase tracking-[0.14em] text-gray-500 ${className}`} style={MONO}>{children}</div>
);

const Check4 = ({ ok, children }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${ok ? 'bg-[rgb(var(--accent-rgb)/0.12)] text-[var(--accent-deep)]' : 'bg-red-50 text-red-700'}`}>
    {ok ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}{children}
  </span>
);

function CopyId({ value }) {
  const [done, setDone] = useState(false);
  if (!value) return <span className="text-gray-300">—</span>;
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* sin portapapeles */ }
  };
  return (
    <button type="button" onClick={copy} title="Copiar post ID" className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-[var(--ink)] tabular-nums" style={MONO}>
      {done ? <Check className="w-3 h-3 text-[var(--accent-deep)]" /> : <Copy className="w-3 h-3" />}
      <span className="truncate max-w-[110px]">{value.split('_').pop()}</span>
    </button>
  );
}

const Section = ({ title, sub, children, right }) => (
  <div className="mt-5 pt-5 border-t border-gray-100">
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h3 className="font-semibold text-sm text-[var(--ink)]">{title}</h3>
        {sub && <p className="text-xs text-gray-400 mt-0.5 max-w-2xl">{sub}</p>}
      </div>
      {right}
    </div>
    <div className="mt-3">{children}</div>
  </div>
);

const Th = ({ children, right }) => <th className={`px-2 py-2 font-medium text-[10px] uppercase tracking-[0.1em] text-gray-400 whitespace-nowrap ${right ? 'text-right' : 'text-left'}`} style={MONO}>{children}</th>;
const Td = ({ children, right, className = '' }) => <td className={`px-2 py-2 align-top ${right ? 'text-right tabular-nums whitespace-nowrap' : ''} ${className}`}>{children}</td>;
const StagePill = ({ s }) => (
  <span className="inline-flex items-center gap-1 text-[10px] font-semibold" style={MONO}>
    <span className="w-2 h-2 rounded-full" style={{ background: STAGE_INFO[s]?.color }} />{s}
  </span>
);

function MethodPopover({ method, onClose }) {
  return (
    <div role="dialog" className="fixed inset-x-4 top-24 sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 z-40 sm:w-[400px] max-h-[70vh] overflow-y-auto bg-[var(--dark)] text-white rounded-xl shadow-2xl p-4 text-[12px] leading-relaxed">
      <div className="flex items-start justify-between gap-3">
        <Label className="!text-gray-400">Cómo se calcula</Label>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="text-gray-400 hover:text-white"><X className="w-3.5 h-3.5" /></button>
      </div>
      <ul className="mt-2 space-y-2 text-gray-200">
        <li>{method?.stage}</li>
        <li>{method?.triangle}</li>
        <li>{method?.cut}</li>
        <li>{method?.winners}</li>
      </ul>
      <p className="mt-3 text-gray-400">Anuncios con menos de $80.000 en la semana no entran: su frecuencia todavía no dice nada. Fuente: {method?.source}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="glass-solid rounded-2xl p-6 animate-pulse">
      <div className="h-3 w-48 bg-gray-200 rounded" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">{[0, 1, 2].map((i) => <div key={i} className="h-32 bg-gray-100 rounded-xl" />)}</div>
      <p className="text-xs text-gray-400 mt-4 inline-flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Leyendo los anuncios de Meta de la última semana y de 90 días…</p>
    </div>
  );
}

/**
 * Análisis de frecuencia semanal (método Ramsés): en qué parte del funnel está la plata, si el triángulo está sano,
 * qué creativos hacen falta, qué apagar y qué ganadores llevar al scaling. Solo con `lab_enabled`.
 */
export default function FunnelFrequency({ clientId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showMethod, setShowMethod] = useState(false);
  const [showAllWinners, setShowAllWinners] = useState(false);
  const [showAds, setShowAds] = useState(false);

  const load = useCallback(async (force = false) => {
    setLoading(true); setError(null);
    try {
      const r = await growthAPI.getFunnelFrequency(clientId, force);
      setData(r.data);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'No pudimos leer los anuncios de Meta.');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) return <Skeleton />;
  if (error && !data) return <div className="glass-solid rounded-2xl p-5 text-sm text-gray-500 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> {error}</div>;
  if (!data) return null;
  if (!data.connected) return <div className="glass-solid rounded-2xl p-5 text-sm text-gray-500">Funnel por frecuencia: {data.message}</div>;

  const { stages, checks, diagnosis, below_cut: below, structure, winners, scalability } = data;
  const winnersShown = showAllWinners ? winners.items : winners.items.slice(0, 10);
  const missing = diagnosis.missing ? STAGE_INFO[diagnosis.missing] : null;

  return (
    <div className="glass-solid rounded-2xl p-5 sm:p-6">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex items-center gap-2 min-w-0">
          <Label>Laboratorio · Funnel por frecuencia</Label>
          {loading && <Loader2 className="w-3 h-3 animate-spin text-gray-300" />}
        </div>
        <div className="relative flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-[11px] text-gray-400" style={MONO}>{dayShort(data.start)} → {dayShort(data.end)} · {fmtRelative(data.updated_at)}</span>
          <button type="button" onClick={() => load(true)} disabled={loading} className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-[var(--ink)] disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualizar
          </button>
          <button type="button" onClick={() => setShowMethod((o) => !o)} className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-[var(--ink)]">
            <HelpCircle className="w-3.5 h-3.5" /> ¿Cómo se calcula?
          </button>
          {showMethod && <MethodPopover method={data.method} onClose={() => setShowMethod(false)} />}
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-1.5 max-w-3xl">La etapa de cada anuncio la decide Meta y se ve en su frecuencia de los últimos 7 días. Corte de apagado: <strong className="text-[var(--ink)] font-semibold">{fmtX(data.cut, 2)}</strong> de ROAS en Meta (break-even con IVA).</p>

      {/* Las tres etapas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
        {STAGES.map((s) => {
          const st = stages[s]; const info = STAGE_INFO[s];
          const isMissing = diagnosis.missing === s;
          return (
            <div key={s} className={`rounded-xl border p-4 min-w-0 ${isMissing ? 'border-[#dc2626]/40 bg-red-50/40' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: info.color }} /><span className="font-semibold text-[var(--ink)]">{info.name}</span><span className="text-[10px] text-gray-400" style={MONO}>{info.range}</span></div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{info.who}</div>
                </div>
                {isMissing && <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#dc2626] text-white">Faltan creativos</span>}
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-[34px] font-light tracking-tight leading-none tabular-nums text-[var(--ink)]">{fmtPct(st.spend_share, 1)}</span>
                <span className="text-[11px] text-gray-400">del gasto</span>
              </div>
              <div className="mt-2 h-[3px] bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, (st.spend_share || 0) * 100)}%`, background: info.color }} /></div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                <dt className="text-gray-400">Gasto</dt><dd className="text-right tabular-nums text-[var(--ink)]">{fmtMoney(st.spend)}</dd>
                <dt className="text-gray-400">Creativos</dt><dd className="text-right tabular-nums text-[var(--ink)]">{fmtInt(st.creatives)} <span className="text-gray-400">({fmtInt(st.ads)} anuncios)</span></dd>
                <dt className="text-gray-400">ROAS Meta</dt><dd className={`text-right tabular-nums font-semibold ${st.roas !== null && data.cut && st.roas < data.cut ? 'text-[#dc2626]' : 'text-[var(--ink)]'}`}>{fmtX(st.roas, 2)}</dd>
                <dt className="text-gray-400">Costo por venta</dt><dd className="text-right tabular-nums text-[var(--ink)]">{fmtMoney(st.cpa)}</dd>
                <dt className="text-gray-400">Frecuencia</dt><dd className="text-right tabular-nums text-[var(--ink)]">{st.frequency === null ? '—' : String(st.frequency.toFixed(2)).replace('.', ',')}</dd>
                <dt className="text-gray-400">Hook rate</dt><dd className="text-right tabular-nums text-[var(--ink)]">{fmtPctNum(st.hook_rate, 1)}</dd>
              </dl>
              <p className="mt-3 text-[11px] text-gray-400 leading-snug">{info.goal}</p>
            </div>
          );
        })}
      </div>

      {/* Triángulo */}
      <div className="flex flex-wrap items-center gap-2 mt-4">
        <Label className="mr-1">Triángulo</Label>
        <Check4 ok={checks.spend}>Gasto TOF › MOF › BOF</Check4>
        <Check4 ok={checks.creatives}>Creativos TOF › MOF › BOF</Check4>
        <Check4 ok={checks.roas}>ROAS BOF › MOF › TOF</Check4>
        <Check4 ok={checks.frequency}>Frecuencia más baja en TOF</Check4>
      </div>
      {(data.ads_low_signal > 0 || data.spend_no_conversion > 0) && (
        <p className="text-[11px] text-gray-400 mt-2">
          Por fuera: {fmtInt(data.ads_low_signal)} anuncios con menos de {fmtMoneyShort(data.thresholds.min_spend)} en la semana ({fmtMoney(data.spend_low_signal)})
          {data.spend_no_conversion > 0 && <> y {fmtMoney(data.spend_no_conversion)} en campañas que no son de conversión</>}. Gasto total de la semana: {fmtMoney(data.spend_total)}.
        </p>
      )}

      {/* Qué hacer esta semana */}
      <div className="mt-5 rounded-xl bg-[var(--dark)] text-white p-4 sm:p-5">
        <Label className="!text-gray-400">Qué hacer esta semana</Label>
        {missing && (
          <div className="mt-2">
            <div className="text-[22px] sm:text-[26px] font-light tracking-tight leading-tight">El próximo test es de creativos <span className="font-semibold text-[var(--accent)]">{missing.name}</span></div>
            <p className="text-[12px] text-gray-300 mt-1.5 max-w-2xl">{diagnosis.missing_brief}</p>
          </div>
        )}
        <ol className="mt-3 space-y-1.5 text-[13px] list-decimal pl-5 marker:text-gray-500">
          {diagnosis.actions.map((a) => <li key={a}>{a}</li>)}
          {missing && <li>Test de 3–5 creativos con al menos ~100 USD al día durante 72 h, juzgado por el blended, no por el ROAS de Meta.</li>}
        </ol>
        {diagnosis.readings.length > 0 && (
          <ul className="mt-3 pt-3 border-t border-white/10 space-y-1 text-[12px] text-gray-400">
            {diagnosis.readings.map((r) => <li key={r}>· {r}</li>)}
          </ul>
        )}
      </div>

      {/* Bajo el corte */}
      <Section title={`Anuncios activos bajo el corte (${fmtX(data.cut, 2)})`} sub="Regla de Ramsés: se apaga solo lo que en 7 días quede debajo del break-even. Si es un test, mira antes si el blended sufrió; si es un ganador histórico, pasa su post al scaling y apágalo en el test.">
        {data.cut === null ? <p className="text-sm text-gray-400">Sin break-even todavía: carga los costos para tener el corte.</p>
          : below.active.length === 0 ? <p className="text-sm text-gray-500">Ningún anuncio activo con señal está debajo del corte.</p>
            : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-[12px] min-w-[640px]">
                  <thead><tr className="border-b border-gray-100"><Th>Etapa</Th><Th>Anuncio</Th><Th right>Frec.</Th><Th right>Gasto</Th><Th right>ROAS</Th><Th right>Compras</Th></tr></thead>
                  <tbody>
                    {below.active.map((a) => (
                      <tr key={a.ad_id} className="border-b border-gray-50">
                        <Td><StagePill s={a.stage} /></Td>
                        <Td><div className="text-[var(--ink)]">{a.ad_name}</div><div className="text-[11px] text-gray-400">{a.adset_name} · {a.campaign_name}</div></Td>
                        <Td right>{fmtX(a.frequency, 2).replace('×', '')}</Td>
                        <Td right>{fmtMoney(a.spend)}</Td>
                        <Td right className="text-[#dc2626] font-semibold">{fmtX(a.roas, 2)}</Td>
                        <Td right>{fmtInt(a.purchases)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        {below.paused.length > 0 && <p className="text-[11px] text-gray-400 mt-2">Ya pausados: {below.paused.length} anuncios bajo el corte ({fmtMoney(below.paused.reduce((s, a) => s + a.spend, 0))} en la semana).</p>}
      </Section>

      {/* Ganadores */}
      <Section
        title={`Ganadores de 90 días (${dayShort(winners.start)} → ${dayShort(winners.end)})`}
        sub={`Creativos con ROAS ≥ ${fmtX(data.cut, 2)} y al menos ${winners.min_purchases} compras, sumando todas sus copias. Al scaling se lleva el post de la copia que más gastó: así no se pierde la prueba social que ya juntó.`}
      >
        {winners.items.length === 0 ? <p className="text-sm text-gray-500">Ningún creativo cumple todavía.</p> : (
          <>
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-[12px] min-w-[720px]">
                <thead><tr className="border-b border-gray-100"><Th>Creativo</Th><Th right>Gasto</Th><Th right>ROAS</Th><Th right>Compras</Th><Th right>Copias</Th><Th>Post a llevar</Th></tr></thead>
                <tbody>
                  {winnersShown.map((w) => (
                    <tr key={w.main.ad_id} className="border-b border-gray-50">
                      <Td><div className="text-[var(--ink)] font-medium">{w.creative}</div><div className="text-[11px] text-gray-400">{w.main.campaign}{!w.main.active && ' · pausado'}</div></Td>
                      <Td right>{fmtMoney(w.spend)}</Td>
                      <Td right className="font-semibold text-[var(--accent-deep)]">{fmtX(w.roas, 2)}</Td>
                      <Td right>{fmtInt(w.purchases)}</Td>
                      <Td right>{w.copies > 1 ? <span className="text-amber-700 font-semibold">{w.copies}</span> : 1}</Td>
                      <Td><CopyId value={w.main.post_id} /></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {winners.items.length > 10 && (
              <button type="button" onClick={() => setShowAllWinners((o) => !o)} className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-[var(--ink)]">
                <ChevronDown className={`w-3.5 h-3.5 transition ${showAllWinners ? 'rotate-180' : ''}`} />{showAllWinners ? 'Ver menos' : `Ver los ${winners.items.length}`}
              </button>
            )}
            {winners.items.some((w) => w.copies > 1) && <p className="text-[11px] text-gray-400 mt-2">Copias en ámbar: el mismo creativo corre en varios conjuntos y cada copia junta likes y comentarios por separado. En el scaling va un solo post por creativo.</p>}
          </>
        )}
      </Section>

      {/* Estructura */}
      <Section
        title="Estructura de la cuenta"
        sub={`${fmtInt(structure.campaigns)} campañas y ${fmtInt(structure.adsets)} conjuntos con gasto en la semana.`}
        right={scalability && <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${SCALE[scalability.level]}`}>Escalabilidad {scalability.level} · {fmtX(scalability.ratio, 2)}</span>}
      >
        {scalability && <p className="text-[12px] text-gray-600 mb-3"><span className="text-gray-400">Estructura que toca:</span> {scalability.structure} <span className="text-gray-400">(Blended 30 días {fmtX(data.blended_30d, 2)} ÷ BER {fmtX(data.ber_net, 2)}, sin IVA.)</span></p>}
        {structure.alerts.length === 0 ? <p className="text-sm text-gray-500">Sin alertas de estructura.</p> : (
          <ul className="space-y-2">
            {structure.alerts.map((al) => (
              <li key={al.key} className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] text-amber-900">
                <div className="flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /><div className="min-w-0">
                  <div className="font-semibold">{al.title}{al.spend ? ` · ${fmtMoney(al.spend)}` : ''}</div>
                  <div className="text-amber-800/80">{al.detail}</div>
                  <div className="mt-1 text-[11px] text-amber-800/70 break-words">{al.items.slice(0, 8).join(' · ')}{al.items.length > 8 ? ` · y ${al.items.length - 8} más` : ''}</div>
                </div></div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Detalle por anuncio */}
      <div className="mt-5 pt-4 border-t border-gray-100">
        <button type="button" onClick={() => setShowAds((o) => !o)} className="inline-flex items-center gap-1 text-[12px] font-medium text-gray-500 hover:text-[var(--ink)]">
          <ChevronDown className={`w-3.5 h-3.5 transition ${showAds ? 'rotate-180' : ''}`} /> Detalle por anuncio ({fmtInt(data.ads.length)})
        </button>
        {showAds && (
          <div className="overflow-x-auto -mx-2 mt-2">
            <table className="w-full text-[12px] min-w-[720px]">
              <thead><tr className="border-b border-gray-100"><Th>Etapa</Th><Th>Anuncio</Th><Th right>Frec.</Th><Th right>Gasto</Th><Th right>ROAS</Th><Th right>Compras</Th><Th right>Hook</Th></tr></thead>
              <tbody>
                {data.ads.map((a) => (
                  <tr key={a.ad_id} className={`border-b border-gray-50 ${a.paused ? 'opacity-50' : ''}`}>
                    <Td><StagePill s={a.stage} /></Td>
                    <Td><div className="text-[var(--ink)]">{a.ad_name}</div><div className="text-[11px] text-gray-400">{a.adset_name}{a.paused ? ' · pausado' : ''}</div></Td>
                    <Td right>{fmtX(a.frequency, 2).replace('×', '')}</Td>
                    <Td right>{fmtMoney(a.spend)}</Td>
                    <Td right className={data.cut && a.roas < data.cut ? 'text-[#dc2626]' : ''}>{fmtX(a.roas, 2)}</Td>
                    <Td right>{fmtInt(a.purchases)}</Td>
                    <Td right>{fmtPctNum(a.hook_rate, 1)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
