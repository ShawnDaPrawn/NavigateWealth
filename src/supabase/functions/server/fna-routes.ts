/**
 * FNA Directory Service
 * 
 * This is NOT a shared FNA service. Each FNA type is architecturally isolated
 * with its own route file, calculation logic, and data storage.
 * 
 * This service provides:
 * - Directory listing of available FNA types
 * - Health check endpoint
 * - API documentation links
 * - Service discovery
 */

import { Hono } from 'npm:hono';

const fnaRoutes = new Hono();

/**
 * FNA Type Registry
 * Each FNA type is completely isolated with its own:
 * - Backend routes file
 * - Frontend module
 * - Calculation engine
 * - KV storage namespace
 * - Business logic
 */
const FNA_TYPES = [
  {
    id: 'risk-planning',
    name: 'Risk Planning FNA',
    description: 'Life cover, disability, severe illness, and income protection needs analysis',
    endpoint: '/make-server-91ed8379/risk-planning-fna',
    status: 'active', // Changed from 'in-development' to 'active'
    routeFile: 'risk-planning-fna-routes.tsx',
    frontend: '/components/admin/modules/risk-planning-fna/',
  },
  {
    id: 'medical-aid',
    name: 'Medical Aid FNA',
    description: 'Medical scheme, gap cover, and medical savings plan analysis',
    endpoint: '/make-server-91ed8379/medical-fna',
    status: 'active',
    routeFile: 'medical-fna-routes.tsx',
    frontend: '/components/admin/modules/medical-fna/',
  },
  {
    id: 'retirement',
    name: 'Retirement Planning FNA',
    description: 'Retirement lump sum and annuity income needs analysis',
    endpoint: '/make-server-91ed8379/retirement-fna',
    status: 'active',
    routeFile: 'retirement-fna-routes.tsx',
    frontend: '/components/admin/modules/retirement-fna/',
  },
  {
    id: 'estate-planning',
    name: 'Estate Planning FNA',
    description: 'Estate duty, liquidity, and executor fees analysis',
    endpoint: '/make-server-91ed8379/estate-planning-fna',
    status: 'active',
    routeFile: 'estate-planning-fna-routes.tsx',
    frontend: '/components/admin/modules/estate-planning-fna/',
  },
  {
    id: 'tax-planning',
    name: 'Tax Planning',
    description: 'Tax document management — FNA wizard removed; document uploads only',
    endpoint: '/make-server-91ed8379/tax-planning-fna',
    status: 'documents_only',
    routeFile: 'tax-planning-fna-routes.ts',
    frontend: '/components/admin/modules/tax-planning-fna/',
  },
  {
    id: 'investment',
    name: 'Investment INA',
    description: 'Asset allocation, risk profile, and portfolio analysis',
    endpoint: '/make-server-91ed8379/ina/investment',
    status: 'active',
    routeFile: 'investment-ina-routes.tsx',
    frontend: '/components/admin/modules/investment-ina/',
  },
  {
    id: 'employee-benefits',
    name: 'Employee Benefits FNA',
    description: 'Group life, provident fund, and employee medical aid analysis',
    endpoint: '/make-server-91ed8379/employee-benefits-fna',
    status: 'planned',
    routeFile: 'employee-benefits-fna-routes.tsx (not yet created)',
    frontend: '/components/admin/modules/employee-benefits-fna/ (not yet created)',
  },
];

/**
 * GET /
 * FNA Directory - List all available FNA types
 */
fnaRoutes.get('/', (c) => {
  return c.json({
    service: 'FNA Directory',
    version: '1.0.0',
    description: 'Navigate Wealth Financial Needs Analysis Services',
    architecture: 'Each FNA type is architecturally isolated - no shared services',
    available_fna_types: FNA_TYPES,
    guidelines: {
      isolation: 'Each FNA has its own routes, calculations, and storage',
      no_shared_logic: 'FNA types do not share business logic or services',
      independent_deployment: 'Each FNA can be deployed and tested independently',
      standard_structure: 'Risk Planning FNA serves as the architectural template',
    },
    documentation: {
      architecture: '/components/admin/modules/risk-planning-fna/ARCHITECTURE_AUDIT.md',
      diagram: '/components/admin/modules/risk-planning-fna/ARCHITECTURE_DIAGRAM.md',
    },
  });
});

/**
 * GET /health
 * Health check endpoint
 */
fnaRoutes.get('/health', (c) => {
  const activeFnas = FNA_TYPES.filter(fna => fna.status === 'active');
  const inDevelopmentFnas = FNA_TYPES.filter(fna => fna.status === 'in-development');
  const plannedFnas = FNA_TYPES.filter(fna => fna.status === 'planned');

  return c.json({
    status: 'healthy',
    service: 'FNA Directory',
    timestamp: new Date().toISOString(),
    statistics: {
      total_fna_types: FNA_TYPES.length,
      active: activeFnas.length,
      in_development: inDevelopmentFnas.length,
      planned: plannedFnas.length,
    },
    active_services: activeFnas.map(fna => fna.id),
  });
});

/**
 * GET /types
 * Get list of FNA type IDs
 */
fnaRoutes.get('/types', (c) => {
  return c.json({
    fna_types: FNA_TYPES.map(fna => ({
      id: fna.id,
      name: fna.name,
      status: fna.status,
      endpoint: fna.endpoint,
    })),
  });
});

/**
 * GET /types/:typeId
 * Get details about a specific FNA type
 */
fnaRoutes.get('/types/:typeId', (c) => {
  const typeId = c.req.param('typeId');
  const fnaType = FNA_TYPES.find(fna => fna.id === typeId);

  if (!fnaType) {
    return c.json(
      {
        error: 'FNA type not found',
        message: `No FNA type with id "${typeId}"`,
        available_types: FNA_TYPES.map(fna => fna.id),
      },
      404
    );
  }

  return c.json({
    fna_type: fnaType,
    usage: {
      base_url: fnaType.endpoint,
      common_endpoints: [
        `GET ${fnaType.endpoint}/client/:clientId/latest`,
        `POST ${fnaType.endpoint}/create`,
        `PUT ${fnaType.endpoint}/update/:fnaId`,
        `POST ${fnaType.endpoint}/publish/:fnaId`,
        `GET ${fnaType.endpoint}/:fnaId`,
      ],
    },
  });
});

/**
 * POST /submit (DEPRECATED)
 * This endpoint exists for backward compatibility only.
 * DO NOT USE - Each FNA type has its own isolated endpoints.
 */
fnaRoutes.post('/submit', async (c) => {
  return c.json(
    {
      error: 'Endpoint deprecated',
      message: 'This shared FNA endpoint is deprecated. Use specific FNA type endpoints instead.',
      migration_guide: {
        old: 'POST /fna/submit',
        new: 'POST /{fna-type}-fna/create',
        example: 'POST /risk-planning-fna/create',
      },
      available_fna_types: FNA_TYPES.filter(fna => fna.status === 'active').map(fna => ({
        id: fna.id,
        endpoint: fna.endpoint,
      })),
    },
    410 // Gone - indicates the endpoint is deprecated
  );
});

/**
 * Catch-all for undefined routes
 */
fnaRoutes.all('*', (c) => {
  return c.json(
    {
      error: 'Endpoint not found',
      message: 'This is the FNA Directory service. Each FNA type has its own isolated endpoints.',
      hint: 'Visit GET /make-server-91ed8379/fna/ for available FNA types',
      available_endpoints: [
        'GET /make-server-91ed8379/fna/',
        'GET /make-server-91ed8379/fna/health',
        'GET /make-server-91ed8379/fna/types',
        'GET /make-server-91ed8379/fna/types/:typeId',
      ],
    },
    404
  );
});

export default fnaRoutes;