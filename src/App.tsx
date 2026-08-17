import { useEffect, useState } from 'react'
import { api, type Interaction, type LeadApi } from './api'
import './App.css'

const stages = ['CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST']
type Notice = { message: string; type: 'error' | 'success' }

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? `${fallback} (${error.message})` : fallback
}

function interactionDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function App() {
  const [leads, setLeads] = useState<LeadApi[]>([])
  const [lead, setLead] = useState<LeadApi>()
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [selectedId, setSelectedId] = useState<string>()
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [detailLoading, setDetailLoading] = useState(false)
  const [interactionsLoading, setInteractionsLoading] = useState(false)
  const [interactionsError, setInteractionsError] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<Notice>()

  const loadLead = async (id: string) => {
    setSelectedId(id)
    setDetailLoading(true)
    setInteractionsLoading(true)
    setInteractionsError('')
    setNotice(undefined)

    const [leadResult, interactionsResult] = await Promise.allSettled([api.lead(id), api.interactions(id)])
    if (leadResult.status === 'fulfilled') {
      setLead(leadResult.value)
    } else {
      setLead(undefined)
      setNotice({ message: errorMessage(leadResult.reason, 'Não foi possível carregar os dados do lead'), type: 'error' })
    }
    if (interactionsResult.status === 'fulfilled') {
      setInteractions([...interactionsResult.value].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
    } else {
      setInteractions([])
      setInteractionsError(errorMessage(interactionsResult.reason, 'Não foi possível carregar o histórico deste lead'))
    }
    setDetailLoading(false)
    setInteractionsLoading(false)
  }

  const loadLeads = async () => {
    setListLoading(true)
    setListError('')
    setNotice(undefined)
    try {
      const page = await api.leads()
      setLeads(page.content)
      if (page.content[0]) await loadLead(page.content[0].id)
    } catch (error) {
      const message = errorMessage(error, 'Não foi possível carregar os leads')
      setListError(message)
      setNotice({ message, type: 'error' })
    } finally {
      setListLoading(false)
    }
  }

  useEffect(() => { void loadLeads() }, [])

  const save = async (patch: object) => {
    if (!lead) return
    setSaving(true)
    setNotice(undefined)
    try {
      const updated = await api.commercial(lead.id, patch)
      setLead(updated)
      setLeads((items) => items.map((item) => item.id === updated.id ? { ...item, ...updated } : item))
      setNotice({ message: 'Alterações salvas.', type: 'success' })
    } catch (error) {
      setNotice({ message: errorMessage(error, 'Não foi possível salvar as alterações'), type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const changeStage = async (stage: string) => {
    if (!lead) return
    setSaving(true)
    setNotice(undefined)
    try {
      await api.stage(lead.id, stage)
      const updated = await api.lead(lead.id)
      setLead(updated)
      setLeads((items) => items.map((item) => item.id === updated.id ? { ...item, ...updated } : item))
      setNotice({ message: 'Etapa atualizada.', type: 'success' })
    } catch (error) {
      setNotice({ message: errorMessage(error, 'Não foi possível atualizar a etapa'), type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return <main>
    <aside>
      <div className="brand">anysale<span>console</span></div>
      <nav><b>Leads</b><span className="nav-disabled" title="Relatórios serão disponibilizados em breve">Relatórios</span></nav>
    </aside>
    <section className="content">
      <header>
        <div><p className="eyebrow">Operação comercial</p><h1>Leads e conversões</h1>
          {notice && <p className={`notice ${notice.type}`} role="status">{notice.message}</p>}
        </div>
      </header>
      <div className="workspace">
        <section className="leads" aria-busy={listLoading}>
          <div className="section-head"><h2>Leads</h2><span>{listLoading ? 'Carregando...' : `${leads.length} leads`}</span></div>
          {listLoading && <p className="empty-state">Carregando leads...</p>}
          {!listLoading && listError && <div className="empty-state"><p>{listError}</p><button className="retry" onClick={() => void loadLeads()}>Tentar novamente</button></div>}
          {!listLoading && !listError && leads.length === 0 && <p className="empty-state">Nenhum lead encontrado.</p>}
          {leads.map((item) => <button className={`lead ${selectedId === item.id ? 'active' : ''}`} onClick={() => void loadLead(item.id)} key={item.id} aria-pressed={selectedId === item.id} disabled={detailLoading && selectedId !== item.id}>
            <div className="avatar">{item.name[0]}</div><div><strong>{item.name}</strong><p>{item.lastMessage ?? 'Sem mensagens recentes'}</p></div><span className="stage">{item.stage}</span>
          </button>)}
        </section>
        <section className="detail" aria-busy={detailLoading}>
          {detailLoading && <p className="empty-state">Carregando dados do lead...</p>}
          {!detailLoading && !lead && <p className="empty-state">Selecione um lead para ver os detalhes.</p>}
          {!detailLoading && lead && <>
            <div className="section-head"><h2>{lead.name}</h2>{saving && <span className="saving">Salvando...</span>}</div>
            <p className="ai"><b>IA sugeriu:</b> {lead.suggestedReply ?? 'Sem sugestão disponível.'}</p>
            <div className="timeline-section">
              <div className="section-head"><h3>Histórico de interações</h3>{interactionsLoading && <span>Carregando...</span>}</div>
              {interactionsError && <p className="inline-error">{interactionsError}</p>}
              {!interactionsLoading && !interactionsError && interactions.length === 0 && <p className="empty-state">Ainda não há interações registradas.</p>}
              {!interactionsLoading && interactions.length > 0 && <div className="timeline">{interactions.map((interaction) => <article key={interaction.id} className="interaction"><div><b>{interaction.direction === 'OUTBOUND' ? 'Enviado' : 'Recebido'}</b><time>{interactionDate(interaction.createdAt)}</time></div><p>{interaction.message}</p></article>)}</div>}
            </div>
            <div className="form-fields">
              <label>Responsável<select value={lead.assignedTo ?? ''} onChange={(event) => void save({ assignedTo: event.target.value })} disabled={saving}><option value="">Sem responsável</option><option>Guilherme Maschio</option><option>Time Comercial</option></select></label>
              <label>Etapa<select value={lead.stage} onChange={(event) => void changeStage(event.target.value)} disabled={saving}>{stages.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>Valor estimado<input type="number" value={lead.estimatedValue ?? ''} onChange={(event) => setLead({ ...lead, estimatedValue: event.target.value === '' ? undefined : Number(event.target.value) })} onBlur={(event) => void save({ estimatedValue: event.target.value === '' ? undefined : Number(event.target.value) })} disabled={saving} /></label>
              <label>Valor realizado<input type="number" value={lead.actualValue ?? ''} onChange={(event) => setLead({ ...lead, actualValue: event.target.value === '' ? undefined : Number(event.target.value) })} onBlur={(event) => void save({ actualValue: event.target.value === '' ? undefined : Number(event.target.value) })} disabled={saving} /></label>
              {lead.stage === 'LOST' && <label>Motivo de perda<input value={lead.lostReason ?? ''} onChange={(event) => setLead({ ...lead, lostReason: event.target.value })} onBlur={(event) => void save({ lostReason: event.target.value })} disabled={saving} /></label>}
            </div>
            <div className="actions"><button className="secondary" disabled title="A edição da sugestão depende de uma integração ainda não disponível">Editar sugestão</button><button disabled title="O envio pelo WhatsApp depende de uma integração ainda não disponível">Enviar no WhatsApp</button></div>
            <p className="action-hint">A edição de sugestões e o envio por WhatsApp serão liberados quando suas integrações estiverem disponíveis.</p>
          </>}
        </section>
      </div>
    </section>
  </main>
}
