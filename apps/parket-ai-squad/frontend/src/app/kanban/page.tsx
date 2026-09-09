'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  DndContext, DragEndEvent, DragOverEvent, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCorners,
  DragOverlay
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { kanbanApi, lembretesApi, KanbanBoard, KanbanColumn, KanbanCard } from '@/lib/api'
import { Plus, Trello, GripVertical, Trash2, Calendar, Tag, Bell, Clock, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'

const PRIORITY_COLORS: Record<string, string> = {
  low: 'badge-gray',
  medium: 'badge-blue',
  high: 'badge-yellow',
  critical: 'badge-red',
}

export default function KanbanPage() {
  const [board, setBoard] = useState<KanbanBoard | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeCard, setActiveCard] = useState<KanbanCard | null>(null)
  const [showNewCard, setShowNewCard] = useState<string | null>(null)
  const [newCardTitle, setNewCardTitle] = useState('')
  const [lembreteModal, setLembreteModal] = useState<{ cardId: string; cardTitle: string } | null>(null)
  const [lembreteData, setLembreteData] = useState('')
  const [lembreteHora, setLembreteHora] = useState('')
  const [lembreteObs, setLembreteObs] = useState('')
  const [lembreteSaving, setLembreteSaving] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const load = async () => {
    setLoading(true)
    try {
      const boards = await kanbanApi.listBoards()
      setBoard(boards[0] || null)
    } catch { toast.error('Erro ao carregar kanban') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleDragStart = (e: DragStartEvent) => {
    const card = findCard(e.active.id as string)
    setActiveCard(card || null)
  }

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveCard(null)
    const { active, over } = e
    if (!over || !board) return

    const cardId = active.id as string
    const overId = over.id as string

    // Find which column the card is being dropped into
    const targetColumn = board.columns.find(c =>
      c.id === overId || c.cards.some(card => card.id === overId)
    )

    if (!targetColumn) return

    const sourceColumn = board.columns.find(c => c.cards.some(card => card.id === cardId))
    if (!sourceColumn) return

    const targetPosition = targetColumn.cards.findIndex(c => c.id === overId)
    const newPosition = targetPosition >= 0 ? targetPosition : targetColumn.cards.length

    // Optimistic update
    setBoard(prev => {
      if (!prev) return prev
      const newBoard = { ...prev, columns: prev.columns.map(col => ({
        ...col,
        cards: col.cards.filter(c => c.id !== cardId)
      }))}
      const card = { ...sourceColumn.cards.find(c => c.id === cardId)!, column_id: targetColumn.id }
      newBoard.columns = newBoard.columns.map(col =>
        col.id === targetColumn.id
          ? { ...col, cards: [...col.cards.slice(0, newPosition), card, ...col.cards.slice(newPosition)] }
          : col
      )
      return newBoard
    })

    try {
      await kanbanApi.moveCard(cardId, targetColumn.id, newPosition)
    } catch {
      toast.error('Erro ao mover card')
      load()
    }
  }

  const findCard = (id: string): KanbanCard | undefined => {
    if (!board) return undefined
    for (const col of board.columns) {
      const card = col.cards.find(c => c.id === id)
      if (card) return card
    }
    return undefined
  }

  const addCard = async (columnId: string) => {
    if (!newCardTitle.trim()) return
    try {
      await kanbanApi.createCard(columnId, { title: newCardTitle, priority: 'medium' })
      setNewCardTitle('')
      setShowNewCard(null)
      load()
    } catch { toast.error('Erro ao criar card') }
  }

  const deleteCard = async (cardId: string) => {
    try {
      await kanbanApi.deleteCard(cardId)
      load()
    } catch { toast.error('Erro ao excluir card') }
  }

  const openLembreteModal = (cardId: string, cardTitle: string) => {
    setLembreteModal({ cardId, cardTitle })
    setLembreteData('')
    setLembreteHora('')
    setLembreteObs('')
  }

  const criarLembrete = async () => {
    if (!lembreteModal || !lembreteData || !lembreteHora) return
    setLembreteSaving(true)
    try {
      // Converte YYYY-MM-DD para DD/MM/YYYY
      const [y, m, d] = lembreteData.split('-')
      const dataFormatada = `${d}/${m}/${y}`
      await lembretesApi.create({
        card_id: lembreteModal.cardId,
        data: dataFormatada,
        hora: lembreteHora,
        observacao: lembreteObs,
      })
      toast.success('Lembrete agendado!')
      setLembreteModal(null)
      load()
    } catch { toast.error('Erro ao criar lembrete') }
    finally { setLembreteSaving(false) }
  }

  if (loading) return <div className="p-6 text-gray-500">Carregando...</div>

  if (!board) return (
    <div className="p-6 text-center">
      <Trello size={48} className="mx-auto mb-4 text-gray-700" />
      <p className="text-gray-500 mb-4">Nenhum quadro criado</p>
      <button onClick={async () => { await kanbanApi.createBoard({ name: 'Workflows dos Agentes' }); load() }} className="btn-primary">
        Criar Quadro
      </button>
    </div>
  )

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Trello size={22} className="text-indigo-400" /> {board.name}
          </h1>
          <p className="text-gray-400 text-sm">Fluxo de trabalho dos agentes</p>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
          {board.columns.map(column => (
            <KanbanColumnComponent
              key={column.id}
              column={column}
              showNewCard={showNewCard}
              newCardTitle={newCardTitle}
              onNewCardTitle={setNewCardTitle}
              onShowNewCard={setShowNewCard}
              onAddCard={addCard}
              onDeleteCard={deleteCard}
              onLembrete={openLembreteModal}
            />
          ))}
        </div>

        <DragOverlay>
          {activeCard && <CardComponent card={activeCard} isDragging onDelete={() => {}} onLembrete={() => {}} />}
        </DragOverlay>
      </DndContext>

      {/* Modal de Lembrete */}
      {lembreteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Bell size={18} className="text-yellow-400" />
                Agendar Lembrete
              </h3>
              <button onClick={() => setLembreteModal(null)} className="text-gray-500 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Card: <span className="text-white font-medium">{lembreteModal.cardTitle}</span>
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Data do contato</label>
                <input
                  type="date"
                  className="input w-full text-sm"
                  value={lembreteData}
                  onChange={e => setLembreteData(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Hora do contato</label>
                <input
                  type="time"
                  className="input w-full text-sm"
                  value={lembreteHora}
                  onChange={e => setLembreteHora(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Observacao (opcional)</label>
                <textarea
                  className="input w-full text-sm resize-none"
                  rows={2}
                  placeholder="Ex: Retornar sobre orcamento de piso carvalho..."
                  value={lembreteObs}
                  onChange={e => setLembreteObs(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={criarLembrete}
                disabled={!lembreteData || !lembreteHora || lembreteSaving}
                className="btn-primary flex-1 text-sm py-2 disabled:opacity-50"
              >
                {lembreteSaving ? 'Agendando...' : 'Agendar Lembrete'}
              </button>
              <button onClick={() => setLembreteModal(null)} className="btn-secondary text-sm py-2 px-4">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function KanbanColumnComponent({
  column, showNewCard, newCardTitle, onNewCardTitle, onShowNewCard, onAddCard, onDeleteCard, onLembrete
}: {
  column: KanbanColumn
  showNewCard: string | null
  newCardTitle: string
  onNewCardTitle: (v: string) => void
  onShowNewCard: (v: string | null) => void
  onAddCard: (colId: string) => void
  onDeleteCard: (cardId: string) => void
  onLembrete: (cardId: string, cardTitle: string) => void
}) {
  return (
    <div className="flex-none w-72 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: column.color }} />
          <span className="text-sm font-semibold text-white">{column.name}</span>
          <span className="badge badge-gray">{column.cards.length}</span>
        </div>
        <button
          onClick={() => onShowNewCard(column.id)}
          className="text-gray-600 hover:text-indigo-400 transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>

      <SortableContext items={column.cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
        <div
          id={column.id}
          className="flex-1 space-y-2 min-h-[100px] p-2 rounded-xl bg-gray-900/50 border border-gray-800"
        >
          {column.cards.map(card => (
            <CardComponent key={card.id} card={card} onDelete={onDeleteCard} onLembrete={onLembrete} />
          ))}

          {showNewCard === column.id && (
            <div className="p-2 bg-gray-800 rounded-lg space-y-2">
              <input
                autoFocus
                className="input text-sm py-1"
                placeholder="Título do card..."
                value={newCardTitle}
                onChange={e => onNewCardTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') onAddCard(column.id) }}
              />
              <div className="flex gap-2">
                <button onClick={() => onAddCard(column.id)} className="btn-primary text-xs py-1 px-2">Adicionar</button>
                <button onClick={() => onShowNewCard(null)} className="btn-secondary text-xs py-1 px-2">Cancelar</button>
              </div>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

function CardComponent({ card, isDragging, onDelete, onLembrete }: {
  card: KanbanCard
  isDragging?: boolean
  onDelete: (id: string) => void
  onLembrete: (cardId: string, cardTitle: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({ id: card.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        'bg-gray-800 border border-gray-700 rounded-lg p-3 group cursor-grab',
        isDragging && 'shadow-2xl rotate-2 cursor-grabbing'
      )}
    >
      <div className="flex items-start gap-2">
        <div {...attributes} {...listeners} className="mt-0.5 text-gray-600 hover:text-gray-400 shrink-0">
          <GripVertical size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-white font-medium line-clamp-2">{card.title}</div>
          {card.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{card.description}</p>
          )}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className={`badge text-xs ${PRIORITY_COLORS[card.priority] || 'badge-gray'}`}>
              {card.priority}
            </span>
            {card.tags?.map(tag => (
              <span key={tag} className="badge badge-purple text-xs">
                <Tag size={8} className="mr-1" />{tag}
              </span>
            ))}
            {card.due_date && (
              <span className="badge badge-gray text-xs">
                <Calendar size={8} className="mr-1" />
                {new Date(card.due_date).toLocaleDateString('pt-BR')}
              </span>
            )}
          </div>
          {/* Lembrete info */}
          {(card.extra as any)?.lembrete_data && (
            <div className="flex items-center gap-1.5 mt-2 px-2 py-1 bg-yellow-900/30 border border-yellow-700/40 rounded text-xs text-yellow-300">
              <Bell size={10} />
              <span>{(card.extra as any).lembrete_data} {(card.extra as any).lembrete_hora}</span>
              {(card.extra as any).lembrete_status === 'notificado' && (
                <span className="badge badge-red text-[10px] ml-1">Vencido</span>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <button
            onClick={() => onLembrete(card.id, card.title)}
            className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-yellow-400 transition-all"
            title="Agendar lembrete"
          >
            <Bell size={12} />
          </button>
          <button
            onClick={() => onDelete(card.id)}
            className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}
