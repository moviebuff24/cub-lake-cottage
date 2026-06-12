'use client'

import { useEffect, useRef, useState } from 'react'
import { ref as dbRef, onValue, set, remove, get } from 'firebase/database'
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '@/lib/firebase'
import { Plus, X, Link as LinkIcon, Loader2 } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface VisionPhoto {
  id: string
  url: string
  name: string
  storagePath: string
}

interface VisionLink {
  id: string
  url: string
  title: string
  description: string
  thumbnail: string
}

interface VisionBoard {
  id: string
  label: string
  order: number
  notes: string
  photos: VisionPhoto[]
  links: VisionLink[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseBoards(data: Record<string, unknown>): VisionBoard[] {
  return Object.values(data)
    .map((b: unknown) => {
      const board = b as Record<string, unknown>
      return {
        id: board.id as string,
        label: board.label as string,
        order: (board.order as number) ?? 0,
        notes: (board.notes as string) ?? '',
        photos: board.photos
          ? (Object.values(board.photos as Record<string, unknown>) as VisionPhoto[])
          : [],
        links: board.links
          ? (Object.values(board.links as Record<string, unknown>) as VisionLink[])
          : [],
      }
    })
    .sort((a, b) => a.order - b.order)
}

// ─── BoardTile (header, label editing, delete confirmation) ──────────────────

function BoardTile({ board, onDelete }: { board: VisionBoard; onDelete: (id: string) => void }) {
  const [label, setLabel] = useState(board.label)
  const [editingLabel, setEditingLabel] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const labelInputRef = useRef<HTMLInputElement>(null)

  // Keep local label in sync if Firebase pushes an update
  useEffect(() => { setLabel(board.label) }, [board.label])

  const saveLabel = () => {
    setEditingLabel(false)
    const trimmed = label.trim()
    if (trimmed && trimmed !== board.label) {
      set(dbRef(db, `visionBoards/${board.id}/label`), trimmed)
    } else {
      setLabel(board.label) // revert if empty
    }
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        {editingLabel ? (
          <input
            ref={labelInputRef}
            value={label}
            onChange={e => setLabel(e.target.value)}
            onBlur={saveLabel}
            onKeyDown={e => { if (e.key === 'Enter') labelInputRef.current?.blur(); if (e.key === 'Escape') { setLabel(board.label); setEditingLabel(false) } }}
            className="font-semibold text-sm bg-transparent border-b border-primary outline-none flex-1 mr-2"
            autoFocus
          />
        ) : (
          <button
            onClick={() => { setEditingLabel(true); setTimeout(() => labelInputRef.current?.focus(), 20) }}
            className="font-semibold text-sm text-left hover:text-primary transition-colors flex-1 mr-2 truncate"
            title="Click to rename"
          >
            {label}
          </button>
        )}

        {/* ⋯ menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(v => !v)}
            className="text-muted-foreground hover:text-foreground transition-colors px-1 text-base leading-none"
          >
            ⋯
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-7 z-20 bg-card border border-border rounded-xl shadow-lg py-1 w-36 text-sm">
                <button
                  onClick={() => { setShowMenu(false); setShowDeleteConfirm(true) }}
                  className="w-full text-left px-3 py-2 text-destructive hover:bg-destructive/10 transition-colors"
                >
                  Delete board
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Body — photo grid, links, notes added in later tasks */}
      <div className="p-4 text-sm text-muted-foreground flex-1">
        {board.photos.length} photos · {board.links.length} links
      </div>

      {/* Delete confirmation overlay */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 z-30 bg-card/95 backdrop-blur-sm flex flex-col items-center justify-center gap-4 p-6 rounded-2xl">
          <p className="text-sm font-medium text-center">Delete &ldquo;{board.label}&rdquo;?<br /><span className="text-muted-foreground font-normal">Photos and links will be permanently removed.</span></p>
          <div className="flex gap-2">
            <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 rounded-lg text-sm hover:bg-secondary transition-colors">Cancel</button>
            <button onClick={() => { setShowDeleteConfirm(false); onDelete(board.id) }} className="px-4 py-2 rounded-lg text-sm font-semibold bg-destructive text-white hover:bg-destructive/90 transition-colors">Delete</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── VisionBoards ─────────────────────────────────────────────────────────────

export function VisionBoards() {
  const [boards, setBoards] = useState<VisionBoard[]>([])
  const [loaded, setLoaded] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newBoardLabel, setNewBoardLabel] = useState('')
  const newBoardInputRef = useRef<HTMLInputElement>(null)

  // Subscribe to visionBoards in Firebase
  useEffect(() => {
    const boardsRef = dbRef(db, 'visionBoards')
    const unsub = onValue(boardsRef, (snapshot) => {
      const data = snapshot.val()
      setBoards(data ? parseBoards(data) : [])
      setLoaded(true)
    })
    return unsub
  }, [])

  const handleDeleteBoard = async (boardId: string) => {
    const board = boards.find(b => b.id === boardId)
    if (!board) return
    try {
      // Delete all photos from Storage
      await Promise.allSettled(
        board.photos.map(p => deleteObject(storageRef(storage, p.storagePath)))
      )
      // Remove board from RTDB
      await remove(dbRef(db, `visionBoards/${boardId}`))
    } catch (err) {
      console.error('Failed to delete board:', err)
    }
  }

  if (!loaded) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {boards.map(board => (
        <BoardTile key={board.id} board={board} onDelete={handleDeleteBoard} />
      ))}
      {/* Add board tile */}
      <button
        onClick={() => { setShowAddModal(true); setTimeout(() => newBoardInputRef.current?.focus(), 50) }}
        className="group border-2 border-dashed border-border hover:border-primary/50 rounded-2xl flex flex-col items-center justify-center gap-3 min-h-[200px] transition-all hover:bg-secondary/30"
      >
        <div className="p-3 rounded-xl bg-secondary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          <Plus className="w-5 h-5" />
        </div>
        <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
          Add board
        </span>
      </button>

      {/* Add board modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowAddModal(false)}>
          <div className="bg-card rounded-2xl p-6 shadow-2xl w-full max-w-sm mx-4" onClick={e => e.stopPropagation()} onKeyDown={e => e.key === 'Escape' && setShowAddModal(false)}>
            <h3 className="font-semibold text-base mb-1">New board</h3>
            <p className="text-sm text-muted-foreground mb-4">Give it a name — you can rename it later</p>
            <input
              ref={newBoardInputRef}
              type="text"
              value={newBoardLabel}
              onChange={e => setNewBoardLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmAddBoard()}
              placeholder="e.g. Hot Tub Inspo, Decor…"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
              <button onClick={confirmAddBoard} disabled={!newBoardLabel.trim()} className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 transition-colors" style={{ backgroundColor: '#3d5a3c', color: 'white' }}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  function confirmAddBoard() {
    if (!newBoardLabel.trim()) return
    const id = `board_${Date.now()}`
    set(dbRef(db, `visionBoards/${id}`), {
      id,
      label: newBoardLabel.trim(),
      order: boards.length,
      notes: '',
      photos: {},
      links: {},
    })
    setNewBoardLabel('')
    setShowAddModal(false)
  }
}
