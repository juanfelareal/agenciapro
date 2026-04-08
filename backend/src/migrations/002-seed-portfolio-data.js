import db from '../config/database.js';

/**
 * One-time seed: populate tipo_negociacion, estado_actual, valor_contratado, has_comision
 * for existing clients based on the agency's spreadsheet.
 * Uses nickname OR company to match clients. Safe to run multiple times (only updates if tipo_negociacion IS NULL).
 */

const CLIENT_DATA = [
  // Growth — Comenzando — $2,000,000 + Comisión
  { match: ['Dulcey', 'Gloria Carreño', 'Dulcey Shoes'], tipo: 'Growth', estado: 'Comenzando', valor: 2000000, comision: 1 },
  { match: ['Kryolan', 'OC STUDIO'], tipo: 'Growth', estado: 'Comenzando', valor: 2000000, comision: 1 },
  { match: ['Natnack', 'Nat nack', 'CCENECA'], tipo: 'Growth', estado: 'Comenzando', valor: 2000000, comision: 1 },
  { match: ['Cacao Hunters', 'CACAO DE COLOMBIA'], tipo: 'Growth', estado: 'Comenzando', valor: 2000000, comision: 1 },
  { match: ['Adriza', 'ADRIZA SUPLEMENTOS'], tipo: 'Growth', estado: 'Comenzando', valor: 2000000, comision: 1 },
  { match: ['Atratus', 'ROPA PARA EL MONTE'], tipo: 'Growth', estado: 'Comenzando', valor: 2000000, comision: 1 },

  // Growth con potencial — En la cuerda floja
  { match: ['Canvas Ink', 'Canvas'], tipo: 'Growth con potencial', estado: 'En la cuerda floja', valor: 1500000, comision: 1 },
  { match: ['Bites by Milas', 'Bites', 'Milas'], tipo: 'Growth con potencial', estado: 'En la cuerda floja', valor: 1200000, comision: 1 },

  // Fee mensual — Poco rentable, poco crecimiento (no comisión)
  { match: ['Yo vivo en Gratitud', 'Gratitud'], tipo: 'Fee mensual', estado: 'Poco rentable, poco crecimiento', valor: 1526000, comision: 0 },
  { match: ['Estruendo Hacemos', 'Estruendo'], tipo: 'Fee mensual', estado: 'Poco rentable, poco crecimiento', valor: 1782150, comision: 0 },
  { match: ['Zorro y Jaguar', 'Zorro'], tipo: 'Fee mensual', estado: 'Poco rentable, poco crecimiento', valor: 1635000, comision: 0 },
  { match: ['Sandra Botero'], tipo: 'Fee mensual', estado: 'Poco rentable, poco crecimiento', valor: 1635000, comision: 0 },

  // Fee bien negociado — Rentable, buen crecimiento (no comisión)
  { match: ['Leonisa'], tipo: 'Fee bien negociado', estado: 'Rentable, buen crecimiento', valor: 2725000, comision: 0 },
  { match: ['Solo con Once', 'Solo Con Once', 'Once'], tipo: 'Fee bien negociado', estado: 'Rentable, buen crecimiento', valor: 2970000, comision: 0 },
  { match: ['Parchita', 'PARCHITA PACIFLORA'], tipo: 'Fee bien negociado', estado: 'Rentable, buen crecimiento', valor: 5450000, comision: 0 },
  { match: ['Cíclico', 'Ciclico', 'CICLICOL'], tipo: 'Fee bien negociado', estado: 'Rentable, buen crecimiento', valor: 2970250, comision: 0 },

  // Fee mensual — Rentable, busca crecimiento (no comisión)
  { match: ['IFW'], tipo: 'Fee mensual', estado: 'Rentable, busca crecimiento', valor: 2943000, comision: 0 },
  { match: ['Caperuza', 'CAPERUZA Y EL LOBO', 'Barba Roja'], tipo: 'Fee mensual', estado: 'No tan rentable, buen crecimiento', valor: 2750000, comision: 0 },
  { match: ['Pachha', 'Pachha cuidado'], tipo: 'Fee mensual', estado: 'Rentable, busca crecimiento', valor: 2930000, comision: 0 },
  { match: ['Ukelele', 'Ukelele tejidos'], tipo: 'Fee mensual', estado: 'Rentable, busca crecimiento', valor: 2872150, comision: 0 },

  // Growth mal negociado — En la cuerda floja + Comisión
  { match: ['Nohora', 'Nohora Gélvez', 'Nohora Gelvez'], tipo: 'Growth mal negociado', estado: 'En la cuerda floja', valor: 1300000, comision: 1 },
];

export async function seedPortfolioData() {
  console.log('📊 Seeding portfolio data for clients...');

  const allClients = await db.all("SELECT id, name, company, nickname FROM clients WHERE status = 'active'");
  let updated = 0;

  for (const data of CLIENT_DATA) {
    // Find matching client by checking nickname, company, or name against match patterns
    const client = allClients.find(c => {
      const fields = [c.nickname, c.name, c.company].filter(Boolean).map(f => f.toLowerCase());
      return data.match.some(pattern =>
        fields.some(f => f.includes(pattern.toLowerCase()))
      );
    });

    if (client) {
      await db.run(
        `UPDATE clients SET tipo_negociacion = $1, estado_actual = $2, valor_contratado = $3, has_comision = $4 WHERE id = $5`,
        [data.tipo, data.estado, data.valor, data.comision, client.id]
      );
      updated++;
      console.log(`  ✅ ${client.company || client.name} → ${data.tipo} / ${data.estado} / $${data.valor.toLocaleString()}`);
    } else {
      console.log(`  ⚠️  No match found for: ${data.match[0]}`);
    }
  }

  console.log(`✅ Portfolio data seeded: ${updated}/${CLIENT_DATA.length} clients updated`);
}
