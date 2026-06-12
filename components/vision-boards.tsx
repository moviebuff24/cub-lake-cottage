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
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const photoId = `photo_${Date.now()}`
    const path = `visionBoards/${board.id}/photos/${photoId}_${file.name}`
    try {
      const snapshot = await uploadBytes(storageRef(storage, path), file)
      const url = await getDownloadURL(snapshot.ref)
      await set(dbRef(db, `visionBoards/${board.id}/photos/${photoId}`), {
        id: photoId, url, name: file.name, storagePath: path,
      })
    } catch (err) {
      console.error('Photo upload failed:', err)
    }
    setUploading(false)
    e.target.value = ''
  }

  const handleRemovePhoto = async (photo: VisionPhoto) => {
    await remove(dbRef(db, `visionBoards/${board.id}/photos/${photo.id}`))
    if (photo.storagePath) {
      deleteObject(storageRef(storage, photo.storagePath)).catch(() => {})
    }
  }

  const [linkInput, setLinkInput] = useState('')
  const [linkLoading, setLinkLoading] = useState(false)

  // Takes url directly so both the button click and onPaste can call it
  // without depending on linkInput state (which lags one render on paste)
  const doAddLink = async (url: string) => {
    const trimmed = url.trim()
    if (!trimmed) return
    setLinkInput('')
    setLinkLoading(true)
    try {
      const res = await fetch('/api/link-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })
      const preview = await res.json()
      const linkId = `link_${Date.now()}`
      let hostname = trimmed
      try { hostname = new URL(trimmed).hostname } catch {}
      await set(dbRef(db, `visionBoards/${board.id}/links/${linkId}`), {
        id: linkId,
        url: trimmed,
        title: preview.title || hostname,
        description: preview.description || '',
        thumbnail: preview.thumbnail || '',
      })
    } catch {
      const linkId = `link_${Date.now()}`
      let hostname = trimmed
      try { hostname = new URL(trimmed).hostname } catch {}
      await set(dbRef(db, `visionBoards/${board.id}/links/${linkId}`), {
        id: linkId, url: trimmed, title: hostname, description: '', thumbnail: '',
      })
    }
    setLinkLoading(false)
  }

  const handleRemoveLink = async (linkId: string) => {
    await remove(dbRef(db, `visionBoards/${board.id}/links/${linkId}`))
  }

  const [notes, setNotes] = useState(board.notes || '')
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep notes in sync if Firebase pushes an update while not editing
  useEffect(() => { setNotes(board.notes || '') }, [board.notes])

  const handleNotesChange = (value: string) => {
    setNotes(value)
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current)
    notesTimerRef.current = setTimeout(() => {
      set(dbRef(db, `visionBoards/${board.id}/notes`), value)
    }, 800)
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

      {/* Photo grid */}
      <div className="p-3 grid grid-cols-3 gap-1.5">
        {board.photos.map(photo => (
          <div key={photo.id} className="relative group aspect-[4/3] rounded-lg overflow-hidden bg-secondary">
            <img src={photo.url} alt={photo.name} className="w-full h-full object-cover" />
            <button
              onClick={() => handleRemovePhoto(photo)}
              className="absolute top-1 right-1 p-0.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {/* Upload tile */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="aspect-[4/3] rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 transition-all hover:bg-secondary/50 group"
        >
          {uploading
            ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            : <Plus className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          }
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
      </div>

      {/* Links */}
      <div className="px-3 pb-2 flex flex-col gap-1.5">
        <p className="text-[0.63rem] font-bold tracking-widest uppercase text-muted-foreground pt-1">Links</p>

        {board.links.map(link => (
          <div key={link.id} className="flex items-stretch bg-secondary/50 border border-border rounded-xl overflow-hidden group">
            {/* Thumbnail */}
            {link.thumbnail ? (
              <img src={link.thumbnail} alt="" className="w-[72px] flex-shrink-0 object-cover" />
            ) : (
              <div className="w-[72px] flex-shrink-0 bg-secondary flex items-center justify-center text-muted-foreground">
                <LinkIcon className="w-4 h-4" />
              </div>
            )}
            {/* Text */}
            <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 px-3 py-2 hover:bg-secondary/80 transition-colors">
              <p className="text-[0.62rem] text-muted-foreground flex items-center gap-1 mb-0.5">
                {/* Google favicon service */}
                <img src={`https://www.google.com/s2/favicons?domain=${new URL(link.url).hostname}&sz=16`} alt="" className="w-3.5 h-3.5 rounded-sm" />
                {new URL(link.url).hostname}
              </p>
              <p className="text-[0.78rem] font-semibold text-foreground leading-tight line-clamp-1">{link.title}</p>
              {link.description && (
                <p className="text-[0.67rem] text-muted-foreground leading-snug line-clamp-2 mt-0.5">{link.description}</p>
              )}
            </a>
            {/* Remove */}
            <button
              onClick={() => handleRemoveLink(link.id)}
              className="self-start mt-2 mr-2 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {/* Add link input */}
        <div className="flex items-center gap-2">
          <input
            type="url"
            value={linkInput}
            onChange={e => setLinkInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doAddLink(linkInput)}
            onPaste={e => {
              const pasted = e.clipboardData.getData('text')
              if (pasted.startsWith('http')) {
                e.preventDefault()
                doAddLink(pasted)
              }
            }}
            placeholder="Paste a URL…"
            className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/60"
          />
          {linkLoading
            ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground flex-shrink-0" />
            : <button onClick={() => doAddLink(linkInput)} disabled={!linkInput.trim()} className="text-xs font-medium text-primary disabled:opacity-30 hover:underline flex-shrink-0">Add</button>
          }
        </div>
      </div>

      {/* Notes */}
      <div className="px-3 pb-4 border-t border-border mt-1 pt-2">
        <p className="text-[0.63rem] font-bold tracking-widest uppercase text-muted-foreground mb-1">Notes</p>
        <textarea
          value={notes}
          onChange={e => handleNotesChange(e.target.value)}
          placeholder="Add notes…"
          rows={2}
          className="w-full bg-transparent border-none outline-none text-sm text-muted-foreground italic resize-none placeholder:text-muted-foreground/50 leading-relaxed"
        />
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
    const unsub = onValue(boardsRef, async (snapshot) => {
      const data = snapshot.val()

      // Migration: if no boards exist yet but old visionPhotos data does, move it to a default board
      if (!data) {
        const oldPhotosSnap = await get(dbRef(db, 'photos/visionPhotos'))
        const oldPhotos = oldPhotosSnap.val()
        if (oldPhotos && Object.keys(oldPhotos).length > 0) {
          const boardId = `board_${Date.now()}`
          await set(dbRef(db, `visionBoards/${boardId}`), {
            id: boardId,
            label: 'Vision Board',
            order: 0,
            notes: '',
            photos: oldPhotos, // already keyed by id, same shape
            links: {},
          })
          // Don't touch photos/visionPhotos — non-destructive migration
        }
        setBoards([])
        setLoaded(true)
        return
      }

      setBoards(parseBoards(data))
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
