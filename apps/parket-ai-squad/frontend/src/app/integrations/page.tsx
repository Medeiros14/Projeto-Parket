'use client'

import { useEffect, useState } from 'react'
import { agentsApi, Agent } from '@/lib/api'
import { Webhook, Plus, Cpu, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

const MCP_TEMPLATES = [
  { name: 'Busca Web (Brave)', description: 'Pesquisa na internet usando Brave Search', url: 'https://mcp.brave.com', type: 'http' },
  { name: 'GitHub', description: 'Acesso a repositórios, issues e PRs', url: 'https://api.githubcopilot.com/mcp/', type: 'http' },
  { name: 'Notion', description: 'Leitura e escrita no Notion', url: 'https://mcp.notion.com', type: 'http' },
  { name: 'Google Calendar', description: 'Gerenciamento de agenda', url: '', command: 'npx @google/mcp-calendar', type: 'stdio' },
  { name: 'Slack', description: 'Envio de mensagens no Slack', url: 'https://mcp.slack.com', type: 'http' },
  { name: 'PostgreSQL', description: 'Consultas ao banco de dados', url: '', command: 'npx @modelcontextprotocol/server-postgres', type: 'stdio' },
  { name: 'Filesystem', description: 'Leitura de arquivos locais', url: '', command: 'npx @modelcontextprotocol/server-filesystem', type: 'stdio' },
  { name: 'Fetch (HTTP)', description: 'Chamadas HTTP genéricas', url: '', command: 'npx @modelcontextprotocol/server-fetch', type: 'stdio' },
]

export default function IntegrationsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<string>('')

  useEffect(() => {
    agentsApi.list().then(setAgents)
  }, [])

  const addTemplate = async (template: typeof MCP_TEMPLATES[0]) => {
    if (!selectedAgent) {
      toast.error('Selecione um agente primeiro')
      return
    }
    try {
      await agentsApi.addMCP(selectedAgent, {
        name: template.name,
        description: template.description,
        server_url: template.url || undefined,
        command: template.command || undefined,
        mcp_type: template.type as 'http' | 'stdio',
      })
      toast.success(`${template.name} adicionado ao agente!`)
    } catch { toast.error('Erro ao adicionar MCP') }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Webhook size={22} className="text-indigo-400" /> Integrações MCP
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Conecte ferramentas externas aos seus agentes via Model Context Protocol
        </p>
      </div>

      {/* Agent selector */}
      <div className="card p-4 max-w-sm">
        <label className="label">Agente destino</label>
        <select className="input" value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)}>
          <option value="">Selecionar agente...</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {/* MCP Templates */}
      <div>
        <h2 className="font-semibold text-white mb-3 text-sm">Templates de MCP</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {MCP_TEMPLATES.map(template => (
            <div key={template.name} className="card p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-indigo-900/50 rounded-lg flex items-center justify-center">
                    <Cpu size={14} className="text-indigo-400" />
                  </div>
                  <div>
                    <div className="font-medium text-white text-sm">{template.name}</div>
                    <span className={`badge text-xs ${template.type === 'http' ? 'badge-blue' : 'badge-purple'}`}>
                      {template.type}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400">{template.description}</p>
              {template.url && (
                <p className="text-xs text-gray-600 font-mono truncate">{template.url}</p>
              )}
              {template.command && (
                <p className="text-xs text-gray-600 font-mono truncate">{template.command}</p>
              )}
              <button
                onClick={() => addTemplate(template)}
                className="btn-primary text-xs py-1.5 flex items-center justify-center gap-1 mt-1"
              >
                <Plus size={12} /> Adicionar ao Agente
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Custom MCP info */}
      <div className="card p-4 bg-indigo-950/30 border-indigo-800/50">
        <h3 className="font-medium text-indigo-300 mb-2 text-sm">MCP Personalizado</h3>
        <p className="text-xs text-gray-400">
          Para adicionar um MCP personalizado, acesse a página do agente e use a aba MCPs.
          Você pode configurar servidores HTTP remotos ou comandos stdio locais.
        </p>
        <Link href="/agents" className="text-indigo-400 text-xs mt-2 inline-flex items-center gap-1 hover:underline">
          Ir para Agentes <ExternalLink size={10} />
        </Link>
      </div>
    </div>
  )
}
