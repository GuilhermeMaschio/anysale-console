import { useEffect, useState } from 'react'
import { api, type AiSettings, type AiUsage, type Funnel, type Interaction, type LeadApi } from './api'
import keycloak, { currentUserName, isAdministrator, signIn, signOut } from './auth'
import './App.css'

const stages = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST']
const stageLabels: Record<string, string> = {
  NEW: 'Novo',
  CONTACTED: 'Contato iniciado',
  QUALIFIED: 'Qualificado',
  PROPOSAL: 'Proposta enviada',
  WON: 'Fechado — ganho',
  LOST: 'Fechado — perdido',
}
type Notice = { message: string; type: 'error' | 'success' }
type View = 'leads' | 'reports' | 'ai'

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? `${fallback} (${error.message})` : fallback
}

function interactionDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value)
}

function stageClass(stage: string) {
  return `stage stage-${stage.toLowerCase()}`
}

function stageLabel(stage: string) {
  return stageLabels[stage] ?? stage
}

function reportErrorMessage(error: unknown) {
  if (error instanceof Error && /API (401|403)/.test(error.message)) return 'O relatório não está autorizado pelo backend. Verifique a configuração de acesso do serviço; não use tokens secretos no front-end.'
  return errorMessage(error, 'Não foi possível carregar os relatórios')
}

function LoginScreen() {
  return <main className="login-screen">
    <section className="login-card" aria-labelledby="login-title">
      <div className="login-brand"><span>a</span> anysale <em>console</em></div>
      <p className="login-kicker">Acesso seguro</p>
      <h1 id="login-title">Entre para continuar</h1>
      <p>Use sua conta corporativa para acessar a operação comercial.</p>
      <button onClick={() => void signIn()}>Entrar com Keycloak</button>
    </section>
  </main>
}

export default function App() {
  const authenticated = keycloak.authenticated === true
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
  const [message, setMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [stageUpdatingId, setStageUpdatingId] = useState<string>()
  const [draggedLeadId, setDraggedLeadId] = useState<string>()
  const [dragOverStage, setDragOverStage] = useState<string>()
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [conversationOpen, setConversationOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [view, setView] = useState<View>('leads')
  const [funnel, setFunnel] = useState<Funnel>()
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState('')
  const [aiSettings, setAiSettings] = useState<AiSettings>()
  const [aiUsage, setAiUsage] = useState<AiUsage>()
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSaving, setAiSaving] = useState(false)
  const [aiError, setAiError] = useState('')
  const [notice, setNotice] = useState<Notice>()

  const loadLead = async (id: string, openConversation = true) => {
    setSelectedId(id)
    if (openConversation) setConversationOpen(true)
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
      if (page.content[0]) await loadLead(page.content[0].id, false)
    } catch (error) {
      const message = errorMessage(error, 'Não foi possível carregar os leads')
      setListError(message)
      setNotice({ message, type: 'error' })
    } finally {
      setListLoading(false)
    }
  }

  useEffect(() => { if (authenticated) void loadLeads() }, [authenticated])

  useEffect(() => {
    if (!conversationOpen) return
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setConversationOpen(false) }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [conversationOpen])

  const loadReport = async () => {
    setReportLoading(true)
    setReportError('')
    try {
      setFunnel(await api.funnel())
    } catch (error) {
      setReportError(reportErrorMessage(error))
    } finally {
      setReportLoading(false)
    }
  }

  useEffect(() => { if (authenticated && view === 'reports') void loadReport() }, [authenticated, view])

  const loadAi = async () => {
    setAiLoading(true); setAiError('')
    try {
      const [settings, usage] = await Promise.all([api.aiSettings(), api.aiUsage()])
      setAiSettings(settings); setAiUsage(usage)
    } catch (error) { setAiError(errorMessage(error, 'Não foi possível carregar a configuração de IA')) }
    finally { setAiLoading(false) }
  }

  useEffect(() => { if (authenticated && view === 'ai' && isAdministrator()) void loadAi() }, [authenticated, view])

  const saveAi = async () => {
    if (!aiSettings) return
    setAiSaving(true); setAiError('')
    try { setAiSettings(await api.saveAiSettings(aiSettings)); await loadAi() }
    catch (error) { setAiError(errorMessage(error, 'Não foi possível salvar a política de IA')) }
    finally { setAiSaving(false) }
  }

  if (!authenticated) return <LoginScreen />

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

  const updateLeadStage = async (id: string, stage: string) => {
    const current = leads.find((item) => item.id === id)
    if (!current || current.stage === stage) return
    setStageUpdatingId(id)
    setSaving(true)
    setNotice(undefined)
    try {
      await api.stage(id, stage)
      const updated = await api.lead(id)
      if (selectedId === id) setLead(updated)
      setLeads((items) => items.map((item) => item.id === updated.id ? { ...item, ...updated } : item))
      setNotice({ message: 'Etapa atualizada.', type: 'success' })
    } catch (error) {
      setNotice({ message: errorMessage(error, 'Não foi possível atualizar a etapa'), type: 'error' })
    } finally {
      setStageUpdatingId(undefined)
      setSaving(false)
    }
  }

  const changeStage = async (stage: string) => {
    if (lead) await updateLeadStage(lead.id, stage)
  }

  const sendMessage = async () => {
    if (!lead || !message.trim()) return
    setSendingMessage(true)
    setNotice(undefined)
    try {
      await api.sendWhatsApp(lead.id, message.trim())
      setMessage('')
      await loadLead(lead.id, true)
      setNotice({ message: 'Mensagem enviada para o WhatsApp.', type: 'success' })
    } catch (error) {
      const fallback = error instanceof Error && error.message.includes('API 503')
        ? 'O envio pelo WhatsApp ainda não está configurado no servidor.'
        : 'Não foi possível enviar a mensagem'
      setNotice({ message: errorMessage(error, fallback), type: 'error' })
    } finally {
      setSendingMessage(false)
    }
  }

  const estimatedPipeline = leads.reduce((total, item) => total + (item.estimatedValue ?? 0), 0)
  const closedRevenue = leads.reduce((total, item) => total + (item.actualValue ?? 0), 0)
  const wonLeads = leads.filter((item) => item.stage === 'WON').length
  const conversion = leads.length ? Math.round((wonLeads / leads.length) * 100) : 0

  const operatorName = currentUserName()
  const operatorInitials = operatorName.split(' ').filter(Boolean).slice(0, 2).map((name) => name[0]).join('').toUpperCase() || 'OP'

  return <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">a</span><span>anysale</span><em>console</em></div>
      <button className="sidebar-toggle" onClick={() => setSidebarCollapsed((collapsed) => !collapsed)} aria-label={sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'} title={sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}><span>{sidebarCollapsed ? '›' : '‹'}</span><b>{sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}</b></button>
      <div className="workspace-name"><span className="workspace-dot" /><span className="workspace-label">Operação comercial</span></div>
      <nav aria-label="Navegação principal">
        <button className={`nav-item ${view === 'leads' ? 'active' : ''}`} title="Leads" onClick={() => setView('leads')}><span className="nav-icon">◫</span><span className="nav-label">Leads</span><span className="nav-count">{leads.length}</span></button>
        <button className={`nav-item ${view === 'reports' ? 'active' : ''}`} title="Relatórios" onClick={() => setView('reports')}><span className="nav-icon">▥</span><span className="nav-label">Relatórios</span></button>
        {isAdministrator() && <button className={`nav-item ${view === 'ai' ? 'active' : ''}`} title="Configuração de IA" onClick={() => setView('ai')}><span className="nav-icon">✦</span><span className="nav-label">IA</span></button>}
      </nav>
      <div className="sidebar-footer"><span className="status-dot" /><span className="sidebar-footer-label">Integração de leads ativa</span></div>
    </aside>

    <main className="dashboard">
      <header className="topbar">
        <div><p className="eyebrow">Console de vendas</p><h1>{view === 'leads' ? 'Leads e conversões' : view === 'reports' ? 'Relatórios comerciais' : 'Configuração de IA'}</h1><p className="subtitle">{view === 'leads' ? 'Acompanhe as oportunidades e mantenha sua operação em movimento.' : view === 'reports' ? 'Acompanhe os indicadores e o desempenho da sua operação.' : 'Controle o uso da IA e seus limites de operação.'}</p></div>
        <div className="operator"><div className="operator-avatar">{operatorInitials}</div><div><strong>{operatorName}</strong><span>Time comercial</span></div><button className="logout" onClick={() => void signOut()}>Sair</button></div>
      </header>

      {view === 'leads' && notice && <p className={`notice ${notice.type}`} role="status">{notice.message}</p>}

      {view === 'leads' && <>
      <section className="metrics" aria-label="Resumo da operação">
        <article className="metric-card"><div className="metric-icon blue">◫</div><div><p>Leads em acompanhamento</p><strong>{leads.length}</strong><span>Base carregada</span></div></article>
        <article className="metric-card"><div className="metric-icon violet">↗</div><div><p>Potencial em negociação</p><strong>{formatCurrency(estimatedPipeline)}</strong><span>Oportunidades abertas</span></div></article>
        <article className="metric-card"><div className="metric-icon mint">✓</div><div><p>Receita realizada</p><strong>{formatCurrency(closedRevenue)}</strong><span>{wonLeads} negócios ganhos</span></div></article>
        <article className="metric-card"><div className="metric-icon amber">◌</div><div><p>Conversão atual</p><strong>{conversion}%</strong><span>Sobre a base carregada</span></div></article>
      </section>

      <div className="workspace-grid">
        <section className="panel kanban-panel" aria-busy={listLoading}>
          <div className="panel-heading"><div><p className="section-kicker">Carteira</p><h2>Leads por etapa</h2></div><div className="kanban-heading-meta"><span className="pill-count">{listLoading ? 'Carregando' : `${leads.length} no total`}</span><span>Arraste um lead para atualizar a etapa</span></div></div>
          <div className="kanban-board">
            {listLoading && <p className="empty-state">Carregando leads...</p>}
            {!listLoading && listError && <div className="empty-state"><p>{listError}</p><button className="retry" onClick={() => void loadLeads()}>Tentar novamente</button></div>}
            {!listLoading && !listError && leads.length === 0 && <p className="empty-state">Nenhum lead encontrado.</p>}
            {!listLoading && !listError && stages.map((stage) => {
              const stageLeads = leads.filter((item) => item.stage === stage)
              return <section key={stage} className={`kanban-column ${dragOverStage === stage ? 'drop-target' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragOverStage(stage) }} onDragLeave={() => setDragOverStage(undefined)} onDrop={(event) => { event.preventDefault(); if (draggedLeadId) void updateLeadStage(draggedLeadId, stage); setDraggedLeadId(undefined); setDragOverStage(undefined) }}>
                <header className="kanban-column-heading"><span className={stageClass(stage)}>{stageLabel(stage)}</span><b>{stageLeads.length}</b></header>
                <div className="kanban-cards">{stageLeads.map((item) => <button className={`kanban-card ${selectedId === item.id ? 'active' : ''} ${stageUpdatingId === item.id ? 'updating' : ''}`} onClick={() => void loadLead(item.id)} key={item.id} aria-pressed={selectedId === item.id} disabled={detailLoading && selectedId !== item.id} draggable={!detailLoading && !stageUpdatingId} onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; setDraggedLeadId(item.id) }} onDragEnd={() => { setDraggedLeadId(undefined); setDragOverStage(undefined) }}>
                  <div className="kanban-card-top"><div className="avatar">{item.name[0]}</div><span className="drag-handle" aria-hidden="true">⠿</span></div><strong>{item.name}</strong><p>{item.lastMessage ?? 'Sem mensagens recentes'}</p>{item.estimatedValue !== undefined && <small>{formatCurrency(item.estimatedValue)}</small>}
                </button>)}</div>
              </section>
            })}
          </div>
        </section>

        <section className={`panel detail-panel ${conversationOpen ? 'open' : ''}`} aria-busy={detailLoading} aria-label="Painel de atendimento" role="dialog" aria-modal={conversationOpen}>
          {detailLoading && <p className="empty-state">Carregando dados do lead...</p>}
          {!detailLoading && !lead && <p className="empty-state">Selecione um lead para ver os detalhes.</p>}
          {!detailLoading && lead && <>
            <div className="conversation-header"><div className="avatar detail-avatar">{lead.name[0]}</div><div className="conversation-identity"><h2>{lead.name}</h2><div><span className={stageClass(lead.stage)}>{stageLabel(lead.stage)}</span><span className="lead-value">{formatCurrency(lead.actualValue ?? lead.estimatedValue ?? 0)}</span></div></div><button className="details-toggle" onClick={() => setDetailsOpen((isOpen) => !isOpen)} aria-expanded={detailsOpen}>Detalhes <span>{detailsOpen ? '⌃' : '⌄'}</span></button><button className="conversation-close" onClick={() => setConversationOpen(false)} aria-label="Fechar atendimento">×</button>{saving && <span className="saving">Salvando...</span>}</div>

            <section className="conversation-area" aria-label="Conversa com o lead">
              <div className="conversation-heading"><div><p className="section-kicker">Atendimento</p><h3>Histórico da conversa</h3></div>{interactionsLoading && <span className="loading-label">Carregando...</span>}</div>
              {interactionsError && <p className="inline-error">{interactionsError}</p>}
              {!interactionsLoading && !interactionsError && interactions.length === 0 && <div className="conversation-empty"><span>◌</span><p>Ainda não há mensagens nesta conversa.</p></div>}
              {!interactionsLoading && interactions.length > 0 && <div className="conversation-messages">{interactions.map((interaction) => <article key={interaction.id} className={`message-bubble ${interaction.direction === 'OUTBOUND' ? 'outbound' : 'inbound'}`}><p>{interaction.message}</p><footer><span>{interaction.direction === 'OUTBOUND' ? 'Você' : lead.name}</span><time>{interactionDate(interaction.createdAt)}</time></footer></article>)}</div>}
            </section>

            <div className="composer">{lead.suggestedReply && <button className="ai-draft-action" onClick={() => setMessage(lead.suggestedReply ?? '')}>Usar sugestão da IA</button>}<textarea value={message} onChange={(event) => setMessage(event.target.value)} disabled={sendingMessage} placeholder="Digite uma mensagem..." aria-label="Mensagem para o lead" /><div className="composer-footer"><span>{lead.suggestedReply ? 'Revise a sugestão da IA antes de enviar.' : 'A mensagem será enviada pelo WhatsApp do lead.'}</span><button onClick={() => void sendMessage()} disabled={!message.trim() || sendingMessage}>{sendingMessage ? 'Enviando...' : <>Enviar <span>➤</span></>}</button></div></div>

            <section className={`details-drawer ${detailsOpen ? 'open' : ''}`}>
              <button className="details-drawer-heading" onClick={() => setDetailsOpen((isOpen) => !isOpen)} aria-expanded={detailsOpen}><span><b>Informações comerciais</b><small>Etapa, responsável e valores</small></span><span>{detailsOpen ? 'Ocultar' : 'Ver detalhes'} <i>{detailsOpen ? '⌃' : '⌄'}</i></span></button>
              {detailsOpen && <div className="details-content"><div className="form-fields">
                <label>Responsável<select value={lead.assignedTo ?? ''} onChange={(event) => void save({ assignedTo: event.target.value })} disabled={saving}><option value="">Sem responsável</option><option>Guilherme Maschio</option><option>Time Comercial</option></select></label>
                <label>Etapa<select value={lead.stage} onChange={(event) => void changeStage(event.target.value)} disabled={saving}>{stages.map((item) => <option key={item} value={item}>{stageLabel(item)}</option>)}</select></label>
                <label>Potencial em negociação<input type="number" value={lead.estimatedValue ?? ''} onChange={(event) => setLead({ ...lead, estimatedValue: event.target.value === '' ? undefined : Number(event.target.value) })} onBlur={(event) => void save({ estimatedValue: event.target.value === '' ? undefined : Number(event.target.value) })} disabled={saving} /></label>
                <label>Valor realizado<input type="number" value={lead.actualValue ?? ''} onChange={(event) => setLead({ ...lead, actualValue: event.target.value === '' ? undefined : Number(event.target.value) })} onBlur={(event) => void save({ actualValue: event.target.value === '' ? undefined : Number(event.target.value) })} disabled={saving} /></label>
                {lead.stage === 'LOST' && <label className="full-width">Motivo de perda<input value={lead.lostReason ?? ''} onChange={(event) => setLead({ ...lead, lostReason: event.target.value })} onBlur={(event) => void save({ lostReason: event.target.value })} disabled={saving} /></label>}
              </div>{lead.suggestedReply && <div className="actions"><button className="secondary" onClick={() => { setMessage(lead.suggestedReply ?? ''); setDetailsOpen(false) }}>Usar sugestão da IA</button></div>}</div>}
            </section>
          </>}
        </section>
        {conversationOpen && <button className="conversation-scrim" onClick={() => setConversationOpen(false)} aria-label="Fechar painel de atendimento" />}
      </div>
      </>}

      {view === 'reports' && <section className="reports-view" aria-busy={reportLoading}>
        {reportLoading && <div className="report-state">Carregando indicadores comerciais...</div>}
        {!reportLoading && reportError && <div className="report-state report-error"><p>{reportError}</p><button className="retry" onClick={() => void loadReport()}>Tentar novamente</button></div>}
        {!reportLoading && !reportError && funnel && <>
          <div className="report-updated"><span>Dados reais do funil</span><time>Atualizado em {interactionDate(funnel.generatedAt)}</time><button onClick={() => void loadReport()} aria-label="Atualizar relatórios">↻</button></div>
          <section className="report-kpis" aria-label="Indicadores do funil">
            <article><p>Potencial em negociação</p><strong>{formatCurrency(funnel.estimatedPipelineValue)}</strong><span>{funnel.totalLeads} leads no funil</span></article>
            <article><p>Receita ganha</p><strong>{formatCurrency(funnel.wonRevenue)}</strong><span>{funnel.wonLeads} negócios fechados</span></article>
            <article><p>Ticket médio</p><strong>{formatCurrency(funnel.averageTicket)}</strong><span>Por negócio ganho</span></article>
            <article><p>Conversão</p><strong>{funnel.winRatePercent}%</strong><span>{funnel.lostLeads} perdas registradas</span></article>
          </section>
          <div className="report-grid">
            <section className="report-panel"><div className="report-panel-heading"><div><p className="section-kicker">Funil</p><h2>Distribuição por etapa</h2></div><span>{funnel.totalLeads} leads</span></div><div className="stage-distribution">{stages.map((stage) => { const total = funnel.leadsByStage?.[stage] ?? 0; const width = funnel.totalLeads ? Math.round((total / funnel.totalLeads) * 100) : 0; return <div className="stage-row" key={stage}><div><span className={stageClass(stage)}>{stageLabel(stage)}</span><b>{total}</b></div><div className="stage-track"><i className={`stage-fill stage-${stage.toLowerCase()}`} style={{ width: `${width}%` }} /></div><small>{width}% da base</small></div>})}</div></section>
            <section className="report-panel"><div className="report-panel-heading"><div><p className="section-kicker">Perdas</p><h2>Motivos de perda</h2></div><span>{funnel.lostLeads} fechados — perdido</span></div>{Object.keys(funnel.lossesByReason ?? {}).length === 0 ? <p className="report-empty">Não há motivos de perda registrados no período.</p> : <div className="loss-list">{Object.entries(funnel.lossesByReason).sort(([, first], [, second]) => second - first).map(([reason, total]) => <div className="loss-row" key={reason}><span>{reason || 'Não informado'}</span><b>{total}</b></div>)}</div>}</section>
          </div>
        </>}
      </section>}

      {view === 'ai' && isAdministrator() && <section className="ai-view" aria-busy={aiLoading}>
        {aiLoading && <div className="report-state">Carregando configuração de IA...</div>}
        {!aiLoading && aiError && <div className="report-state report-error"><p>{aiError}</p><button className="retry" onClick={() => void loadAi()}>Tentar novamente</button></div>}
        {!aiLoading && !aiError && aiSettings && <>
          <div className="ai-warning">A chave da OpenAI permanece somente no servidor. A IA só pode operar se o ambiente também estiver habilitado.</div>
          {!aiSettings.providerAvailable && <div className="ai-warning muted">O provedor não está pronto no ambiente. Confirme a flag de habilitação e a chave técnica no Lead Service; salvar esta tela, por si só, não ativa a IA.</div>}
          <div className="ai-grid">
            <section className="report-panel ai-settings-panel"><div className="report-panel-heading"><div><p className="section-kicker">Política</p><h2>Como a IA responde</h2></div></div>
              <div className="ai-form">
                <label className="ai-toggle"><input type="checkbox" checked={aiSettings.enabled} onChange={(event) => setAiSettings({...aiSettings, enabled:event.target.checked})} /><span>Usar IA para enriquecer conversas</span></label>
                <label>Modelo
                  <select value={aiSettings.model ?? ''} onChange={(event) => setAiSettings({...aiSettings, model:event.target.value})}>
                    <option value="">Selecione um modelo</option>{aiSettings.allowedModels.map((model) => <option key={model} value={model}>{model}</option>)}
                  </select>
                </label>
                {aiSettings.allowedModels.length === 0 && <p className="field-help">Nenhum modelo foi liberado pelo ambiente. Defina <code>OPENAI_ALLOWED_MODELS</code> no servidor.</p>}
                <label>Máximo de tokens por resposta<input type="number" min="100" max="4000" value={aiSettings.maxOutputTokens} onChange={(event) => setAiSettings({...aiSettings, maxOutputTokens:Number(event.target.value)})} /></label>
                <label>Limite mensal de requisições <input type="number" min="1" placeholder="Sem limite" value={aiSettings.monthlyRequestLimit ?? ''} onChange={(event) => setAiSettings({...aiSettings, monthlyRequestLimit:event.target.value ? Number(event.target.value) : undefined})} /></label>
                <label>Limite mensal de tokens <input type="number" min="1" placeholder="Sem limite" value={aiSettings.monthlyTokenLimit ?? ''} onChange={(event) => setAiSettings({...aiSettings, monthlyTokenLimit:event.target.value ? Number(event.target.value) : undefined})} /></label>
                <button className="ai-save" onClick={() => void saveAi()} disabled={aiSaving}>{aiSaving ? 'Salvando...' : 'Salvar política'}</button>
              </div>
            </section>
            <section className="report-panel"><div className="report-panel-heading"><div><p className="section-kicker">Consumo</p><h2>{aiUsage?.month ?? 'Mês atual'}</h2></div><button onClick={() => void loadAi()} aria-label="Atualizar consumo">↻</button></div>
              <div className="ai-usage"><div><span>Requisições</span><strong>{aiUsage?.requests ?? 0}</strong><small>{aiUsage?.monthlyRequestLimit ? `de ${aiUsage.monthlyRequestLimit} permitidas` : 'sem limite configurado'}</small></div><div><span>Tokens totais</span><strong>{aiUsage?.totalTokens ?? 0}</strong><small>{aiUsage?.monthlyTokenLimit ? `de ${aiUsage.monthlyTokenLimit} permitidos` : 'sem limite configurado'}</small></div><div><span>Entrada</span><strong>{aiUsage?.inputTokens ?? 0}</strong><small>contexto enviado</small></div><div><span>Saída</span><strong>{aiUsage?.outputTokens ?? 0}</strong><small>respostas geradas</small></div></div>
              <p className="field-help">O Console exibe tokens reais retornados pelo provedor. O custo em moeda não é estimado automaticamente, pois depende da tabela comercial vigente do modelo escolhido.</p>
            </section>
          </div>
        </>}
      </section>}
    </main>
  </div>
}
