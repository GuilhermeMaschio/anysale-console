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
export type CadenceStep = { id?:string; position:number; delayMinutes:number; title:string; taskType:string; priority:string; note?:string }
export type SalesPlaybook = { id:string; name:string; description?:string; active:boolean; defaultPlaybook:boolean; version:number; categories:string[] }
export type LeadCadence = { id:string; leadId:string; playbookId:string; playbookName:string; status:string; nextPosition:number; nextActionAt?:string; startedAt:string; pausedAt?:string; completedAt?:string }
export type LeadCadenceRoadmap = { cadence:LeadCadence; steps:CadenceStep[] }
export type RoadmapPortfolioLead = { leadId:string; name:string; stage:string; estimatedValue?:number; relationship:'RESPONSIBLE'|'TASK_ACTIVITY' }
export type CadenceEnrollmentSettings = { enabled:boolean; updatedAt?:string }
export type LeadTask = { id:string; leadId:string; leadName:string; title:string; taskType:string; priority:string; status:string; dueAt:string; assignedTo?:string; reservationExpiresAt?:string; completedAt?:string; outcome?:string; note?:string; createdAt:string }
export type ManagedUser = { id:string; firstName:string; lastName:string; email:string; role:'ADMIN'|'SALES_MANAGER'|'SALES_AGENT'; enabled:boolean; createdAt?:string }
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
  if (response.status === 204) return undefined as T
  return response.json()
}
export const api = { leads: () => request<{content:LeadApi[]}>('/v1/leads?size=20'), funnel: () => request<Funnel>('/v1/reports/sales-funnel'), lead: (id:string) => request<LeadApi>(`/v1/leads/${id}`), interactions: (id:string) => request<Interaction[]>(`/v1/leads/${id}/interactions`), leadTasks: (id:string) => request<LeadTask[]>(`/v1/leads/${id}/tasks`), commercial: (id:string, body:object) => request<LeadApi>(`/v1/leads/${id}/commercial`, {method:'PATCH', body:JSON.stringify(body)}), stage: (id:string, stage:string) => request(`/v1/leads/${id}/stage`, {method:'PATCH', body:JSON.stringify({stage, changedBy:'Console'})}), sendWhatsApp: (id:string, message:string) => request(`/v1/leads/${id}/whatsapp/messages`, {method:'POST', body:JSON.stringify({message})}), addTestInteraction: (id:string, message:string, direction:'IN'|'OUT') => request<Interaction>(`/v1/leads/${id}/test-interactions`, {method:'POST', body:JSON.stringify({message, direction})}), enrichWithAi: (id:string) => request<LeadApi>(`/v1/leads/${id}/ai-enrichment`, {method:'POST'}), aiSettings: () => request<AiSettings>('/v1/ai/settings'), aiUsage: () => request<AiUsage>('/v1/ai/usage'), saveAiSettings: (settings: AiSettings) => request<AiSettings>('/v1/ai/settings', {method:'PUT', body:JSON.stringify(settings)}), aiSkills: () => request<AiSkill[]>('/v1/ai/skills'), saveAiSkill: (profile:string, content:string) => request<AiSkill>(`/v1/ai/skills/${profile}`, {method:'PUT', body:JSON.stringify({content})}), resetAiSkill: async (profile:string) => { const token = await accessToken(); const response = await fetch(`${baseUrl}/v1/ai/skills/${profile}`, {method:'DELETE', headers:{Authorization:`Bearer ${token}`}}); if (!response.ok) throw new Error(`API ${response.status}`) }, consolePreference: () => request<ConsolePreference>('/v1/console/preferences'), saveConsolePreference: (colorTheme:'light'|'dark') => request<ConsolePreference>('/v1/console/preferences', {method:'PUT', body:JSON.stringify({colorTheme})}), playbooks: () => request<SalesPlaybook[]>('/v1/playbooks'), createPlaybook: (body:object) => request<SalesPlaybook>(`/v1/playbooks`, {method:'POST', body:JSON.stringify(body)}), updatePlaybook: (id:string, body:object) => request<SalesPlaybook>(`/v1/playbooks/${id}`, {method:'PUT', body:JSON.stringify(body)}), cadenceSteps: (id:string) => request<CadenceStep[]>(`/v1/playbooks/${id}/cadence/steps`), saveCadenceSteps: (id:string, steps:CadenceStep[]) => request<CadenceStep[]>(`/v1/playbooks/${id}/cadence/steps`, {method:'PUT', body:JSON.stringify(steps.map(({delayMinutes,title,taskType,priority,note}) => ({delayMinutes,title,taskType,priority,note})))}), leadCadence: (id:string) => request<LeadCadence>(`/v1/leads/${id}/cadence`), startCadence: (id:string) => request<LeadCadence>(`/v1/leads/${id}/cadence/start`, {method:'POST'}), pauseCadence: (id:string) => request<LeadCadence>(`/v1/leads/${id}/cadence/pause`, {method:'POST'}), resumeCadence: (id:string) => request<LeadCadence>(`/v1/leads/${id}/cadence/resume`, {method:'POST'}), cancelCadence: (id:string) => request<LeadCadence>(`/v1/leads/${id}/cadence/cancel`, {method:'POST'}), tasks: (view:'available'|'mine') => request<{content:LeadTask[]}>(`/v1/tasks?view=${view}&size=100`), claimTask: (id:string) => request<LeadTask>(`/v1/tasks/${id}/claim`, {method:'POST'}), releaseTask: (id:string) => request<LeadTask>(`/v1/tasks/${id}/release`, {method:'POST'}), snoozeTask: (id:string, dueAt:string, note?:string) => request<LeadTask>(`/v1/tasks/${id}/snooze`, {method:'POST', body:JSON.stringify({dueAt,note})}), completeTask: (id:string, outcome:string, note?:string) => request<LeadTask>(`/v1/tasks/${id}/complete`, {method:'POST', body:JSON.stringify({outcome,note})}) }
export const cadenceEnrollmentApi = { settings: () => request<CadenceEnrollmentSettings>('/v1/cadence-enrollment-settings'), save: (enabled:boolean) => request<CadenceEnrollmentSettings>('/v1/cadence-enrollment-settings',{method:'PUT',body:JSON.stringify({enabled})}) }
export const leadRoadmapApi = { get: (leadId:string) => request<LeadCadenceRoadmap>(`/v1/leads/${leadId}/cadence/roadmap`) }
export const salesRoadmapApi = {
  portfolio: () => request<RoadmapPortfolioLead[]>('/v1/me/sales-roadmap'),
  get: (leadId:string) => request<LeadCadenceRoadmap>(`/v1/me/sales-roadmap/${leadId}`),
}
export const leadCreationApi = { create: (body: {name:string; email?:string; phone?:string; source?:string; desiredCategory?:string; desiredTags?:string[]}) => request<LeadApi>('/v1/leads',{method:'POST',body:JSON.stringify(body)}) }
export const userManagementApi = {
  users: (search = '') => request<ManagedUser[]>(`/v1/admin/users${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  create: (body: {firstName:string; lastName:string; email:string; temporaryPassword:string; role:string}) => request<ManagedUser>('/v1/admin/users', {method:'POST', body:JSON.stringify(body)}),
  update: (id:string, body: {firstName:string; lastName:string; email:string; role:string; enabled:boolean}) => request<ManagedUser>(`/v1/admin/users/${id}`, {method:'PUT', body:JSON.stringify(body)}),
  remove: async (id:string) => { await request<void>(`/v1/admin/users/${id}`, {method:'DELETE'}) },
}

export const catalogApi = {
  products: () => requestFrom<Product[]>(catalogBaseUrl, '/v1/products'),
  createProduct: (body: object) => requestFrom<Product>(catalogBaseUrl, '/v1/products', { method: 'POST', body: JSON.stringify(body) }),
  stockMovement: (id: string, body: object) => requestFrom<Product>(catalogBaseUrl, `/v1/products/${id}/stock-movements`, { method: 'POST', body: JSON.stringify(body) }),
  uploadImage: async (id: string, file: File) => { const token = await accessToken(); const form = new FormData(); form.append('file', file); const response = await fetch(`${catalogBaseUrl}/v1/products/${id}/image`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }); if (!response.ok) throw new Error(`API ${response.status}`); return response.json() as Promise<Product> },
  imageUrl: async (id: string) => { const token = await accessToken(); const response = await fetch(`${catalogBaseUrl}/v1/products/${id}/image`, { headers: { Authorization: `Bearer ${token}` } }); if (!response.ok) throw new Error(`API ${response.status}`); return URL.createObjectURL(await response.blob()) },
  archiveProduct: async (id: string) => { const token = await accessToken(); const response = await fetch(`${catalogBaseUrl}/v1/products/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); if (!response.ok) throw new Error(`API ${response.status}`) },
}
