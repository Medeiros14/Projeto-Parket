'use client'

import { useEffect, useState } from 'react'
import { agentsApi, Agent } from '@/lib/api'
import { Zap, Plus, Calculator, Clock, Bell, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

const SKILL_CATEGORIES = [
  {
    category: 'Gerais',
    color: 'yellow',
    icon: Zap,
    skills: [
      { name: 'Resumir', description: 'Resume textos longos de forma clara e concisa', skill_type: 'summarize', config: {} },
      { name: 'Analisar Sentimento', description: 'Identifica o tom emocional de mensagens', skill_type: 'analyze', config: {} },
      { name: 'Traduzir', description: 'Traduz mensagens para outros idiomas', skill_type: 'translate', config: {} },
      { name: 'Gerar Relatório', description: 'Cria relatórios estruturados a partir de dados', skill_type: 'generate', config: {} },
      { name: 'Qualificar Lead', description: 'Avalia e qualifica potenciais clientes', skill_type: 'custom', config: {} },
      { name: 'Agendar Reunião', description: 'Ajuda a marcar reuniões e compromissos', skill_type: 'custom', config: {} },
      { name: 'Responder FAQ', description: 'Responde perguntas frequentes com base no conhecimento', skill_type: 'custom', config: {} },
      { name: 'Triagem de Suporte', description: 'Classifica e direciona solicitações de suporte', skill_type: 'custom', config: {} },
    ],
  },
  {
    category: 'PMO — Cálculo de Prazo',
    color: 'green',
    icon: Calculator,
    description: 'Skills do Agente PMO — Calculador de Prazo (Squad Obras). Ativado automaticamente quando projeto entra em "Entrada" do setor Produtividade.',
    skills: [
      {
        name: 'Calcular Prazo em Dias Úteis',
        description: 'Calcula o prazo total de execução de uma obra em dias úteis usando a Tabela de Rendimento Padrão da Parket (m²/dia por serviço). Fórmula: ceil(quantidade ÷ rendimento).',
        skill_type: 'calcular_prazo_dias_uteis',
        config: {
          tabela_rendimento: true,
          unidades: ['M²', 'ML', 'UNIDADE'],
          formula: 'ceil(quantidade / rendimento_por_dia)',
          endpoint: '/api/pmo/calcular-prazo',
        },
      },
      {
        name: 'Consultar Tabela de Rendimento',
        description: 'Acessa a tabela de rendimento padrão da Parket com 37 tipos de serviço (Piso, Forro, Deck, Escada, Portas etc.) e seus rendimentos por dia de equipe.',
        skill_type: 'consultar_tabela_rendimento',
        config: {
          endpoint: '/api/pmo/tabela-rendimento',
          servicos: 37,
          fonte: 'Tempo Padrão de obra — Planilha Parket',
        },
      },
      {
        name: 'Atualizar Card Kanban',
        description: 'Atualiza o card do projeto no Kanban com prazo_dias_uteis, previsão de início e cronograma detalhado por serviço (details.cronograma_pmo).',
        skill_type: 'atualizar_card_kanban',
        config: {
          campo: 'details.prazo_dias_uteis',
          campos_extras: ['details.cronograma_pmo', 'details.area_m2'],
          whatsapp_notify: true,
          endpoint: '/api/pmo/auto-calcular',
        },
      },
      {
        name: 'Notificar WhatsApp PMO',
        description: 'Envia o cronograma calculado para o grupo WhatsApp PMO/Produtividade com breakdown completo por serviço, total de dias úteis e alertas de área não confirmada.',
        skill_type: 'notificar_whatsapp',
        config: {
          grupo: 'PMO/Produtividade',
          grupo_id: '120363405460675664@g.us',
          formato: 'cronograma_completo',
        },
      },
    ],
  },
]

const CATEGORY_COLORS: Record<string, { bg: string; text: string; badge: string }> = {
  yellow: { bg: 'bg-yellow-900/30', text: 'text-yellow-400', badge: 'badge-yellow' },
  green:  { bg: 'bg-green-900/30',  text: 'text-green-400',  badge: 'badge-green'  },
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  'Gerais': Zap,
  'PMO — Cálculo de Prazo': Calculator,
}

export default function SkillsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<string>('')

  useEffect(() => { agentsApi.list().then(setAgents) }, [])

  const addSkill = async (skill: Record<string, unknown>) => {
    if (!selectedAgent) { toast.error('Selecione um agente'); return }
    try {
      await agentsApi.addSkill(selectedAgent, skill)
      toast.success(`Skill "${skill.name}" adicionada!`)
    } catch { toast.error('Erro ao adicionar skill') }
  }

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Zap size={22} className="text-yellow-400" /> Skills
        </h1>
        <p className="text-gray-400 text-sm mt-1">Habilidades especiais para os agentes do IA Squad</p>
      </div>

      {/* Seletor de agente */}
      <div className="card p-4 max-w-sm">
        <label className="label">Agente destino</label>
        <select className="input" value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)}>
          <option value="">Selecionar agente...</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {/* Categorias */}
      {SKILL_CATEGORIES.map(cat => {
        const colors = CATEGORY_COLORS[cat.color] ?? CATEGORY_COLORS.yellow
        const Icon = CATEGORY_ICONS[cat.category] ?? Zap
        return (
          <div key={cat.category} className="space-y-3">
            <div className="flex items-center gap-3">
              <div className={`w-7 h-7 ${colors.bg} rounded-lg flex items-center justify-center`}>
                <Icon size={14} className={colors.text} />
              </div>
              <div>
                <h2 className="text-white font-semibold text-sm">{cat.category}</h2>
                {cat.description && <p className="text-gray-500 text-xs">{cat.description}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {cat.skills.map(skill => (
                <div key={skill.name} className="card p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 ${colors.bg} rounded-lg flex items-center justify-center`}>
                      <Icon size={14} className={colors.text} />
                    </div>
                    <div>
                      <div className="font-medium text-white text-sm">{skill.name}</div>
                      <span className={`badge ${colors.badge} text-xs`}>{skill.skill_type}</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 flex-1">{skill.description}</p>
                  {Object.keys(skill.config).length > 0 && (
                    <div className="rounded-md p-2 space-y-0.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      {Object.entries(skill.config).slice(0, 3).map(([k, v]) => (
                        <p key={k} className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          <span style={{ color: 'rgba(255,255,255,0.5)' }}>{k}:</span>{' '}
                          {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                        </p>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => addSkill(skill)}
                    className="btn-secondary text-xs py-1.5 flex items-center justify-center gap-1 mt-1"
                  >
                    <Plus size={12} /> Adicionar ao Agente
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
