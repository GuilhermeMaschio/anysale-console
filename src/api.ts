import { accessToken } from './auth'

const baseUrl = import.meta.env.VITE_LEAD_SERVICE_URL ?? '/api'
const catalogBaseUrl = import.meta.env.VITE_CATALOG_SERVICE_URL ?? '/catalog-api'
export type LeadApi = { id:string; name:string; stage:string; estimatedValue?:number; actualValue?:number; lostReason?:string; lastMessage?:string; score?:number; suggestedReply?:string; assignedTo?:string; aiProviderStatus?:string }
export type Interaction = { id:string; message:string; direction:string; createdAt:string }
export type Funnel = { totalLeads:number; leadsByStage:Record<string,number>; wonLeads:number; lostLeads:number; estimatedPipelineValue:number; wonRevenue:number; averageTicket:number; winRatePercent:number; lossesByReason:Record<string,number>; generatedAt:string }
export type AiSettings = { enabled:boolean; providerAvailable:boolean; model?:string; maxOutputTokens:number; monthlyRequestLimit?:number; monthlyTokenLimit?:number; allowedModels:string[]; serviceProfile:string; tone:string; formality:string; responseLength:string; commercialApproach:string; customInstructions?:string; approvedExamples?:string; rejectedExamples?:string; updatedAt?:string }
export type AiUsage = { month:string; requests:number; inputTokens:number; outputTokens:number; totalTokens:number; monthlyRequestLimit?:number; monthlyTokenLimit?:number }
export type ConsolePreference = { colorTheme:'light'|'dark'; updatedAt?:string }
export type AiSkill = { profile:string; label:string; content:string; customized:boolean; updatedAt?:string }
export type Product = { id:string; sku:string; title:string; category:string; description?:string; currency:string; vendor?:string; price:number; tags:string[]; available:boolean; stockQuantity:number; reservedQuantity:number; availableQuantity:number; reorderPoint:number; lowStock:boolean; hasImage:boolean; updatedAt:string }

export type CatalogIntegration = {
  id: string;
  tenantId: string;
  name: string;
  providerType: string;
  baseUrl: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR';
  hasCredentials: boolean;
  authType: 'NONE' | 'BEARER_TOKEN' | 'API_KEY_HEADER' | 'API_KEY_QUERY';
  apiKeyHeaderName?: string;
  apiKeyQueryName?: string;
  syncMode: 'MANUAL' | 'SCHEDULED';
  schedule?: string;
  fieldMapping?: Record<string, string>;
  conflictStrategy: 'EXTERNAL_WINS' | 'LOCAL_WINS' | 'REVIEW_REQUIRED';
  skuFallbackEnabled: boolean;
  lastSyncAt?: string;
  lastSyncStatus?: string;
  createdAt: string;
  updatedAt: string;
}

export type CatalogSyncExecution = {
  id: string;
  tenantId: string;
  integrationId: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  startedAt: string;
  finishedAt?: string;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  errorSummary: string[];
}

export type CatalogPreviewItem = {
  externalProductId?: string;
  sku?: string;
  title?: string;
  category?: string;
  description?: string;
  price?: number;
  currency?: string;
  stockQuantity: number;
  reorderPoint: number;
  available: boolean;
  imageUrl?: string;
  isValid: boolean;
  validationErrors: string[];
}

export type CatalogPreviewResponse = {
  totalItems: number;
  items: CatalogPreviewItem[];
}

export type TestConnectionResponse = {
  success: boolean;
  statusCode: number;
  message: string;
}

async function request<T>(path:string, init?:RequestInit): Promise<T> {
  return requestFrom<T>(baseUrl, path, init)
}
async function requestFrom<T>(serviceUrl:string, path:string, init?:RequestInit): Promise<T> {
  const token = await accessToken()
  const response = await fetch(serviceUrl + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
  })
  if (!response.ok) {
    const problem = await response.json().catch(() => undefined) as { detail?: unknown; message?: unknown; exception?: unknown } | undefined
    const detail = typeof problem?.detail === 'string' ? problem.detail : typeof problem?.message === 'string' ? problem.message : undefined
    const exception = typeof problem?.exception === 'string' ? problem.exception : undefined
    const suffix = exception && import.meta.env.DEV ? ` [${exception}]` : ''
    throw new Error(detail ? `API ${response.status}: ${detail}${suffix}` : `API ${response.status}`)
  }
  return response.json()
}
export const api = { leads: () => request<{content:LeadApi[]}>('/v1/leads?size=20'), funnel: () => request<Funnel>('/v1/reports/sales-funnel'), lead: (id:string) => request<LeadApi>(`/v1/leads/${id}`), interactions: (id:string) => request<Interaction[]>(`/v1/leads/${id}/interactions`), commercial: (id:string, body:object) => request<LeadApi>(`/v1/leads/${id}/commercial`, {method:'PATCH', body:JSON.stringify(body)}), stage: (id:string, stage:string) => request(`/v1/leads/${id}/stage`, {method:'PATCH', body:JSON.stringify({stage, changedBy:'Console'})}), sendWhatsApp: (id:string, message:string) => request(`/v1/leads/${id}/whatsapp/messages`, {method:'POST', body:JSON.stringify({message})}), addTestInteraction: (id:string, message:string, direction:'IN'|'OUT') => request<Interaction>(`/v1/leads/${id}/test-interactions`, {method:'POST', body:JSON.stringify({message, direction})}), enrichWithAi: (id:string) => request<LeadApi>(`/v1/leads/${id}/ai-enrichment`, {method:'POST'}), aiSettings: () => request<AiSettings>('/v1/ai/settings'), aiUsage: () => request<AiUsage>('/v1/ai/usage'), saveAiSettings: (settings: AiSettings) => request<AiSettings>('/v1/ai/settings', {method:'PUT', body:JSON.stringify(settings)}), aiSkills: () => request<AiSkill[]>('/v1/ai/skills'), saveAiSkill: (profile:string, content:string) => request<AiSkill>(`/v1/ai/skills/${profile}`, {method:'PUT', body:JSON.stringify({content})}), resetAiSkill: async (profile:string) => { const token = await accessToken(); const response = await fetch(`${baseUrl}/v1/ai/skills/${profile}`, {method:'DELETE', headers:{Authorization:`Bearer ${token}`}}); if (!response.ok) throw new Error(`API ${response.status}`) }, consolePreference: () => request<ConsolePreference>('/v1/console/preferences'), saveConsolePreference: (colorTheme:'light'|'dark') => request<ConsolePreference>('/v1/console/preferences', {method:'PUT', body:JSON.stringify({colorTheme})}) }
export const catalogApi = {
  products: () => requestFrom<Product[]>(catalogBaseUrl, '/v1/products'),
  createProduct: (body: object) => requestFrom<Product>(catalogBaseUrl, '/v1/products', { method: 'POST', body: JSON.stringify(body) }),
  stockMovement: (id: string, body: object) => requestFrom<Product>(catalogBaseUrl, `/v1/products/${id}/stock-movements`, { method: 'POST', body: JSON.stringify(body) }),
  uploadImage: async (id: string, file: File) => { const token = await accessToken(); const form = new FormData(); form.append('file', file); const response = await fetch(`${catalogBaseUrl}/v1/products/${id}/image`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }); if (!response.ok) throw new Error(`API ${response.status}`); return response.json() as Promise<Product> },
  imageUrl: async (id: string) => { const token = await accessToken(); const response = await fetch(`${catalogBaseUrl}/v1/products/${id}/image`, { headers: { Authorization: `Bearer ${token}` } }); if (!response.ok) throw new Error(`API ${response.status}`); return URL.createObjectURL(await response.blob()) },
  archiveProduct: async (id: string) => { const token = await accessToken(); const response = await fetch(`${catalogBaseUrl}/v1/products/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); if (!response.ok) throw new Error(`API ${response.status}`) },

  // Catalog Integrations
  integrations: () => requestFrom<CatalogIntegration[]>(catalogBaseUrl, '/v1/catalog-integrations'),
  createIntegration: (body: object) => requestFrom<CatalogIntegration>(catalogBaseUrl, '/v1/catalog-integrations', { method: 'POST', body: JSON.stringify(body) }),
  updateIntegration: (id: string, body: object) => requestFrom<CatalogIntegration>(catalogBaseUrl, `/v1/catalog-integrations/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteIntegration: async (id: string) => { const token = await accessToken(); const response = await fetch(`${catalogBaseUrl}/v1/catalog-integrations/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); if (!response.ok) throw new Error(`API ${response.status}`) },
  testIntegration: (id: string) => requestFrom<TestConnectionResponse>(catalogBaseUrl, `/v1/catalog-integrations/${id}/test`, { method: 'POST' }),
  previewIntegration: (id: string) => requestFrom<CatalogPreviewResponse>(catalogBaseUrl, `/v1/catalog-integrations/${id}/preview`, { method: 'POST' }),
  syncIntegration: (id: string) => requestFrom<CatalogSyncExecution>(catalogBaseUrl, `/v1/catalog-integrations/${id}/sync`, { method: 'POST' }),
  integrationExecutions: (id: string) => requestFrom<CatalogSyncExecution[]>(catalogBaseUrl, `/v1/catalog-integrations/${id}/executions`),
}
