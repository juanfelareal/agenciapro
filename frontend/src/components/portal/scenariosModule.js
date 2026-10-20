/**
 * Detección segura del módulo "Escenarios" del dashboard financiero
 * (`components/growth/financial/ScenariosTab.jsx`, lo crea otro equipo).
 * `import.meta.glob` devuelve {} cuando el archivo no existe, así el build nunca se rompe.
 */
const modules = import.meta.glob('../growth/financial/ScenariosTab.jsx');

/** Loader perezoso del módulo (para React.lazy) o null si no existe. */
export const scenariosLoader = Object.values(modules)[0] || null;

/** true si existe el módulo de escenarios (para decidir si se muestra la pestaña). */
export const hasScenariosTab = Boolean(scenariosLoader);
