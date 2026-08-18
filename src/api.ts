import { accessToken } from './auth'

const baseUrl = import.meta.env.VITE_LEAD_SERVICE_URL ?? '/api'
export type LeadApi = { id:string; name:string; stage:string; estimatedValue?:number; actualValue?:number; lostReason?:string; lastMessage?:string; score?:number; suggestedReply?:string; assignedTo?:string }
export type Interaction = { id:string; message:string; direction:string; createdAt:string }
export type Funnel = { totalLeads:number; leadsByStage:Record<string,number>; wonLeads:number; lostLeads:number; estimatedPipelineValue:number; wonRevenue:number; averageTicket:number; winRatePercent:number; lossesByReason:Record<string,number>; generatedAt:string }
async function request<T>(path:string, init?:RequestInit): Promise<T> {
  const token = await accessToken()
  const response = await fetch(baseUrl + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
  })
  if (!response.ok) throw new Error(`API ${response.status}`)
  return response.json()
}
export const api = { leads: () => request<{content:LeadApi[]}>('/v1/leads?size=20'), funnel: () => request<Funnel>('/v1/reports/sales-funnel'), lead: (id:string) => request<LeadApi>(`/v1/leads/${id}`), interactions: (id:string) => request<Interaction[]>(`/v1/leads/${id}/interactions`), commercial: (id:string, body:object) => request<LeadApi>(`/v1/leads/${id}/commercial`, {method:'PATCH', body:JSON.stringify(body)}), stage: (id:string, stage:string) => request(`/v1/leads/${id}/stage`, {method:'PATCH', body:JSON.stringify({stage, changedBy:'Console'})}) }
