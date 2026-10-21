import teamInvite from './team-invite.js';
import pinReset from './pin-reset.js';
import portalInvite from './portal-invite.js';
import trialWelcome from './trial-welcome.js';
import trialEnding from './trial-ending.js';
import taskAssigned from './task-assigned.js';
import invoiceSent from './invoice-sent.js';
import paymentApproved from './payment-approved.js'; // [billing]

/** Registro de plantillas: nombre → { subject(data), body(data), sample } */
export const templates = {
  'team-invite': { ...teamInvite, label: 'Invitación al equipo', audience: 'Equipo' },
  'pin-reset': { ...pinReset, label: 'Recuperar PIN', audience: 'Equipo' },
  'portal-invite': { ...portalInvite, label: 'Acceso al portal', audience: 'Cliente' },
  'trial-welcome': { ...trialWelcome, label: 'Bienvenida (prueba)', audience: 'Agencia' },
  'trial-ending': { ...trialEnding, label: 'Fin de prueba', audience: 'Agencia' },
  'task-assigned': { ...taskAssigned, label: 'Tarea asignada', audience: 'Equipo' },
  'invoice-sent': { ...invoiceSent, label: 'Factura enviada', audience: 'Cliente' },
  'payment-approved': { ...paymentApproved, label: 'Pago confirmado', audience: 'Agencia' }, // [billing]
};

export const templateNames = Object.keys(templates);
