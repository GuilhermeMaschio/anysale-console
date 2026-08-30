import { useEffect, useState } from 'react'
import { api, catalogApi, type AiSettings, type AiSkill, type AiUsage, type CadenceStep, type Funnel, type Interaction, type LeadApi, type LeadCadence, type LeadTask, type Product, type SalesPlaybook } from './api'
import keycloak, { currentUserName, isAdministrator, signIn, signOut } from './auth'
import './App.css'
import './Cadence.css'
import './TaskQueue.css'
import './Playbook.css'

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
type View = 'leads' | 'tasks' | 'cadences' | 'products' | 'reports' | 'ai'

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
  const [generatingSuggestion, setGeneratingSuggestion] = useState(false)
  const [testMessage, setTestMessage] = useState('')
  const [testDirection, setTestDirection] = useState<'IN' | 'OUT'>('IN')
  const [addingTestMessage, setAddingTestMessage] = useState(false)
  const [testInteractionFeedback, setTestInteractionFeedback] = useState<Notice>()
  const [aiSuggestionFeedback, setAiSuggestionFeedback] = useState<Notice>()
  const [stageUpdatingId, setStageUpdatingId] = useState<string>()
  const [draggedLeadId, setDraggedLeadId] = useState<string>()
  const [dragOverStage, setDragOverStage] = useState<string>()
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [conversationOpen, setConversationOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [colorTheme, setColorTheme] = useState<'light' | 'dark'>('light')
  const [savingTheme, setSavingTheme] = useState(false)
  const [view, setView] = useState<View>('leads')
  const [products, setProducts] = useState<Product[]>([])
  const [productImageUrls, setProductImageUrls] = useState<Record<string, string>>({})
  const [productsLoading, setProductsLoading] = useState(false)
  const [productsError, setProductsError] = useState('')
  const [productFormOpen, setProductFormOpen] = useState(false)
  const [productSaving, setProductSaving] = useState(false)
  const [productForm, setProductForm] = useState({ sku: '', title: '', category: '', description: '', price: '', reorderPoint: '0', initialStock: '0' })
  const [productImage, setProductImage] = useState<File>()
  const [funnel, setFunnel] = useState<Funnel>()
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState('')
  const [aiSettings, setAiSettings] = useState<AiSettings>()
  const [aiUsage, setAiUsage] = useState<AiUsage>()
  const [aiSkills, setAiSkills] = useState<AiSkill[]>([])
  const [selectedSkillProfile, setSelectedSkillProfile] = useState('CONSULTATIVE')
  const [skillDraft, setSkillDraft] = useState('')
  const [skillSaving, setSkillSaving] = useState(false)
  const [aiTab, setAiTab] = useState<'policy' | 'skills'>('policy')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSaving, setAiSaving] = useState(false)
  const [aiError, setAiError] = useState('')
  const [notice, setNotice] = useState<Notice>()
  const [playbooks, setPlaybooks] = useState<SalesPlaybook[]>([])
  const [selectedPlaybookId, setSelectedPlaybookId] = useState('')
  const [cadenceSteps, setCadenceSteps] = useState<CadenceStep[]>([])
  const [cadenceLoading, setCadenceLoading] = useState(false)
  const [cadenceSaving, setCadenceSaving] = useState(false)
  const [cadenceError, setCadenceError] = useState('')
  const [leadCadence, setLeadCadence] = useState<LeadCadence>()
  const [leadCadenceLoading, setLeadCadenceLoading] = useState(false)
  const [availableTasks, setAvailableTasks] = useState<LeadTask[]>([])
  const [myTasks, setMyTasks] = useState<LeadTask[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [tasksError, setTasksError] = useState('')
  const [taskUpdatingId, setTaskUpdatingId] = useState<string>()
  const [playbookFormOpen, setPlaybookFormOpen] = useState(false)
  const [playbookSaving, setPlaybookSaving] = useState(false)
  const [editingPlaybookId, setEditingPlaybookId] = useState<string>()
  const [playbookForm, setPlaybookForm] = useState({name:'', description:'', categories:'', active:true, defaultPlaybook:false})

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
      void loadLeadCadence(leadResult.value.id)
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

  const loadLeadCadence = async (leadId: string) => {
    setLeadCadenceLoading(true)
    try { setLeadCadence(await api.leadCadence(leadId)) }
    catch { setLeadCadence(undefined) }
    finally { setLeadCadenceLoading(false) }
  }

  const loadCadences = async () => {
    setCadenceLoading(true); setCadenceError('')
    try {
      const available = await api.playbooks()
      setPlaybooks(available)
      const selected = available.find((playbook) => playbook.id === selectedPlaybookId) ?? available[0]
      if (selected) { setSelectedPlaybookId(selected.id); setCadenceSteps(await api.cadenceSteps(selected.id)) }
      else setCadenceSteps([])
    } catch (error) { setCadenceError(errorMessage(error, 'Não foi possível carregar os playbooks')) }
    finally { setCadenceLoading(false) }
  }

  const selectPlaybook = async (id: string) => {
    setSelectedPlaybookId(id); setCadenceLoading(true); setCadenceError('')
    try { setCadenceSteps(await api.cadenceSteps(id)) }
    catch (error) { setCadenceError(errorMessage(error, 'Não foi possível carregar as etapas')) }
    finally { setCadenceLoading(false) }
  }

  const editPlaybook = (playbook?: SalesPlaybook) => {
    setEditingPlaybookId(playbook?.id)
    setPlaybookForm(playbook ? {name:playbook.name, description:playbook.description ?? '', categories:playbook.categories.join(', '), active:playbook.active, defaultPlaybook:playbook.defaultPlaybook} : {name:'', description:'', categories:'', active:true, defaultPlaybook:playbooks.length === 0})
    setPlaybookFormOpen(true)
  }

  const savePlaybook = async () => {
    setPlaybookSaving(true); setCadenceError('')
    try {
      const body = {...playbookForm, categories:playbookForm.categories.split(',').map((value) => value.trim()).filter(Boolean)}
      const saved = editingPlaybookId ? await api.updatePlaybook(editingPlaybookId, body) : await api.createPlaybook(body)
      setPlaybookFormOpen(false); await loadCadences(); await selectPlaybook(saved.id)
    } catch (error) { setCadenceError(errorMessage(error, 'Não foi possível salvar o playbook')) }
    finally { setPlaybookSaving(false) }
  }

  const saveCadenceSteps = async () => {
    if (!selectedPlaybookId) return
    setCadenceSaving(true); setCadenceError('')
    try { setCadenceSteps(await api.saveCadenceSteps(selectedPlaybookId, cadenceSteps)); setNotice({message:'Etapas da cadência salvas.', type:'success'}) }
    catch (error) { setCadenceError(errorMessage(error, 'Não foi possível salvar as etapas')) }
    finally { setCadenceSaving(false) }
  }

  const operateLeadCadence = async (action: 'start' | 'pause' | 'resume' | 'cancel') => {
    if (!lead) return
    setLeadCadenceLoading(true)
    try {
      const call = action === 'start' ? api.startCadence : action === 'pause' ? api.pauseCadence : action === 'resume' ? api.resumeCadence : api.cancelCadence
      setLeadCadence(await call(lead.id))
    } catch (error) { setNotice({message:errorMessage(error, 'Não foi possível atualizar a cadência'), type:'error'}) }
    finally { setLeadCadenceLoading(false) }
  }

  const loadTasks = async () => {
    setTasksLoading(true); setTasksError('')
    try {
      const [available, mine] = await Promise.all([api.tasks('available'), api.tasks('mine')])
      setAvailableTasks(available.content); setMyTasks(mine.content)
    } catch (error) { setTasksError(errorMessage(error, 'Não foi possível carregar a fila de tarefas')) }
    finally { setTasksLoading(false) }
  }

  const updateTask = async (task: LeadTask, action: 'claim' | 'release' | 'complete' | 'snooze') => {
    setTaskUpdatingId(task.id); setTasksError('')
    try {
      if (action === 'claim') await api.claimTask(task.id)
      if (action === 'release') await api.releaseTask(task.id)
      if (action === 'complete') await api.completeTask(task.id, 'OTHER')
      if (action === 'snooze') await api.snoozeTask(task.id, new Date(Date.now() + 60 * 60 * 1000).toISOString(), 'Adiado pelo atendente')
      await loadTasks()
    } catch (error) { setTasksError(errorMessage(error, 'Não foi possível atualizar a tarefa')) }
    finally { setTaskUpdatingId(undefined) }
  }

  useEffect(() => {
    if (!authenticated) return
    void api.consolePreference().then((preference) => setColorTheme(preference.colorTheme)).catch(() => undefined)
  }, [authenticated])

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
  useEffect(() => { if (authenticated && view === 'cadences') void loadCadences() }, [authenticated, view])
  useEffect(() => { if (authenticated && view === 'tasks') void loadTasks() }, [authenticated, view])
  const loadProducts = async () => { setProductsLoading(true); setProductsError(''); try { setProducts(await catalogApi.products()) } catch (error) { setProductsError(errorMessage(error, 'Não foi possível carregar os produtos')) } finally { setProductsLoading(false) } }
  useEffect(() => { if (authenticated && view === 'products') void loadProducts() }, [authenticated, view])
  useEffect(() => {
    let cancelled = false
    const urls: string[] = []
    const productsWithImage = products.filter((product) => product.hasImage)
    if (productsWithImage.length === 0) { setProductImageUrls({}); return }
    void Promise.all(productsWithImage.map(async (product) => {
      try { const url = await catalogApi.imageUrl(product.id); urls.push(url); return [product.id, url] as const } catch { return undefined }
    })).then((entries) => { if (!cancelled) setProductImageUrls(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => entry !== undefined))) })
    return () => { cancelled = true; urls.forEach((url) => URL.revokeObjectURL(url)) }
  }, [products])
  const saveProduct = async () => { setProductSaving(true); try { const product = await catalogApi.createProduct({ ...productForm, price: Number(productForm.price), reorderPoint: Number(productForm.reorderPoint), initialStock: Number(productForm.initialStock), available: true, currency: 'BRL', tags: [] }); if (productImage) await catalogApi.uploadImage(product.id, productImage); setProductFormOpen(false); setProductImage(undefined); setProductForm({ sku: '', title: '', category: '', description: '', price: '', reorderPoint: '0', initialStock: '0' }); await loadProducts() } catch (error) { setProductsError(errorMessage(error, 'Não foi possível salvar o produto')) } finally { setProductSaving(false) } }
  const archiveProduct = async (product: Product) => { if (!window.confirm(`Excluir ${product.title} da listagem? O histórico de estoque será preservado.`)) return; try { await catalogApi.archiveProduct(product.id); await loadProducts() } catch (error) { setProductsError(errorMessage(error, 'Não foi possível excluir o produto')) } }

  const loadAi = async () => {
    setAiLoading(true); setAiError('')
    try {
      const [settings, usage, skills] = await Promise.all([api.aiSettings(), api.aiUsage(), api.aiSkills()])
      setAiSettings(settings); setAiUsage(usage); setAiSkills(skills)
      const selected = skills.find((skill) => skill.profile === selectedSkillProfile) ?? skills[0]
      if (selected) { setSelectedSkillProfile(selected.profile); setSkillDraft(selected.content) }
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
  const selectSkill = (profile: string) => { const skill = aiSkills.find((item) => item.profile === profile); if (skill) { setSelectedSkillProfile(profile); setSkillDraft(skill.content) } }
  const saveSkill = async () => { setSkillSaving(true); setAiError(''); try { const updated = await api.saveAiSkill(selectedSkillProfile, skillDraft); setAiSkills((skills) => skills.map((skill) => skill.profile === updated.profile ? updated : skill)); setSkillDraft(updated.content) } catch (error) { setAiError(errorMessage(error, 'Não foi possível salvar a skill')) } finally { setSkillSaving(false) } }
  const resetSkill = async () => { if (!window.confirm('Restaurar o texto padrão desta skill? A personalização desta empresa será removida.')) return; setSkillSaving(true); try { await api.resetAiSkill(selectedSkillProfile); await loadAi() } catch (error) { setAiError(errorMessage(error, 'Não foi possível restaurar a skill')) } finally { setSkillSaving(false) } }

  const toggleTheme = async () => {
    const nextTheme = colorTheme === 'light' ? 'dark' : 'light'
    setSavingTheme(true)
    try {
      const preference = await api.saveConsolePreference(nextTheme)
      setColorTheme(preference.colorTheme)
    } catch (error) {
      setNotice({ message: errorMessage(error, 'Não foi possível salvar a preferência visual'), type: 'error' })
    } finally {
      setSavingTheme(false)
    }
  }

  const generateAiSuggestion = async () => {
    if (!lead) return
    setGeneratingSuggestion(true)
    setNotice(undefined)
    setAiSuggestionFeedback(undefined)
    try {
      const updated = await api.enrichWithAi(lead.id)
      setLead(updated)
      setLeads((items) => items.map((item) => item.id === updated.id ? { ...item, ...updated } : item))
      if (updated.suggestedReply) setMessage(updated.suggestedReply)
      const providerMessage = updated.aiProviderStatus === 'OPENAI'
        ? 'Sugestão gerada pela OpenAI. Revise antes de enviar.'
        : updated.aiProviderStatus === 'HTTP_401'
          ? 'A OpenAI recusou a autenticação (HTTP 401). Gere uma nova chave de API e reinicie o Lead Service.'
        : updated.aiProviderStatus === 'HTTP_429'
          ? 'A OpenAI recusou por cota ou crédito (HTTP 429). Confira o faturamento da API na OpenAI Platform.'
        : updated.aiProviderStatus === 'HTTP_404'
          ? 'O modelo configurado não está disponível para esta chave (HTTP 404). Confira o modelo liberado no servidor.'
        : updated.aiProviderStatus === 'NOT_READY'
          ? 'A OpenAI não está pronta no servidor. Confira a política de IA e as variáveis do Lead Service.'
        : updated.aiProviderStatus?.startsWith('INCOMPLETE_')
          ? 'A OpenAI não concluiu a resposta dentro do limite atual. Aumente o máximo de tokens por resposta na política de IA e tente novamente.'
        : updated.aiProviderStatus && updated.aiProviderStatus !== 'NOT_ATTEMPTED'
          ? `A OpenAI não respondeu (${updated.aiProviderStatus}); foi usada a sugestão local de contingência.`
          : 'A IA analisou a conversa, mas não gerou uma sugestão. Adicione mensagens ao histórico e tente novamente.'
      const feedback = { message: providerMessage, type: updated.aiProviderStatus === 'OPENAI' ? 'success' : 'error' } as const
      setAiSuggestionFeedback(feedback)
      setNotice(feedback)
    } catch (error) {
      const feedback = { message: errorMessage(error, 'Não foi possível gerar a sugestão da IA'), type: 'error' } as const
      setAiSuggestionFeedback(feedback)
      setNotice(feedback)
    } finally {
      setGeneratingSuggestion(false)
    }
  }

  const addTestMessage = async () => {
    if (!lead || !testMessage.trim()) return
    setAddingTestMessage(true)
    setTestInteractionFeedback(undefined)
    setNotice(undefined)
    try {
      const interaction = await api.addTestInteraction(lead.id, testMessage.trim(), testDirection)
      setTestMessage('')
      setInteractions((items) => [interaction, ...items])
      const updatedLead = { ...lead, lastMessage: interaction.message }
      setLead(updatedLead)
      setLeads((items) => items.map((item) => item.id === updatedLead.id ? { ...item, lastMessage: interaction.message } : item))
      const feedback = { message: 'Mensagem adicionada ao histórico. Ela não foi enviada ao WhatsApp.', type: 'success' } as const
      setTestInteractionFeedback(feedback)
      setNotice(feedback)
    } catch (error) {
      const feedback = { message: errorMessage(error, 'Não foi possível adicionar a mensagem de teste'), type: 'error' } as const
      setTestInteractionFeedback(feedback)
      setNotice(feedback)
    } finally {
      setAddingTestMessage(false)
    }
  }

  const estimatedPipeline = leads.reduce((total, item) => total + (item.estimatedValue ?? 0), 0)
  const closedRevenue = leads.reduce((total, item) => total + (item.actualValue ?? 0), 0)
  const wonLeads = leads.filter((item) => item.stage === 'WON').length
  const conversion = leads.length ? Math.round((wonLeads / leads.length) * 100) : 0

  const operatorName = currentUserName()
  const operatorInitials = operatorName.split(' ').filter(Boolean).slice(0, 2).map((name) => name[0]).join('').toUpperCase() || 'OP'

  return <div className={`app-shell theme-${colorTheme} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
    <aside className="sidebar">
      <div className="brand"><img className="brand-mark" src="/anysale-mark.svg" alt="" /><span>anysale</span><em>console</em></div>
      <button className="sidebar-toggle" onClick={() => setSidebarCollapsed((collapsed) => !collapsed)} aria-label={sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'} title={sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}><span>{sidebarCollapsed ? '›' : '‹'}</span><b>{sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}</b></button>
      <div className="workspace-name"><span className="workspace-dot" /><span className="workspace-label">Operação comercial</span></div>
      <nav aria-label="Navegação principal">
        <button className={`nav-item ${view === 'leads' ? 'active' : ''}`} title="Leads" onClick={() => setView('leads')}><span className="nav-icon">◫</span><span className="nav-label">Leads</span><span className="nav-count">{leads.length}</span></button>
        <button className={`nav-item ${view === 'tasks' ? 'active' : ''}`} title="Fila de tarefas" onClick={() => setView('tasks')}><span className="nav-icon">✓</span><span className="nav-label">Tarefas</span>{myTasks.length > 0 && <span className="nav-count">{myTasks.length}</span>}</button>
        <button className={`nav-item ${view === 'cadences' ? 'active' : ''}`} title="Cadências" onClick={() => setView('cadences')}><span className="nav-icon">◷</span><span className="nav-label">Cadências</span></button>
        <button className={`nav-item ${view === 'products' ? 'active' : ''}`} title="Produtos e estoque" onClick={() => setView('products')}><span className="nav-icon">▣</span><span className="nav-label">Produtos</span></button>
        <button className={`nav-item ${view === 'reports' ? 'active' : ''}`} title="Relatórios" onClick={() => setView('reports')}><span className="nav-icon">▥</span><span className="nav-label">Relatórios</span></button>
        {isAdministrator() && <button className={`nav-item ${view === 'ai' ? 'active' : ''}`} title="Configuração de IA" onClick={() => setView('ai')}><span className="nav-icon">✦</span><span className="nav-label">IA</span></button>}
      </nav>
      <div className="sidebar-footer"><span className="status-dot" /><span className="sidebar-footer-label">Integração de leads ativa</span></div>
    </aside>

    <main className="dashboard">
      <header className="topbar">
        <div><p className="eyebrow">Console de vendas</p><h1>{view === 'leads' ? 'Leads e conversões' : view === 'tasks' ? 'Fila de tarefas' : view === 'cadences' ? 'Cadências comerciais' : view === 'products' ? 'Produtos e estoque' : view === 'reports' ? 'Relatórios comerciais' : 'Configuração de IA'}</h1><p className="subtitle">{view === 'leads' ? 'Acompanhe as oportunidades e mantenha sua operação em movimento.' : view === 'tasks' ? 'Assuma e conclua os próximos passos do atendimento.' : view === 'cadences' ? 'Defina os próximos passos automáticos para cada tipo de venda.' : view === 'products' ? 'Gerencie os itens disponíveis para a sua operação comercial.' : view === 'reports' ? 'Acompanhe os indicadores e o desempenho da sua operação.' : 'Controle o uso da IA e seus limites de operação.'}</p></div>
        <div className="topbar-actions"><button className="theme-toggle" onClick={() => void toggleTheme()} disabled={savingTheme} aria-label="Alternar tema">{colorTheme === 'light' ? '◐ Modo escuro' : '☀ Modo claro'}</button><div className="operator"><div className="operator-avatar">{operatorInitials}</div><div><strong>{operatorName}</strong><span>Time comercial</span></div><button className="logout" onClick={() => void signOut()}>Sair</button></div></div>
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
              {!interactionsLoading && interactions.length > 0 && <div className="conversation-messages">{interactions.map((interaction) => { const outbound = interaction.direction === 'OUTBOUND' || interaction.direction === 'OUT'; return <article key={interaction.id} className={`message-bubble ${outbound ? 'outbound' : 'inbound'}`}><p>{interaction.message}</p><footer><span>{outbound ? 'Equipe comercial' : lead.name}</span><time>{interactionDate(interaction.createdAt)}</time></footer></article> })}</div>}
            </section>

            <div className="composer">{import.meta.env.DEV && <details className="conversation-test"><summary>Adicionar mensagem de teste</summary><div className="conversation-test-fields"><select value={testDirection} onChange={(event) => setTestDirection(event.target.value as 'IN' | 'OUT')} aria-label="Remetente da mensagem de teste"><option value="IN">Cliente</option><option value="OUT">Equipe comercial</option></select><textarea value={testMessage} onChange={(event) => setTestMessage(event.target.value)} disabled={addingTestMessage} placeholder="Escreva uma mensagem para compor o contexto da IA..." aria-label="Mensagem de teste" /><button className="secondary" onClick={() => void addTestMessage()} disabled={!testMessage.trim() || addingTestMessage}>{addingTestMessage ? 'Adicionando...' : 'Adicionar ao histórico'}</button></div>{testInteractionFeedback && <p className={`conversation-test-feedback ${testInteractionFeedback.type}`}>{testInteractionFeedback.message}</p>}<small>Disponível apenas no Console local; não envia WhatsApp nem aciona a IA.</small></details>}<button className="ai-draft-action" onClick={() => void generateAiSuggestion()} disabled={generatingSuggestion}>{generatingSuggestion ? 'Gerando sugestão...' : lead.suggestedReply ? 'Atualizar sugestão da IA' : 'Gerar sugestão da IA'}</button>{aiSuggestionFeedback && <p className={`conversation-test-feedback ${aiSuggestionFeedback.type}`} role="status">{aiSuggestionFeedback.message}</p>}<textarea value={message} onChange={(event) => setMessage(event.target.value)} disabled={sendingMessage || generatingSuggestion} placeholder="Digite uma mensagem..." aria-label="Mensagem para o lead" /><div className="composer-footer"><span>{lead.suggestedReply ? 'Revise a sugestão da IA antes de enviar.' : 'A mensagem será enviada pelo WhatsApp do lead.'}</span><button onClick={() => void sendMessage()} disabled={!message.trim() || sendingMessage || generatingSuggestion}>{sendingMessage ? 'Enviando...' : <>Enviar <span>➤</span></>}</button></div></div>

            <section className={`details-drawer ${detailsOpen ? 'open' : ''}`}>
              <button className="details-drawer-heading" onClick={() => setDetailsOpen((isOpen) => !isOpen)} aria-expanded={detailsOpen}><span><b>Informações comerciais</b><small>Etapa, responsável e valores</small></span><span>{detailsOpen ? 'Ocultar' : 'Ver detalhes'} <i>{detailsOpen ? '⌃' : '⌄'}</i></span></button>
              {detailsOpen && <div className="details-content"><section className="lead-cadence-card"><div><b>Cadência comercial</b><small>{leadCadenceLoading ? 'Consultando...' : leadCadence ? `${leadCadence.playbookName} · ${leadCadence.status}` : 'Nenhuma cadência ativa'}</small>{leadCadence?.nextActionAt && <small>Próxima tarefa: {interactionDate(leadCadence.nextActionAt)}</small>}</div><div className="lead-cadence-actions">{!leadCadence && <button className="secondary" onClick={() => void operateLeadCadence('start')} disabled={leadCadenceLoading}>Iniciar</button>}{leadCadence?.status === 'ACTIVE' && <button className="secondary" onClick={() => void operateLeadCadence('pause')} disabled={leadCadenceLoading}>Pausar</button>}{leadCadence?.status === 'PAUSED' && <button className="secondary" onClick={() => void operateLeadCadence('resume')} disabled={leadCadenceLoading}>Retomar</button>}{leadCadence && !['COMPLETED','CANCELLED'].includes(leadCadence.status) && <button className="secondary" onClick={() => void operateLeadCadence('cancel')} disabled={leadCadenceLoading}>Cancelar</button>}</div></section><div className="form-fields">
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

      {view === 'tasks' && <section className="tasks-view" aria-busy={tasksLoading}>
        {tasksError && <div className="report-state report-error"><p>{tasksError}</p><button className="retry" onClick={() => void loadTasks()}>Tentar novamente</button></div>}
        {!tasksError && <div className="task-columns">
          <section className="report-panel"><div className="report-panel-heading"><div><p className="section-kicker">Compartilhada</p><h2>Disponíveis</h2></div><span>{availableTasks.length}</span></div>{tasksLoading && <p className="report-empty">Carregando tarefas...</p>}{!tasksLoading && availableTasks.length === 0 && <p className="report-empty">Nenhuma tarefa aguardando atendimento.</p>}{availableTasks.map((task) => <article className={`task-card priority-${task.priority.toLowerCase()}`} key={task.id}><div><span className="task-type">{task.taskType.replaceAll('_',' ')}</span><time>{interactionDate(task.dueAt)}</time></div><h3>{task.title}</h3><p>{task.leadName}</p>{task.note && <small>{task.note}</small>}<button className="ai-save" onClick={() => void updateTask(task,'claim')} disabled={taskUpdatingId === task.id}>{taskUpdatingId === task.id ? 'Assumindo...' : 'Assumir tarefa'}</button></article>)}</section>
          <section className="report-panel"><div className="report-panel-heading"><div><p className="section-kicker">Minha carteira</p><h2>Em andamento</h2></div><span>{myTasks.length}</span></div>{tasksLoading && <p className="report-empty">Carregando tarefas...</p>}{!tasksLoading && myTasks.length === 0 && <p className="report-empty">Você não possui tarefas assumidas.</p>}{myTasks.map((task) => <article className={`task-card priority-${task.priority.toLowerCase()}`} key={task.id}><div><span className="task-type">{task.taskType.replaceAll('_',' ')}</span><time>{interactionDate(task.dueAt)}</time></div><h3>{task.title}</h3><p>{task.leadName}</p>{task.reservationExpiresAt && <small>Reserva até {interactionDate(task.reservationExpiresAt)}</small>}<div className="task-actions"><button className="secondary" onClick={() => void updateTask(task,'snooze')} disabled={taskUpdatingId === task.id}>Adiar 1h</button><button className="secondary" onClick={() => void updateTask(task,'release')} disabled={taskUpdatingId === task.id}>Liberar</button><button className="ai-save" onClick={() => void updateTask(task,'complete')} disabled={taskUpdatingId === task.id}>{taskUpdatingId === task.id ? 'Salvando...' : 'Concluir'}</button></div></article>)}</section>
        </div>}
      </section>}

      {view === 'cadences' && <section className="cadence-view" aria-busy={cadenceLoading}>
        {cadenceError && <div className="report-state report-error"><p>{cadenceError}</p><button className="retry" onClick={() => void loadCadences()}>Tentar novamente</button></div>}
        {!cadenceError && <section className="report-panel cadence-editor">
          <div className="report-panel-heading"><div><p className="section-kicker">Playbook</p><h2>Etapas de acompanhamento</h2></div><div className="cadence-header-actions"><button className="secondary" onClick={() => editPlaybook()}>Novo playbook</button><button onClick={() => void loadCadences()} aria-label="Atualizar playbooks">↻</button></div></div>
          {playbookFormOpen && <section className="playbook-form"><label>Nome<input value={playbookForm.name} onChange={(event) => setPlaybookForm({...playbookForm,name:event.target.value})} placeholder="Ex.: Venda consultiva" /></label><label>Categorias<input value={playbookForm.categories} onChange={(event) => setPlaybookForm({...playbookForm,categories:event.target.value})} placeholder="Ex.: Imóveis, financiamento" /></label><label className="full-width">Descrição<input value={playbookForm.description} onChange={(event) => setPlaybookForm({...playbookForm,description:event.target.value})} placeholder="Quando este playbook deve ser usado" /></label><label className="playbook-check"><input type="checkbox" checked={playbookForm.active} onChange={(event) => setPlaybookForm({...playbookForm,active:event.target.checked})} /> Ativo</label><label className="playbook-check"><input type="checkbox" checked={playbookForm.defaultPlaybook} onChange={(event) => setPlaybookForm({...playbookForm,defaultPlaybook:event.target.checked})} /> Playbook padrão</label><div className="playbook-form-actions"><button className="secondary" onClick={() => setPlaybookFormOpen(false)}>Cancelar</button><button className="ai-save" onClick={() => void savePlaybook()} disabled={playbookSaving || !playbookForm.name.trim()}>{playbookSaving ? 'Salvando...' : 'Salvar playbook'}</button></div></section>}
          {playbooks.length === 0 && !cadenceLoading && <p className="report-empty">Crie um playbook no backend antes de configurar a cadência.</p>}
          {playbooks.length > 0 && <>
            <div className="playbook-select"><label>Playbook comercial<select value={selectedPlaybookId} onChange={(event) => void selectPlaybook(event.target.value)} disabled={cadenceLoading || cadenceSaving}>{playbooks.map((playbook) => <option key={playbook.id} value={playbook.id}>{playbook.name}{playbook.defaultPlaybook ? ' — padrão' : ''}</option>)}</select></label><button className="secondary" onClick={() => editPlaybook(playbooks.find((playbook) => playbook.id === selectedPlaybookId))}>Editar playbook</button></div>
            <p className="field-help">Cada etapa cria uma tarefa na fila compartilhada após o intervalo informado desde a etapa anterior.</p>
            <div className="cadence-step-list">{cadenceSteps.map((step, index) => <article className="cadence-step" key={step.id ?? index}><b>{index + 1}</b><div className="cadence-step-fields"><label>Após (minutos)<input type="number" min="0" value={step.delayMinutes} onChange={(event) => setCadenceSteps((items) => items.map((item, itemIndex) => itemIndex === index ? {...item, delayMinutes:Number(event.target.value)} : item))} /></label><label>Tipo<select value={step.taskType} onChange={(event) => setCadenceSteps((items) => items.map((item, itemIndex) => itemIndex === index ? {...item, taskType:event.target.value} : item))}><option value="FOLLOW_UP">Follow-up</option><option value="WHATSAPP_REPLY">Responder WhatsApp</option><option value="CALL">Ligação</option><option value="SEND_PROPOSAL">Enviar proposta</option><option value="SCHEDULE_MEETING">Agendar reunião</option><option value="REACTIVATE">Reativar</option><option value="OTHER">Outro</option></select></label><label>Prioridade<select value={step.priority} onChange={(event) => setCadenceSteps((items) => items.map((item, itemIndex) => itemIndex === index ? {...item, priority:event.target.value} : item))}><option value="LOW">Baixa</option><option value="NORMAL">Normal</option><option value="HIGH">Alta</option><option value="URGENT">Urgente</option></select></label><label className="full-width">Tarefa<input value={step.title} onChange={(event) => setCadenceSteps((items) => items.map((item, itemIndex) => itemIndex === index ? {...item, title:event.target.value} : item))} placeholder="Ex.: Retomar conversa pelo WhatsApp" /></label><label className="full-width">Orientação opcional<input value={step.note ?? ''} onChange={(event) => setCadenceSteps((items) => items.map((item, itemIndex) => itemIndex === index ? {...item, note:event.target.value} : item))} placeholder="Contexto para quem atender a tarefa" /></label></div><button className="product-delete" onClick={() => setCadenceSteps((items) => items.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remover etapa ${index + 1}`}>Remover</button></article>)}</div>
            <div className="cadence-actions"><button className="secondary" onClick={() => setCadenceSteps((items) => [...items, {position:items.length + 1, delayMinutes:1440, title:'Retomar conversa', taskType:'FOLLOW_UP', priority:'NORMAL'}])}>Adicionar etapa</button><button className="ai-save" onClick={() => void saveCadenceSteps()} disabled={cadenceSaving || cadenceSteps.some((step) => !step.title.trim())}>{cadenceSaving ? 'Salvando...' : 'Salvar etapas'}</button></div>
          </>}
        </section>}
      </section>}

      {view === 'products' && <section className="products-view" aria-busy={productsLoading}>
        <div className="products-toolbar"><p className="field-help">O estoque disponível é a base para sugestões comerciais futuras da IA.</p><button className="ai-save" onClick={() => setProductFormOpen((open) => !open)}>{productFormOpen ? 'Cancelar' : 'Novo produto'}</button></div>
        {productFormOpen && <section className="report-panel product-form"><label>SKU<input value={productForm.sku} onChange={(event) => setProductForm({...productForm, sku:event.target.value})} placeholder="EX.: CAV-001" /></label><label>Produto<input value={productForm.title} onChange={(event) => setProductForm({...productForm, title:event.target.value})} placeholder="Nome do produto" /></label><label>Categoria<input value={productForm.category} onChange={(event) => setProductForm({...productForm, category:event.target.value})} placeholder="Ex.: Cavalos" /></label><label className="full-width">Descrição para a IA<textarea value={productForm.description} onChange={(event) => setProductForm({...productForm, description:event.target.value})} placeholder="Características, diferenciais, condições e informações úteis para recomendar este produto." /></label><label>Foto do produto<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setProductImage(event.target.files?.[0])} /></label><label>Preço (R$)<input type="number" min="0" value={productForm.price} onChange={(event) => setProductForm({...productForm, price:event.target.value})} /></label><label>Estoque inicial<input type="number" min="0" value={productForm.initialStock} onChange={(event) => setProductForm({...productForm, initialStock:event.target.value})} /></label><label>Estoque mínimo<input type="number" min="0" value={productForm.reorderPoint} onChange={(event) => setProductForm({...productForm, reorderPoint:event.target.value})} /></label><button className="ai-save" disabled={productSaving || !productForm.sku || !productForm.title || !productForm.category || !productForm.price} onClick={() => void saveProduct()}>{productSaving ? 'Salvando...' : 'Salvar produto'}</button></section>}
        {productsLoading && <div className="report-state">Carregando produtos...</div>}
        {!productsLoading && productsError && <div className="report-state report-error"><p>{productsError}</p><button className="retry" onClick={() => void loadProducts()}>Tentar novamente</button></div>}
        {!productsLoading && !productsError && <section className="report-panel products-table"><div className="products-table-head"><span>Produto</span><span>Estoque disponível</span><span>Mínimo</span><span>Preço</span><span /></div>{products.length === 0 ? <p className="report-empty">Ainda não há produtos cadastrados para esta empresa.</p> : products.map((product) => <article key={product.id} className={product.lowStock ? 'low-stock' : ''}><div className="product-identity">{productImageUrls[product.id] ? <img className="product-thumbnail" src={productImageUrls[product.id]} alt="" /> : <span className="product-thumbnail product-thumbnail-empty" aria-hidden="true">▣</span>}<div><b>{product.title}</b><small>{product.sku} · {product.category}</small></div></div><strong>{product.availableQuantity}</strong><span>{product.reorderPoint}</span><span>{formatCurrency(product.price)}</span><button className="product-delete" onClick={() => void archiveProduct(product)}>Excluir</button></article>)}</section>}
      </section>}

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
          <div className="ai-tabs" role="tablist" aria-label="Administração de IA">
            <button className={aiTab === 'policy' ? 'active' : ''} role="tab" aria-selected={aiTab === 'policy'} onClick={() => setAiTab('policy')}>Política e consumo</button>
            <button className={aiTab === 'skills' ? 'active' : ''} role="tab" aria-selected={aiTab === 'skills'} onClick={() => setAiTab('skills')}>Skills de atendimento</button>
          </div>
          {aiTab === 'policy' && <div className="ai-grid">
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
                <div className="ai-style-divider"><b>Estilo de atendimento</b><span>Define como a sugestão conversa, sem alterar fatos, preços ou estoque.</span></div>
                <label>Perfil de atendimento<select value={aiSettings.serviceProfile} onChange={(event) => setAiSettings({...aiSettings, serviceProfile:event.target.value})}><option value="CONSULTATIVE">Consultivo</option><option value="DIRECT">Direto</option><option value="PREMIUM">Premium</option><option value="REACTIVATION">Reativação</option></select></label>
                <label>Tom<select value={aiSettings.tone} onChange={(event) => setAiSettings({...aiSettings, tone:event.target.value})}><option value="WARM">Acolhedor</option><option value="NEUTRAL">Neutro</option><option value="TECHNICAL">Técnico</option></select></label>
                <label>Formalidade<select value={aiSettings.formality} onChange={(event) => setAiSettings({...aiSettings, formality:event.target.value})}><option value="INFORMAL">Informal</option><option value="BALANCED">Equilibrada</option><option value="FORMAL">Formal</option></select></label>
                <label>Tamanho da resposta<select value={aiSettings.responseLength} onChange={(event) => setAiSettings({...aiSettings, responseLength:event.target.value})}><option value="CONCISE">Curta</option><option value="BALANCED">Equilibrada</option><option value="DETAILED">Detalhada</option></select></label>
                <label>Postura comercial<select value={aiSettings.commercialApproach} onChange={(event) => setAiSettings({...aiSettings, commercialApproach:event.target.value})}><option value="DISCOVER_FIRST">Entender antes de ofertar</option><option value="OFFER_WHEN_FIT">Ofertar quando houver aderência</option><option value="REACTIVATE">Reativar o contato</option></select></label>
                <label>Instruções adicionais<textarea maxLength={3000} value={aiSettings.customInstructions ?? ''} onChange={(event) => setAiSettings({...aiSettings, customInstructions:event.target.value})} placeholder="Ex.: mencione o primeiro nome; faça somente uma pergunta por vez; não use emojis." /></label>
                <label>Exemplos aprovados<textarea maxLength={4000} value={aiSettings.approvedExamples ?? ''} onChange={(event) => setAiSettings({...aiSettings, approvedExamples:event.target.value})} placeholder="Cole respostas que representam bem o atendimento. Separe exemplos com uma linha em branco." /></label>
                <label>Exemplos a evitar<textarea maxLength={4000} value={aiSettings.rejectedExamples ?? ''} onChange={(event) => setAiSettings({...aiSettings, rejectedExamples:event.target.value})} placeholder="Cole respostas genéricas ou inadequadas que a IA não deve imitar." /></label>
                <button className="ai-save" onClick={() => void saveAi()} disabled={aiSaving}>{aiSaving ? 'Salvando...' : 'Salvar política'}</button>
              </div>
            </section>
            <section className="report-panel"><div className="report-panel-heading"><div><p className="section-kicker">Consumo</p><h2>{aiUsage?.month ?? 'Mês atual'}</h2></div><button onClick={() => void loadAi()} aria-label="Atualizar consumo">↻</button></div>
              <div className="ai-usage"><div><span>Requisições</span><strong>{aiUsage?.requests ?? 0}</strong><small>{aiUsage?.monthlyRequestLimit ? `de ${aiUsage.monthlyRequestLimit} permitidas` : 'sem limite configurado'}</small></div><div><span>Tokens totais</span><strong>{aiUsage?.totalTokens ?? 0}</strong><small>{aiUsage?.monthlyTokenLimit ? `de ${aiUsage.monthlyTokenLimit} permitidos` : 'sem limite configurado'}</small></div><div><span>Entrada</span><strong>{aiUsage?.inputTokens ?? 0}</strong><small>contexto enviado</small></div><div><span>Saída</span><strong>{aiUsage?.outputTokens ?? 0}</strong><small>respostas geradas</small></div></div>
              <p className="field-help">O Console exibe tokens reais retornados pelo provedor. O custo em moeda não é estimado automaticamente, pois depende da tabela comercial vigente do modelo escolhido.</p>
            </section>
          </div>}
          {aiTab === 'skills' && <section className="report-panel ai-skills-panel">
            <div className="report-panel-heading"><div><p className="section-kicker">Skills</p><h2>Roteiros de atendimento</h2></div><span>Por empresa</span></div>
            <p className="field-help">Escolha o tipo de atendimento e ajuste o roteiro em linguagem simples. As regras de segurança, catálogo e estoque continuam protegidas no servidor.</p>
            <div className="skill-layout">
              <nav className="skill-list" aria-label="Skills de atendimento">
                {aiSkills.map((skill) => <button key={skill.profile} className={selectedSkillProfile === skill.profile ? 'active' : ''} onClick={() => selectSkill(skill.profile)}><b>{skill.label}</b><small>{skill.customized ? 'Personalizada' : 'Padrão do sistema'}</small></button>)}
              </nav>
              <div className="skill-editor">
                <div className="skill-editor-heading"><b>Roteiro selecionado</b><span>Até 8.000 caracteres</span></div>
                <label className="sr-only" htmlFor="skill-content">Texto da skill</label>
                <textarea id="skill-content" maxLength={8000} value={skillDraft} onChange={(event) => setSkillDraft(event.target.value)} placeholder="Carregando skill..." />
                <p className="field-help">Inclua objetivo, forma de qualificar o cliente, tom e exemplos. Não inclua preços, credenciais ou dados sensíveis.</p>
                <div className="skill-actions"><button className="ai-save" onClick={() => void saveSkill()} disabled={skillSaving || !skillDraft.trim()}>{skillSaving ? 'Salvando...' : 'Salvar roteiro'}</button><button className="secondary" onClick={() => void resetSkill()} disabled={skillSaving}>Restaurar padrão</button></div>
              </div>
            </div>
          </section>}
        </>}
      </section>}
    </main>
  </div>
}
