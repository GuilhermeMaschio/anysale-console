import { accessToken } from './auth'

const baseUrl = import.meta.env.VITE_LEAD_SERVICE_URL ?? '/api'
export type LeadApi = { id:string; name:string; stage:string; estimatedValue?:number; actualValue?:number; lostReason?:string; lastMessage?:string; score?:number; suggestedReply?:string; assignedTo?:string }
export type Interaction = { id:string; message:string; direction:string; createdAt:string }
export type Funnel = { totalLeads:number; leadsByStage:Record<string,number>; wonLeads:number; lostLeads:number; estimatedPipelineValue:number; wonRevenue:number; averageTicket:number; winRatePercent:number; lossesByReason:Record<string,number>; generatedAt:string }
export type AiSettings = { enabled:boolean; providerAvailable:boolean; model?:string; maxOutputTokens:number; monthlyRequestLimit?:number; monthlyTokenLimit?:number; allowedModels:string[]; updatedAt?:string }
export type AiUsage = { month:string; requests:number; inputTokens:number; outputTokens:number; totalTokens:number; monthlyRequestLimit?:number; monthlyTokenLimit?:number }
async function request<T>(path:string, init?:RequestInit): Promise<T> {
  const token = await accessToken()
  const response = await fetch(baseUrl + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
  })
  if (!response.ok) {
    const problem = await response.json().catch(() => undefined) as { detail?: unknown; message?: unknown } | undefined
    const detail = typeof problem?.detail === 'string' ? problem.detail : typeof problem?.message === 'string' ? problem.message : undefined
    throw new Error(detail ? `API ${response.status}: ${detail}` : `API ${response.status}`)
  }
  return response.json()
}
export const api = { leads: () => request<{content:LeadApi[]}>('/v1/leads?size=20'), funnel: () => request<Funnel>('/v1/reports/sales-funnel'), lead: (id:string) => request<LeadApi>(`/v1/leads/${id}`), interactions: (id:string) => request<Interaction[]>(`/v1/leads/${id}/interactions`), commercial: (id:string, body:object) => request<LeadApi>(`/v1/leads/${id}/commercial`, {method:'PATCH', body:JSON.stringify(body)}), stage: (id:string, stage:string) => request(`/v1/leads/${id}/stage`, {method:'PATCH', body:JSON.stringify({stage, changedBy:'Console'})}), sendWhatsApp: (id:string, message:string) => request(`/v1/leads/${id}/whatsapp/messages`, {method:'POST', body:JSON.stringify({message})}), aiSettings: () => request<AiSettings>('/v1/ai/settings'), aiUsage: () => request<AiUsage>('/v1/ai/usage'), saveAiSettings: ({ enabled, model, maxOutputTokens, monthlyRequestLimit, monthlyTokenLimit }: AiSettings) => request<AiSettings>('/v1/ai/settings', {method:'PUT', body:JSON.stringify({ enabled, model, maxOutputTokens, monthlyRequestLimit, monthlyTokenLimit })}) }
