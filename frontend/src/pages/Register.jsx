/**
 * Registro autoservicio de agencias — 6 pasos, 3 minutos.
 *   1 Tu cuenta · 2 Tu agencia · 3 Tu plan · 4 Módulos · 5 Tu equipo · 6 Listo
 * Dos columnas en escritorio (formulario + preview en vivo oscuro), una en móvil.
 * Estilos propios en ./register/register.css (tokens --rg-*).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle, ArrowLeft, ArrowRight, Check, Eye, EyeOff, Loader2, Lock, Mail, Plus, ShieldCheck,
  Trash2, Upload, User, X, Building2, PartyPopper, Info,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authAPI, teamAPI, setAuthToken } from '../utils/api';
import OrbitLogo from '../components/OrbitLogo';
import {
  AGENCY_TYPES, TEAM_SIZES, PLANS, ACCENT_PRESETS, MODULES, MODULE_GROUPS, defaultModulesFor, formatCOP, initialsOf,
} from '../components/onboarding/modules';
import LivePreview, { LivePreviewMobile } from './register/LivePreview';
import './register/register.css';

const STEPS = [
  { id: 'account', label: 'Cuenta' },
  { id: 'agency', label: 'Agencia' },
  { id: 'plan', label: 'Plan' },
  { id: 'modules', label: 'Módulos' },
  { id: 'team', label: 'Equipo' },
  { id: 'done', label: 'Listo' },
];
const MAX_INVITES = 5;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());
const randomPin = () => String(Math.floor(100000 + Math.random() * 900000));
const nameFromEmail = (email) =>
  String(email).split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim() || 'Nuevo miembro';

/** Permisos por pestaña para miembros invitados, derivados de los módulos activos (admins ven todo). */
const permissionsFor = (modules, role) => {
  if (role === 'admin') return undefined;
  const m = modules || {};
  return {
    dashboard: true,
    clients: !!m.clients, crm: !!m.crm, projects: !!m.projects, plantillas: !!m.projects,
    tasks: !!m.tasks, calendario: !!m.tasks, metricas: !!(m.metricas || m.finanzas), reportes: !!m.metricas,
    invoices: !!m.invoices, expenses: !!m.expenses, comisiones: false, siigo: false, team: false, automatizaciones: false,
    notas: !!m.notas, formularios: !!m.formularios, sops: !!m.sops, ugc: !!m.ugc, documentos: !!m.documentos,
  };
};

/** Logo → canvas (máx. 512 px, "contain" o recorte cuadrado "cover") → data URL < 500 KB. */
const loadImage = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No pudimos leer la imagen')); };
  img.src = url;
});
const processLogo = async (file, fit) => {
  const img = await loadImage(file);
  const S = 512;
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error('La imagen no tiene dimensiones válidas');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (fit === 'cover') {
    canvas.width = S; canvas.height = S;
    const s = Math.max(S / w, S / h);
    const dw = w * s, dh = h * s;
    ctx.drawImage(img, (S - dw) / 2, (S - dh) / 2, dw, dh);
  } else {
    const s = Math.min(1, S / Math.max(w, h));
    canvas.width = Math.max(1, Math.round(w * s));
    canvas.height = Math.max(1, Math.round(h * s));
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }
  let out = canvas.toDataURL('image/png');
  if (out.length > 650000) out = canvas.toDataURL('image/jpeg', 0.85);
  if (out.length > 650000) out = canvas.toDataURL('image/jpeg', 0.6);
  return out;
};

const FieldError = ({ msg }) => (msg ? <span className="rg-error"><AlertCircle /> {msg}</span> : null);

const Register = () => {
  const { isAuthenticated, loading: authLoading, checkAuth } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planFromUrl = (searchParams.get('plan') || '').toLowerCase();

  const [step, setStep] = useState(1);
  const [justRegistered, setJustRegistered] = useState(false);

  // Paso 1
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [showPin, setShowPin] = useState(false);
  // Paso 2
  const [orgName, setOrgName] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [logo, setLogo] = useState(null);
  const [logoFit, setLogoFit] = useState('contain');
  const [logoError, setLogoError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [accent, setAccent] = useState('#44BF47');
  const [hexDraft, setHexDraft] = useState('#44BF47');
  const [teamSize, setTeamSize] = useState('');
  const [agencyType, setAgencyType] = useState('');
  // Paso 3
  const [planId, setPlanId] = useState(PLANS.some((p) => p.id === planFromUrl) ? planFromUrl : 'growth');
  // Paso 4
  const [modules, setModules] = useState(() => defaultModulesFor('mixta'));
  const [modulesTouched, setModulesTouched] = useState(false);
  // Paso 5
  const [invites, setInvites] = useState([{ email: '', role: 'member' }]);
  // Envío
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [inviteResults, setInviteResults] = useState([]);
  const [trialEndsAt, setTrialEndsAt] = useState(null);

  const [touched, setTouched] = useState({});
  const touch = (k) => setTouched((t) => ({ ...t, [k]: true }));
  const formRef = useRef(null);

  // Preselección de módulos según tipo de agencia (hasta que el usuario los personalice)
  useEffect(() => {
    if (agencyType && !modulesTouched) setModules(defaultModulesFor(agencyType));
  }, [agencyType, modulesTouched]);

  // Reprocesar el logo si cambia el encuadre
  useEffect(() => {
    if (!logoFile) return;
    let cancelled = false;
    processLogo(logoFile, logoFit)
      .then((url) => { if (!cancelled) setLogo(url); })
      .catch((e) => { if (!cancelled) setLogoError(e.message); });
    return () => { cancelled = true; };
  }, [logoFile, logoFit]);

  useEffect(() => {
    document.title = step === 6 ? 'Listo · Orbit' : 'Crear cuenta · Orbit';
    return () => { document.title = 'Orbit'; };
  }, [step]);

  // Validaciones por paso
  const errors = useMemo(() => {
    const e = {};
    if (name.trim().length < 2) e.name = 'Escribe tu nombre completo.';
    if (!isEmail(email)) e.email = 'Escribe un correo válido.';
    if (!/^\d{4,6}$/.test(pin)) e.pin = 'El PIN debe tener entre 4 y 6 dígitos.';
    if (pin && pin2 !== pin) e.pin2 = 'Los PIN no coinciden.';
    if (orgName.trim().length < 2) e.orgName = 'Escribe el nombre de tu agencia.';
    if (!HEX_RE.test(accent)) e.accent = 'Usa un color hex, por ejemplo #44BF47.';
    if (!teamSize) e.teamSize = 'Elige el tamaño de tu equipo.';
    if (!agencyType) e.agencyType = 'Elige el tipo de agencia.';
    if (!Object.values(modules).some(Boolean)) e.modules = 'Activa al menos un módulo.';
    const seen = new Set([email.trim().toLowerCase()]);
    invites.forEach((inv, i) => {
      const v = inv.email.trim().toLowerCase();
      if (!v) return;
      if (!isEmail(v)) e[`invite_${i}`] = 'Correo inválido.';
      else if (seen.has(v)) e[`invite_${i}`] = v === email.trim().toLowerCase() ? 'Ese es tu propio correo.' : 'Correo repetido.';
      seen.add(v);
    });
    return e;
  }, [name, email, pin, pin2, orgName, accent, teamSize, agencyType, modules, invites]);

  const STEP_FIELDS = {
    1: ['name', 'email', 'pin', 'pin2'],
    2: ['orgName', 'accent', 'teamSize', 'agencyType'],
    3: [],
    4: ['modules'],
    5: invites.map((_, i) => `invite_${i}`),
  };
  const stepValid = (s) => (STEP_FIELDS[s] || []).every((k) => !errors[k]);
  const show = (k) => (touched[k] ? errors[k] : undefined);

  const focusFirstInvalid = () => {
    requestAnimationFrame(() => {
      const el = formRef.current?.querySelector('.is-invalid, [data-invalid="true"]');
      if (el?.focus) el.focus();
    });
  };

  const goNext = () => {
    setError('');
    if (!stepValid(step)) {
      setTouched((t) => ({ ...t, ...Object.fromEntries((STEP_FIELDS[step] || []).map((k) => [k, true])) }));
      focusFirstInvalid();
      return;
    }
    if (step === 5) { submit(); return; }
    setStep((s) => Math.min(6, s + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const goBack = () => { setError(''); setStep((s) => Math.max(1, s - 1)); };

  const onKeyDownRoot = (e) => {
    if (e.key !== 'Enter' || e.shiftKey || submitting || step === 6) return;
    const tag = e.target?.tagName;
    if (tag === 'BUTTON' || tag === 'A' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    e.preventDefault();
    goNext();
  };

  // Logo
  const acceptLogo = (file) => {
    setLogoError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) { setLogoError('Solo imágenes (PNG, JPG, SVG o WebP).'); return; }
    if (file.size > 8 * 1024 * 1024) { setLogoError('Máximo 8 MB. La comprimimos nosotros, pero no tanto.'); return; }
    setLogoFile(file);
  };
  const clearLogo = () => { setLogoFile(null); setLogo(null); setLogoError(''); };

  const onHex = (v) => {
    const val = v.startsWith('#') ? v : `#${v}`;
    setHexDraft(val.toUpperCase().slice(0, 7));
    if (HEX_RE.test(val)) setAccent(val.toUpperCase());
  };
  const pickAccent = (hex) => { setAccent(hex); setHexDraft(hex); };

  const toggleModule = (key) => {
    setModulesTouched(true);
    setModules((m) => ({ ...m, [key]: !m[key] }));
  };
  const setAllModules = (on) => {
    setModulesTouched(true);
    setModules(Object.fromEntries(MODULES.map((m) => [m.key, on])));
  };
  const resetModules = () => { setModulesTouched(false); setModules(defaultModulesFor(agencyType || 'mixta')); };
  const activeCount = Object.values(modules).filter(Boolean).length;

  const updateInvite = (i, patch) => setInvites((list) => list.map((inv, idx) => (idx === i ? { ...inv, ...patch } : inv)));
  const addInvite = () => setInvites((list) => (list.length < MAX_INVITES ? [...list, { email: '', role: 'member' }] : list));
  const removeInvite = (i) => setInvites((list) => (list.length === 1 ? [{ email: '', role: 'member' }] : list.filter((_, idx) => idx !== i)));
  const validInvites = invites.filter((inv) => isEmail(inv.email));

  const submit = useCallback(async (skipInvites = false) => {
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        pin,
        org_name: orgName.trim(),
        plan: planId,
        branding: { accent, theme: 'light' },
        modules,
        agency_type: agencyType,
        team_size: teamSize,
        onboarding: { business_type: agencyType, team_size: teamSize },
      };
      if (logo) payload.logo_base64 = logo;

      const { data } = await authAPI.register(payload);
      const { token, user, current_org } = data;
      localStorage.setItem('authToken', token);
      localStorage.setItem('authUser', JSON.stringify(user));
      if (current_org) localStorage.setItem('currentOrg', JSON.stringify(current_org));
      setAuthToken(token);
      setTrialEndsAt(current_org?.trial_ends_at || null);

      const results = [];
      if (!skipInvites) {
        for (const inv of validInvites) {
          const invEmail = inv.email.trim().toLowerCase();
          try {
            await teamAPI.create({
              name: nameFromEmail(invEmail),
              email: invEmail,
              role: inv.role,
              pin: randomPin(),
              send_email: true,
              permissions: permissionsFor(modules, inv.role),
            });
            results.push({ email: invEmail, role: inv.role, ok: true });
          } catch (e) {
            results.push({ email: invEmail, role: inv.role, ok: false, error: e.response?.data?.error || 'No se pudo invitar' });
          }
        }
      }
      setInviteResults(results);
      setJustRegistered(true);
      setStep(6);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.response?.data?.error || 'No pudimos crear la cuenta. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }, [name, email, pin, orgName, planId, accent, modules, agencyType, teamSize, logo, validInvites]);

  const enterOrbit = () => {
    // El token ya quedó guardado al registrar; refrescamos la sesión sin bloquear la navegación
    // (si checkAuth tarda o falla, ProtectedRoute vuelve a validar al entrar).
    Promise.resolve().then(() => checkAuth()).catch(() => {});
    navigate('/app?tour=1', { replace: true });
  };

  const previewData = { name, orgName, logo, logoFit, accent: HEX_RE.test(accent) ? accent : '#44BF47', planId, modules, invites, step };
  const selectedPlan = PLANS.find((p) => p.id === planId) || PLANS[1];

  if (authLoading) {
    return (
      <div className="rg"><div className="rg-gate"><Loader2 className="rg-spin" size={24} /></div></div>
    );
  }
  if (isAuthenticated && !justRegistered) {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="rg" style={{ '--rg-accent': previewData.accent }} onKeyDown={onKeyDownRoot}>
      <div className="rg-form-col">
        <header className="rg-top">
          <Link to="/" aria-label="Ir al inicio"><OrbitLogo size={30} /></Link>
          {step < 6 && <p className="rg-top__login">¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p>}
        </header>

        <main className="rg-body" ref={formRef}>
          {step < 6 && (
            <div className="rg-progress" aria-label={`Paso ${step} de 5`}>
              <div className="rg-progress__meta">
                <span className="rg-progress__step">PASO {step} / 5</span>
                <span className="rg-progress__time"><b>~3 min</b> en total · sin tarjeta</span>
              </div>
              <div className="rg-progress__bar">
                {STEPS.map((s, i) => (
                  <span key={s.id} className={`rg-progress__seg ${i + 1 < step ? 'is-done' : ''} ${i + 1 === step ? 'is-current' : ''}`} />
                ))}
              </div>
              <div className="rg-progress__labels">
                {STEPS.map((s, i) => <span key={s.id} className={i + 1 === step ? 'is-current' : ''}>{s.label}</span>)}
              </div>
            </div>
          )}

          {(step === 2 || step === 4 || step === 5) && <LivePreviewMobile data={previewData} />}

          {/* ---------------- Paso 1: Tu cuenta ---------------- */}
          {step === 1 && (
            <form className="rg-step" onSubmit={(e) => { e.preventDefault(); goNext(); }} noValidate>
              <p className="rg-eyebrow">Tu cuenta</p>
              <h1 className="rg-h1">Empecemos por ti.</h1>
              <p className="rg-lead">Serás la persona administradora de la agencia en Orbit. Entras con tu correo y un PIN corto: sin contraseñas que olvidar.</p>
              <div className="rg-fields">
                <div className="rg-field">
                  <label className="rg-label" htmlFor="rg-name">Tu nombre</label>
                  <div className="rg-control">
                    <User />
                    <input id="rg-name" className={`rg-input ${show('name') ? 'is-invalid' : ''}`} value={name} onChange={(e) => setName(e.target.value)} onBlur={() => touch('name')} placeholder="Juan Pérez" autoComplete="name" autoFocus />
                  </div>
                  <FieldError msg={show('name')} />
                </div>
                <div className="rg-field">
                  <label className="rg-label" htmlFor="rg-email">Correo de trabajo</label>
                  <div className="rg-control">
                    <Mail />
                    <input id="rg-email" type="email" className={`rg-input ${show('email') ? 'is-invalid' : ''}`} value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => touch('email')} placeholder="tu@agencia.com" autoComplete="email" inputMode="email" />
                  </div>
                  <FieldError msg={show('email')} />
                </div>
                <div className="rg-row-2">
                  <div className="rg-field">
                    <label className="rg-label" htmlFor="rg-pin">PIN <small>4 a 6 dígitos</small></label>
                    <div className="rg-control">
                      <Lock />
                      <input id="rg-pin" type={showPin ? 'text' : 'password'} className={`rg-input rg-input--mono ${show('pin') ? 'is-invalid' : ''}`} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} onBlur={() => touch('pin')} placeholder="••••" inputMode="numeric" autoComplete="new-password" />
                      <button type="button" className="rg-control__btn" onClick={() => setShowPin((v) => !v)} aria-label={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}>{showPin ? <EyeOff /> : <Eye />}</button>
                    </div>
                    <FieldError msg={show('pin')} />
                  </div>
                  <div className="rg-field">
                    <label className="rg-label" htmlFor="rg-pin2">Confirma el PIN</label>
                    <div className="rg-control">
                      <Lock />
                      <input id="rg-pin2" type={showPin ? 'text' : 'password'} className={`rg-input rg-input--mono ${show('pin2') ? 'is-invalid' : ''}`} value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, '').slice(0, 6))} onBlur={() => touch('pin2')} placeholder="••••" inputMode="numeric" autoComplete="new-password" />
                      {pin && pin2 === pin && <span className="rg-control__btn rg-ok" aria-hidden="true"><Check /></span>}
                    </div>
                    <FieldError msg={show('pin2')} />
                  </div>
                </div>
                <p className="rg-hint">Lo usarás para entrar a Orbit. Puedes cambiarlo después en Mi Cuenta.</p>
              </div>
              <StepActions step={step} onBack={goBack} submitting={submitting} />
            </form>
          )}

          {/* ---------------- Paso 2: Tu agencia ---------------- */}
          {step === 2 && (
            <form className="rg-step" onSubmit={(e) => { e.preventDefault(); goNext(); }} noValidate>
              <p className="rg-eyebrow">Tu agencia</p>
              <h1 className="rg-h1">Ahora, tu agencia.</h1>
              <p className="rg-lead">Nombre, logo y color: así Orbit se ve como <b>tu</b> herramienta cuando tu equipo y tus clientes entren.</p>
              <div className="rg-fields">
                <div className="rg-field">
                  <label className="rg-label" htmlFor="rg-org">Nombre de la agencia</label>
                  <div className="rg-control">
                    <Building2 />
                    <input id="rg-org" className={`rg-input ${show('orgName') ? 'is-invalid' : ''}`} value={orgName} onChange={(e) => setOrgName(e.target.value)} onBlur={() => touch('orgName')} placeholder="LA REAL Marketing" autoComplete="organization" autoFocus />
                  </div>
                  <FieldError msg={show('orgName')} />
                </div>

                <div className="rg-field">
                  <span className="rg-label">Logo <small>opcional · PNG, JPG, SVG</small></span>
                  <div className="rg-logo-row">
                    <div className="rg-logo-preview">
                      {logo ? <img src={logo} alt="Logo de la agencia" className={logoFit === 'cover' ? 'is-cover' : ''} /> : <span className="rg-logo-preview__mono">{initialsOf(orgName, 'O')}</span>}
                    </div>
                    <div style={{ display: 'grid', gap: 8 }}>
                      <label
                        className={`rg-drop ${dragOver ? 'is-over' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={(e) => { e.preventDefault(); setDragOver(false); acceptLogo(e.dataTransfer.files?.[0]); }}
                      >
                        <input type="file" accept="image/*" onChange={(e) => { acceptLogo(e.target.files?.[0]); e.target.value = ''; }} aria-label="Subir logo" />
                        <span className="rg-drop__inner">
                          <Upload />
                          <span><b>{logo ? 'Cambiar logo' : 'Arrastra tu logo aquí'}</b><br />o haz clic para buscarlo</span>
                        </span>
                      </label>
                      {logo && (
                        <div className="rg-logo-tools">
                          <span className="rg-seg" role="group" aria-label="Encuadre del logo">
                            <button type="button" className={logoFit === 'contain' ? 'is-on' : ''} onClick={() => setLogoFit('contain')}>Completo</button>
                            <button type="button" className={logoFit === 'cover' ? 'is-on' : ''} onClick={() => setLogoFit('cover')}>Recorte cuadrado</button>
                          </span>
                          <button type="button" className="rg-link-btn" onClick={clearLogo}><Trash2 /> Quitar</button>
                        </div>
                      )}
                    </div>
                  </div>
                  <FieldError msg={logoError} />
                </div>

                <div className="rg-field">
                  <span className="rg-label">Color de acento</span>
                  <div className="rg-swatches">
                    {ACCENT_PRESETS.map((p) => (
                      <button type="button" key={p.hex} className={`rg-swatch ${accent === p.hex ? 'is-on' : ''}`} style={{ background: p.hex }} onClick={() => pickAccent(p.hex)} title={p.name} aria-label={p.name} aria-pressed={accent === p.hex}>
                        {accent === p.hex && <Check />}
                      </button>
                    ))}
                    <label className={`rg-hex ${show('accent') ? 'is-invalid' : ''}`}>
                      <i aria-hidden="true" />
                      <input value={hexDraft} onChange={(e) => onHex(e.target.value)} onBlur={() => touch('accent')} spellCheck={false} aria-label="Color hex" />
                    </label>
                  </div>
                  <FieldError msg={show('accent')} />
                </div>

                <div className="rg-field">
                  <span className="rg-label">¿Cuántas personas son?</span>
                  <div className="rg-choice-grid rg-choice-grid--4" role="radiogroup" data-invalid={show('teamSize') ? 'true' : undefined} tabIndex={-1}>
                    {TEAM_SIZES.map((t) => (
                      <button type="button" key={t.id} role="radio" aria-checked={teamSize === t.id} className={`rg-choice rg-choice--compact ${teamSize === t.id ? 'is-selected' : ''}`} onClick={() => { setTeamSize(t.id); touch('teamSize'); }}>
                        <span className="rg-choice__name">{t.label}</span>
                      </button>
                    ))}
                  </div>
                  <FieldError msg={show('teamSize')} />
                </div>

                <div className="rg-field">
                  <span className="rg-label">Tipo de agencia <small>define los módulos sugeridos</small></span>
                  <div className="rg-choice-grid" role="radiogroup" data-invalid={show('agencyType') ? 'true' : undefined} tabIndex={-1}>
                    {AGENCY_TYPES.map((t) => (
                      <button type="button" key={t.id} role="radio" aria-checked={agencyType === t.id} className={`rg-choice ${agencyType === t.id ? 'is-selected' : ''}`} onClick={() => { setAgencyType(t.id); touch('agencyType'); }}>
                        <span className="rg-choice__name">{t.name} <Check /></span>
                        <span className="rg-choice__desc">{t.desc}</span>
                      </button>
                    ))}
                  </div>
                  <FieldError msg={show('agencyType')} />
                </div>
              </div>
              <StepActions step={step} onBack={goBack} submitting={submitting} />
            </form>
          )}

          {/* ---------------- Paso 3: Tu plan ---------------- */}
          {step === 3 && (
            <form className="rg-step" onSubmit={(e) => { e.preventDefault(); goNext(); }} noValidate>
              <p className="rg-eyebrow">Tu plan</p>
              <h1 className="rg-h1">Elige un plan. Pruébalo gratis.</h1>
              <p className="rg-lead">Todos incluyen implementación acompañada por LA REAL. Precios en COP por mes, más IVA.</p>
              <span className="rg-trial"><ShieldCheck /> 14 días gratis · sin tarjeta · cancelas cuando quieras</span>
              <div className="rg-plans" role="radiogroup" aria-label="Planes">
                {PLANS.map((p) => (
                  <button type="button" key={p.id} role="radio" aria-checked={planId === p.id} className={`rg-plan ${planId === p.id ? 'is-selected' : ''}`} onClick={() => setPlanId(p.id)}>
                    {p.badge && <span className="rg-plan__badge">{p.badge}</span>}
                    <span className="rg-plan__head">
                      <span className="rg-plan__name">{p.name}</span>
                      <span className="rg-plan__check"><Check /></span>
                    </span>
                    <span className="rg-plan__for">{p.for}</span>
                    <span className="rg-plan__price"><span className="rg-plan__amount">{formatCOP(p.price)}</span><span className="rg-plan__period">COP / mes</span></span>
                    <span className="rg-plan__iva">+ IVA</span>
                    <ul className="rg-plan__list">
                      {p.features.map((f) => <li key={f}><Check /><span>{f}</span></li>)}
                    </ul>
                  </button>
                ))}
              </div>
              <p className="rg-plans__note">Al terminar la prueba te escribimos para activar el plan. Si no te sirve, no pagas nada y tus datos se pueden exportar.</p>
              <StepActions step={step} onBack={goBack} submitting={submitting} nextLabel={`Seguir con ${selectedPlan.name}`} />
            </form>
          )}

          {/* ---------------- Paso 4: Módulos ---------------- */}
          {step === 4 && (
            <form className="rg-step" onSubmit={(e) => { e.preventDefault(); goNext(); }} noValidate>
              <p className="rg-eyebrow">Módulos</p>
              <h1 className="rg-h1">¿Qué va a usar tu agencia?</h1>
              <p className="rg-lead">
                Preseleccionamos lo típico de una agencia <b>{(AGENCY_TYPES.find((t) => t.id === agencyType) || {}).name?.toLowerCase() || 'mixta'}</b>. Enciende o apaga lo que quieras: el menú solo muestra lo activo. Se puede cambiar después en <b>Configuración → Módulos</b>.
              </p>
              <div className="rg-mod-summary">
                <span><b>{activeCount}</b> de {MODULES.length} módulos activos</span>
                <span className="rg-mod-summary__btns">
                  <button type="button" onClick={() => setAllModules(true)}>Todos</button>
                  <button type="button" onClick={() => setAllModules(false)}>Ninguno</button>
                  <button type="button" onClick={resetModules}>Sugeridos</button>
                </span>
              </div>
              {MODULE_GROUPS.map((g) => (
                <div className="rg-mod-group" key={g}>
                  <p className="rg-mod-group__title">{g}</p>
                  <div className="rg-mod-list">
                    {MODULES.filter((m) => m.group === g).map((m) => {
                      const Icon = m.icon;
                      const on = !!modules[m.key];
                      return (
                        <button type="button" key={m.key} role="switch" aria-checked={on} className={`rg-mod ${on ? 'is-on' : ''}`} onClick={() => toggleModule(m.key)}>
                          <span className="rg-mod__icon"><Icon /></span>
                          <span>
                            <span className="rg-mod__name">{m.name}</span>
                            <span className="rg-mod__desc" style={{ display: 'block' }}>{m.desc}</span>
                          </span>
                          <span className={`rg-switch ${on ? 'is-on' : ''}`} aria-hidden="true" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {show('modules') && <div className="rg-alert"><AlertCircle /> {errors.modules}</div>}
              <StepActions step={step} onBack={goBack} submitting={submitting} />
            </form>
          )}

          {/* ---------------- Paso 5: Tu equipo ---------------- */}
          {step === 5 && (
            <form className="rg-step" onSubmit={(e) => { e.preventDefault(); goNext(); }} noValidate>
              <p className="rg-eyebrow">Tu equipo</p>
              <h1 className="rg-h1">Invita a tu equipo.</h1>
              <p className="rg-lead">Hasta {MAX_INVITES} personas por ahora. Cada una recibe un correo con su acceso y un PIN propio. Puedes saltarte este paso y hacerlo después en <b>Equipo</b>.</p>
              <div className="rg-invites">
                {invites.map((inv, i) => (
                  <div key={i}>
                    <div className="rg-invite">
                      <input type="email" className={`rg-input ${show(`invite_${i}`) ? 'is-invalid' : ''}`} value={inv.email} onChange={(e) => updateInvite(i, { email: e.target.value })} onBlur={() => touch(`invite_${i}`)} placeholder={i === 0 ? 'colega@agencia.com' : 'otra@agencia.com'} aria-label={`Correo de la persona ${i + 1}`} inputMode="email" autoFocus={i === 0} />
                      <select className="rg-select" value={inv.role} onChange={(e) => updateInvite(i, { role: e.target.value })} aria-label="Rol">
                        <option value="member">Miembro</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button type="button" className="rg-icon-btn" onClick={() => removeInvite(i)} aria-label="Quitar"><X /></button>
                    </div>
                    <FieldError msg={show(`invite_${i}`)} />
                  </div>
                ))}
                <button type="button" className="rg-add" onClick={addInvite} disabled={invites.length >= MAX_INVITES}><Plus /> Agregar otra persona</button>
              </div>
              <div className="rg-roles-help">
                <span><b>Admin:</b> ve y configura todo, incluidas finanzas, equipo y módulos.</span>
                <span><b>Miembro:</b> solo las pestañas que activaste; luego afinas permisos persona por persona en Equipo.</span>
              </div>
              {error && <div className="rg-alert" role="alert"><AlertCircle /> {error}</div>}
              <div className="rg-actions">
                <button type="button" className="rg-btn rg-btn--text" onClick={goBack} disabled={submitting}><ArrowLeft /> Atrás</button>
                <div className="rg-actions__right">
                  <button type="button" className="rg-btn rg-btn--ghost" onClick={() => { if (stepValid(1) && stepValid(2) && stepValid(4)) submit(true); }} disabled={submitting}>Omitir por ahora</button>
                  <button type="submit" className="rg-btn rg-btn--green" disabled={submitting}>
                    {submitting ? <><Loader2 className="rg-spin" /> Creando tu Orbit…</> : <>{validInvites.length ? `Invitar a ${validInvites.length} y crear mi cuenta` : 'Crear mi cuenta'} <ArrowRight /></>}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ---------------- Paso 6: Listo ---------------- */}
          {step === 6 && (
            <section className="rg-step" aria-live="polite">
              <div className="rg-done-badge"><PartyPopper /></div>
              <p className="rg-eyebrow">Listo</p>
              <h1 className="rg-h1">{orgName} ya está en Orbit.</h1>
              <p className="rg-lead">Tu organización quedó creada con tu marca, tu plan en prueba y los módulos que elegiste. Lo que sigue es conectar tu primera marca: te guiamos adentro.</p>
              <div className="rg-summary">
                <div className="rg-summary__row"><span className="rg-summary__k">Agencia</span><span className="rg-summary__v">{orgName} <span className="rg-chip"><i style={{ display: 'none' }} />{(AGENCY_TYPES.find((t) => t.id === agencyType) || {}).name}</span></span></div>
                <div className="rg-summary__row"><span className="rg-summary__k">Administrador</span><span className="rg-summary__v">{name} · {email.trim().toLowerCase()}</span></div>
                <div className="rg-summary__row"><span className="rg-summary__k">Plan</span><span className="rg-summary__v">{selectedPlan.name} · {formatCOP(selectedPlan.price)} + IVA / mes <span className="rg-chip rg-chip--ok"><ShieldCheck /> Gratis hasta {trialEndsAt ? new Date(trialEndsAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' }) : 'dentro de 14 días'}</span></span></div>
                <div className="rg-summary__row"><span className="rg-summary__k">Marca</span><span className="rg-summary__v"><i aria-hidden="true" /> {accent} {logo ? '· logo cargado' : '· sin logo (puedes subirlo en Mi Cuenta)'}</span></div>
                <div className="rg-summary__row"><span className="rg-summary__k">Módulos</span><span className="rg-summary__v">{activeCount} activos: {MODULES.filter((m) => modules[m.key]).map((m) => m.name).join(', ')}</span></div>
                <div className="rg-summary__row">
                  <span className="rg-summary__k">Equipo</span>
                  <span className="rg-summary__v">
                    {inviteResults.length === 0 && 'Solo tú por ahora'}
                    {inviteResults.map((r) => (
                      <span key={r.email} className={`rg-chip ${r.ok ? 'rg-chip--ok' : 'rg-chip--warn'}`} title={r.ok ? 'Invitación enviada' : r.error}>
                        {r.ok ? <Check /> : <AlertCircle />} {r.email}
                      </span>
                    ))}
                  </span>
                </div>
              </div>
              {inviteResults.some((r) => !r.ok) && (
                <p className="rg-done-next"><Info size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> Algunas invitaciones no salieron ({inviteResults.filter((r) => !r.ok).map((r) => r.error).join('; ')}). Puedes reintentarlas desde Equipo.</p>
              )}
              <p className="rg-done-next">Al entrar verás un tour corto por cada pestaña y una lista de primeros pasos en el Dashboard.</p>
              <div className="rg-actions" style={{ borderTop: 0, paddingTop: 8 }}>
                <div className="rg-actions__right">
                  <button type="button" className="rg-btn rg-btn--primary rg-btn--lg" onClick={enterOrbit} disabled={submitting}>
                    {submitting ? <Loader2 className="rg-spin" /> : <>Entrar a Orbit <ArrowRight /></>}
                  </button>
                </div>
              </div>
            </section>
          )}

          <footer className="rg-foot">
            <span>Orbit · construido por LA REAL · Colombia</span>
            <a href="mailto:juanfe@larealmarketing.com?subject=Ayuda%20con%20el%20registro%20de%20Orbit">¿Necesitas ayuda?</a>
          </footer>
        </main>
      </div>

      <LivePreview data={previewData} />
    </div>
  );
};

const StepActions = ({ step, onBack, submitting, nextLabel = 'Continuar' }) => (
  <div className="rg-actions">
    {step > 1 ? (
      <button type="button" className="rg-btn rg-btn--text" onClick={onBack} disabled={submitting}><ArrowLeft /> Atrás</button>
    ) : <span />}
    <div className="rg-actions__right">
      <span className="rg-enter-hint"><kbd>Enter</kbd> para continuar</span>
      <button type="submit" className="rg-btn rg-btn--primary" disabled={submitting}>{nextLabel} <ArrowRight /></button>
    </div>
  </div>
);

export default Register;
