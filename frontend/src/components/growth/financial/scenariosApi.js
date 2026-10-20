/**
 * Adaptador de la API de escenarios para el equipo (growthAPI). ScenariosTab recibe este objeto
 * como prop `api`; el portal del cliente puede pasar otro con la misma forma.
 * Cada función devuelve directamente el JSON (sin `.data`).
 */
import { growthAPI } from '../../../utils/api';

export const teamScenariosApi = (clientId) => ({
  list: (params) => growthAPI.scenarios(clientId, params).then((r) => r.data),
  create: (body) => growthAPI.createScenario(clientId, body).then((r) => r.data),
  update: (id, body) => growthAPI.updateScenario(clientId, id, body).then((r) => r.data),
  remove: (id) => growthAPI.deleteScenario(clientId, id).then((r) => r.data),
  evaluate: (body) => growthAPI.evaluateScenario(clientId, body).then((r) => r.data),
  compare: (ids, period) => growthAPI.compareScenarios(clientId, ids, period).then((r) => r.data),
});
