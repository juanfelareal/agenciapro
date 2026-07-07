// Colombian Departments and Cities
// Sorted alphabetically

const colombiaLocations = {
  'Amazonas': ['Leticia', 'Puerto Nariño'],
  'Antioquia': [
    'Medellín', 'Bello', 'Itagüí', 'Envigado', 'Apartadó', 'Turbo', 'Rionegro',
    'Caucasia', 'Copacabana', 'La Estrella', 'Sabaneta', 'Caldas', 'Girardota',
    'Barbosa', 'Carmen de Viboral', 'Marinilla', 'La Ceja', 'Guarne', 'El Retiro',
    'Santa Fe de Antioquia', 'Yarumal', 'Puerto Berrío', 'Chigorodó', 'Carepa',
    'Andes', 'Urrao', 'Amalfi', 'Segovia', 'El Bagre', 'Zaragoza', 'Necoclí',
    'San Pedro de los Milagros', 'Don Matías', 'Santo Domingo', 'Cisneros',
    'Otro'
  ],
  'Arauca': ['Arauca', 'Saravena', 'Tame', 'Fortul', 'Arauquita', 'Otro'],
  'Atlántico': [
    'Barranquilla', 'Soledad', 'Malambo', 'Sabanalarga', 'Baranoa', 'Galapa',
    'Puerto Colombia', 'Santo Tomás', 'Palmar de Varela', 'Sabanagrande',
    'Juan de Acosta', 'Tubará', 'Otro'
  ],
  'Bogotá D.C.': ['Bogotá'],
  'Bolívar': [
    'Cartagena', 'Magangué', 'Turbaco', 'Arjona', 'El Carmen de Bolívar',
    'San Juan Nepomuceno', 'María la Baja', 'Mompos', 'Simití', 'Otro'
  ],
  'Boyacá': [
    'Tunja', 'Duitama', 'Sogamoso', 'Chiquinquirá', 'Paipa', 'Puerto Boyacá',
    'Villa de Leyva', 'Moniquirá', 'Nobsa', 'Tibasosa', 'Samacá', 'Garagoa',
    'Guateque', 'Miraflores', 'Soatá', 'Otro'
  ],
  'Caldas': [
    'Manizales', 'La Dorada', 'Chinchiná', 'Villamaría', 'Riosucio', 'Anserma',
    'Aguadas', 'Salamina', 'Supía', 'Pensilvania', 'Otro'
  ],
  'Caquetá': [
    'Florencia', 'San Vicente del Caguán', 'Puerto Rico', 'El Doncello',
    'Belén de los Andaquíes', 'Cartagena del Chairá', 'Otro'
  ],
  'Casanare': [
    'Yopal', 'Aguazul', 'Villanueva', 'Tauramena', 'Paz de Ariporo',
    'Monterrey', 'Maní', 'Trinidad', 'Otro'
  ],
  'Cauca': [
    'Popayán', 'Santander de Quilichao', 'Puerto Tejada', 'Piendamó',
    'El Bordo', 'Corinto', 'Miranda', 'Guapi', 'Silvia', 'Timbío', 'Otro'
  ],
  'Cesar': [
    'Valledupar', 'Aguachica', 'Codazzi', 'Bosconia', 'Chimichagua',
    'Curumaní', 'El Copey', 'La Jagua de Ibirico', 'Otro'
  ],
  'Chocó': [
    'Quibdó', 'Istmina', 'Condoto', 'Tadó', 'Bahía Solano', 'Nuquí',
    'Riosucio', 'Acandí', 'Otro'
  ],
  'Córdoba': [
    'Montería', 'Cereté', 'Lorica', 'Sahagún', 'Planeta Rica', 'Montelíbano',
    'Tierralta', 'Chinú', 'Ciénaga de Oro', 'San Andrés de Sotavento', 'Otro'
  ],
  'Cundinamarca': [
    'Soacha', 'Facatativá', 'Zipaquirá', 'Chía', 'Fusagasugá', 'Girardot',
    'Madrid', 'Mosquera', 'Funza', 'Cajicá', 'Cota', 'La Calera', 'Sopó',
    'Tocancipá', 'Tabio', 'Tenjo', 'Sibaté', 'Ubaté', 'Villeta', 'La Mesa',
    'Anapoima', 'Arbeláez', 'Silvania', 'Guatavita', 'Sesquilé', 'Cogua',
    'Nemocón', 'Subachoque', 'El Rosal', 'Bojacá', 'Otro'
  ],
  'Guainía': ['Inírida', 'Otro'],
  'Guaviare': ['San José del Guaviare', 'Calamar', 'El Retorno', 'Miraflores', 'Otro'],
  'Huila': [
    'Neiva', 'Pitalito', 'Garzón', 'La Plata', 'Campoalegre', 'Palermo',
    'San Agustín', 'Algeciras', 'Gigante', 'Rivera', 'Otro'
  ],
  'La Guajira': [
    'Riohacha', 'Maicao', 'Uribia', 'Manaure', 'San Juan del Cesar',
    'Fonseca', 'Villanueva', 'Barrancas', 'Albania', 'Otro'
  ],
  'Magdalena': [
    'Santa Marta', 'Ciénaga', 'Fundación', 'El Banco', 'Plato', 'Aracataca',
    'Pivijay', 'Zona Bananera', 'Otro'
  ],
  'Meta': [
    'Villavicencio', 'Acacías', 'Granada', 'Puerto López', 'San Martín',
    'Cumaral', 'Restrepo', 'Guamal', 'Puerto Gaitán', 'Otro'
  ],
  'Nariño': [
    'Pasto', 'Tumaco', 'Ipiales', 'Túquerres', 'La Unión', 'Samaniego',
    'Sandoná', 'Barbacoas', 'El Charco', 'Otro'
  ],
  'Norte de Santander': [
    'Cúcuta', 'Ocaña', 'Pamplona', 'Villa del Rosario', 'Los Patios',
    'El Zulia', 'Tibú', 'Chinácota', 'Ábrego', 'Otro'
  ],
  'Putumayo': [
    'Mocoa', 'Puerto Asís', 'Orito', 'Valle del Guamuez', 'Villagarzón',
    'Puerto Leguízamo', 'Sibundoy', 'Otro'
  ],
  'Quindío': [
    'Armenia', 'Calarcá', 'Montenegro', 'Quimbaya', 'La Tebaida', 'Circasia',
    'Filandia', 'Salento', 'Génova', 'Otro'
  ],
  'Risaralda': [
    'Pereira', 'Dosquebradas', 'Santa Rosa de Cabal', 'La Virginia',
    'Belén de Umbría', 'Marsella', 'Apía', 'Santuario', 'Otro'
  ],
  'San Andrés y Providencia': ['San Andrés', 'Providencia', 'Otro'],
  'Santander': [
    'Bucaramanga', 'Floridablanca', 'Girón', 'Piedecuesta', 'Barrancabermeja',
    'San Gil', 'Socorro', 'Barbosa', 'Lebrija', 'Vélez', 'Málaga',
    'Puerto Wilches', 'Otro'
  ],
  'Sucre': [
    'Sincelejo', 'Corozal', 'San Marcos', 'Sampués', 'Tolú', 'San Onofre',
    'Since', 'Coveñas', 'Otro'
  ],
  'Tolima': [
    'Ibagué', 'Espinal', 'Melgar', 'Chaparral', 'Honda', 'Mariquita',
    'Líbano', 'Flandes', 'Guamo', 'Purificación', 'Otro'
  ],
  'Valle del Cauca': [
    'Cali', 'Buenaventura', 'Palmira', 'Tuluá', 'Buga', 'Cartago', 'Jamundí',
    'Yumbo', 'Candelaria', 'Florida', 'Pradera', 'Zarzal', 'Roldanillo',
    'Sevilla', 'Caicedonia', 'La Unión', 'Ginebra', 'El Cerrito', 'Dagua', 'Otro'
  ],
  'Vaupés': ['Mitú', 'Carurú', 'Taraira', 'Otro'],
  'Vichada': ['Puerto Carreño', 'Cumaribo', 'La Primavera', 'Santa Rosalía', 'Otro']
};

// Get sorted list of departments
export const departments = Object.keys(colombiaLocations).sort();

// Get cities for a department
export const getCitiesByDepartment = (department) => {
  return colombiaLocations[department] || [];
};

export default colombiaLocations;
