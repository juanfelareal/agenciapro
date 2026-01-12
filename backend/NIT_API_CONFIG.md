# Configuración de API para Búsqueda de NIT en Colombia

El sistema AgenciaPro incluye funcionalidad para buscar información de empresas por NIT y autocompletar los datos del cliente. Actualmente, el endpoint está configurado como un placeholder que necesita ser integrado con una API real.

## APIs Disponibles en Colombia

### 1. API Colombia (Recomendado)
**URL**: https://api-colombia.com/

**Características**:
- Consulta de información empresarial por NIT
- Datos del RUT
- Información de representantes legales
- Gratuita con límites, planes de pago disponibles

**Implementación**:
```javascript
// En backend/src/routes/clients.js línea 52
const axios = require('axios');

try {
  const response = await axios.get(`https://api-colombia.com/api/v1/Company/nit/${nit}`, {
    headers: {
      'Authorization': `Bearer ${process.env.API_COLOMBIA_KEY}`
    }
  });

  res.json({
    success: true,
    name: response.data.razonSocial,
    company: response.data.razonSocial,
    email: response.data.email,
    phone: response.data.telefono,
    address: response.data.direccion
  });
} catch (apiError) {
  res.status(404).json({
    error: 'No se encontró información para este NIT',
    nit: nit
  });
}
```

**Configuración en .env**:
```
API_COLOMBIA_KEY=tu-api-key-aqui
```

### 2. DIAN - Dirección de Impuestos y Aduanas Nacionales
**URL**: https://www.dian.gov.co/

**Características**:
- Fuente oficial del gobierno colombiano
- Información completa y actualizada
- Requiere trámites para acceso API

**Nota**: Requiere registro y aprobación para acceso programático.

### 3. Cámaras de Comercio
**URL**: Varía según la cámara

**Características**:
- Información del Registro Único Empresarial (RUE)
- Datos oficiales de constitución
- Puede requerir suscripción

### 4. Servicios Privados

#### a) Consulta RUT Colombia
- Varios proveedores privados ofrecen APIs
- Generalmente de pago
- Incluyen validación y datos históricos

#### b) TruoraAPI
**URL**: https://www.truora.com/
- Validación de identidad y empresas
- Incluye Colombia
- Servicio de pago con planes corporativos

## Implementación Paso a Paso

### 1. Elegir un Proveedor
Selecciona el proveedor que mejor se adapte a tus necesidades (recomendamos API Colombia para empezar).

### 2. Obtener Credenciales
Regístrate en el servicio elegido y obtén tus credenciales API.

### 3. Configurar Variables de Entorno
Edita el archivo `.env` en el backend:
```bash
# En backend/.env
API_COLOMBIA_KEY=tu-api-key-aqui
```

### 4. Actualizar el Código
Edita el archivo `backend/src/routes/clients.js` en la línea 40-76 e implementa la lógica de la API elegida.

### 5. Probar la Funcionalidad
1. Reinicia el servidor backend
2. En el frontend, ve a Clientes > Nuevo Cliente
3. Ingresa un NIT válido
4. Presiona "Buscar"
5. Los campos deberían autocompletarse con la información de la empresa

## Ejemplo Completo con API Colombia

```javascript
// backend/src/routes/clients.js
import axios from 'axios';

router.get('/search-nit/:nit', async (req, res) => {
  try {
    const nit = req.params.nit.replace(/[^0-9]/g, ''); // Limpiar NIT

    if (!nit || nit.length < 9) {
      return res.status(400).json({
        error: 'NIT inválido. Debe tener al menos 9 dígitos'
      });
    }

    try {
      // Llamar a API Colombia
      const response = await axios.get(
        `https://api-colombia.com/api/v1/Company/nit/${nit}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.API_COLOMBIA_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10 segundos timeout
        }
      );

      // Mapear respuesta al formato esperado
      res.json({
        success: true,
        nit: nit,
        name: response.data.razonSocial || response.data.nombre,
        company: response.data.razonSocial || response.data.nombre,
        email: response.data.correoElectronico || '',
        phone: response.data.telefono || '',
        address: response.data.direccion || '',
        city: response.data.ciudad || '',
        department: response.data.departamento || ''
      });
    } catch (apiError) {
      console.error('API Error:', apiError.message);

      if (apiError.response?.status === 404) {
        res.status(404).json({
          error: 'No se encontró información para este NIT',
          nit: nit
        });
      } else {
        res.status(500).json({
          error: 'Error al consultar la API. Verifique su configuración.',
          details: apiError.message
        });
      }
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Validación de NIT Colombiano

El formato de NIT en Colombia:
- 9 dígitos base + 1 dígito de verificación
- Formato: XXXXXXXXX-X
- Ejemplo: 860028363-1

Puedes agregar validación adicional:
```javascript
function validarNIT(nit) {
  // Remover guiones y espacios
  const nitLimpio = nit.replace(/[^0-9]/g, '');

  // Debe tener 9 o 10 dígitos
  if (nitLimpio.length < 9 || nitLimpio.length > 10) {
    return false;
  }

  return true;
}
```

## Costos Aproximados

- **API Colombia**: Gratis hasta 100 consultas/mes, planes desde $20 USD/mes
- **DIAN**: Gratis (requiere aprobación)
- **Cámaras de Comercio**: Variable, consultar con cada cámara
- **Truora**: Desde $0.10 USD por consulta

## Soporte

Para más información o ayuda con la integración:
1. Revisa la documentación del proveedor elegido
2. Consulta los ejemplos de código en este archivo
3. Verifica que las credenciales estén correctamente configuradas en .env

## Alternativa: Validación Manual

Si no deseas usar una API externa por ahora, puedes usar el campo NIT simplemente para almacenar el dato sin autocompletado. El sistema funcionará correctamente guardando el NIT ingresado manualmente junto con los demás datos del cliente.
