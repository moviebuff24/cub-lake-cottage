# Vision Boards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static Vision section with a multi-board system where each board holds photos, link previews with thumbnails, and notes — all persisted to Firebase.

**Architecture:** A new self-contained `VisionBoards` component owns its own Firebase subscription and photo upload logic. A Vercel API route handles server-side og: tag fetching for link previews. The old vision photo state and section JSX are removed from `page.tsx` and replaced with `<VisionBoards />`.

**Tech Stack:** Next.js 16 App Router, Firebase Realtime Database, Firebase Storage, TypeScript, Tailwind CSS v4, React 19

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `app/api/link-preview/route.ts` | POST endpoint — fetches og:title/og:description/og:image from a URL server-side |
| Create | `components/vision-boards.tsx` | `VisionBoards` (exported) + `BoardTile` (internal) — all board state, Firebase CRUD, photo upload, link preview rendering |
| Modify | `app/page.tsx` | Remove `visionPhotos` state/refs/JSX; import and render `<VisionBoards />` |

---

## Task 1: Link Preview API Route

**Files:**
- Create: `app/api/link-preview/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// app/api/link-preview/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { url } = body as { url: string }

  // Validate URL
  let parsed: URL
  try {
    parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkPreview/1.0; +https://cub-lake-cottage.vercel.app)',
      },
    })
    clearTimeout(timeout)

    const html = await response.text()

    // Try both attribute orderings for og: meta tags
    const getOg = (property: string): string => {
      const a = html.match(
        new RegExp(`<meta[^>]*property=["']og:${property}["'][^>]*content=["']([^"']+)["']`, 'i')
      )
      const b = html.match(
        new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:${property}["']`, 'i')
      )
      return (a?.[1] || b?.[1] || '').trim()
    }

    let thumbnail = getOg('image')
    // Resolve relative og:image paths
    if (thumbnail && !thumbnail.startsWith('http')) {
      try {
        thumbnail = new URL(thumbnail, parsed.origin).toString()
      } catch {
        thumbnail = ''
      }
    }

    return NextResponse.json({
      title: getOg('title') || parsed.hostname,
      description: getOg('description'),
      thumbnail,
    })
  } catch {
    // Timeout, network error, or unparseable response — return a safe fallback
    return NextResponse.json({
      title: parsed.hostname,
      description: '',
      thumbnail: '',
    })
  }
}
```

- [ ] **Step 2: Verify the route works**

Run: `cd cottage-website-design && npm run dev`

In a new terminal:
```bash
curl -X POST http://localhost:3000/api/link-preview \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.jacuzzi.com/en-us/hot-tubs/"}'
```

Expected: JSON with `title`, `description`, `thumbnail` fields. `title` should not be empty.

- [ ] **Step 3: Commit**

```bash
git add app/api/link-preview/route.ts
git commit -m "feat: add /api/link-preview route for og: tag fetching"
```

---

## Task 2: VisionBoards — Types and Firebase Subscription

**Files:**
- Create: `components/vision-boards.tsx` (initial skeleton)

- [ ] **Step 1: Create the component file with types and Firebase subscription**

```typescript
// components/vision-boards.tsx
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

// ─── BoardTile (placeholder — expanded in later tasks) ────────────────────────

function BoardTile({ board, onDelete }: { board: VisionBoard; onDelete: (id: string) => void }) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="font-semibold text-sm">{board.label}</span>
        <button
          onClick={() => onDelete(board.id)}
          className="text-xs text-muted-foreground hover:text-destructive transition-colors"
        >
          Delete
        </button>
      </div>
      <div className="p-4 text-sm text-muted-foreground">{board.photos.length} photos · {board.links.length} links</div>
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
    // Delete all photos from Storage
    await Promise.allSettled(
      board.photos.map(p => deleteObject(storageRef(storage, p.storagePath)))
    )
    // Remove board from RTDB
    await remove(dbRef(db, `visionBoards/${boardId}`))
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
```

- [ ] **Step 2: Verify it compiles**

```bash
npm run build 2>&1 | head -30
```

Expected: No TypeScript errors in `components/vision-boards.tsx`. (Other errors from page.tsx are OK at this stage — the component isn't wired in yet.)

- [ ] **Step 3: Commit**

```bash
git add components/vision-boards.tsx
git commit -m "feat: add VisionBoards skeleton with Firebase subscription and add-board modal"
```

---

## Task 3: BoardTile — Header, Label Editing, Delete Confirmation

**Files:**
- Modify: `components/vision-boards.tsx` — replace placeholder `BoardTile` with full implementation

- [ ] **Step 1: Replace the placeholder BoardTile with the full header implementation**

Replace the entire `BoardTile` function (the placeholder from Task 2) with:

```typescript
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
```

- [ ] **Step 2: Verify**

```bash
npm run build 2>&1 | grep "vision-boards"
```

Expected: No errors on `components/vision-boards.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/vision-boards.tsx
git commit -m "feat: BoardTile header with inline label editing and delete confirmation"
```

---

## Task 4: BoardTile — Photo Grid

**Files:**
- Modify: `components/vision-boards.tsx` — replace the placeholder body div with photo grid

- [ ] **Step 1: Add photo upload state and handlers to BoardTile**

Inside the `BoardTile` function, add after the existing state declarations:

```typescript
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
```

- [ ] **Step 2: Replace the placeholder body div with the photo grid**

Replace:
```typescript
      {/* Body — photo grid, links, notes added in later tasks */}
      <div className="p-4 text-sm text-muted-foreground flex-1">
        {board.photos.length} photos · {board.links.length} links
      </div>
```

With:
```typescript
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
```

- [ ] **Step 3: Verify in browser**

With `npm run dev` running and `<VisionBoards />` not yet wired in, temporarily import it at the bottom of `app/page.tsx` just to check for compile errors:

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: No errors on `vision-boards.tsx`.

- [ ] **Step 4: Commit**

```bash
git add components/vision-boards.tsx
git commit -m "feat: BoardTile photo grid with Firebase Storage upload and remove"
```

---

## Task 5: BoardTile — Links with Preview Cards

**Files:**
- Modify: `components/vision-boards.tsx` — add links section after photo grid

- [ ] **Step 1: Add link state and handlers to BoardTile**

Inside `BoardTile`, add after the photo upload state:

```typescript
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
```

- [ ] **Step 2: Add the links section JSX after the closing photo grid div**

```typescript
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
```

Note: The `new URL(link.url).hostname` call inside JSX assumes `link.url` is always a valid absolute URL (guaranteed by the add handler above). No try/catch needed inside render.

- [ ] **Step 3: Verify no compile errors**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

- [ ] **Step 4: Commit**

```bash
git add components/vision-boards.tsx
git commit -m "feat: BoardTile links with og:image thumbnail preview cards"
```

---

## Task 6: BoardTile — Notes with Debounced Write

**Files:**
- Modify: `components/vision-boards.tsx` — add notes section after links

- [ ] **Step 1: Add notes state and debounced write to BoardTile**

Inside `BoardTile`, add after the link state declarations:

```typescript
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
```

- [ ] **Step 2: Add the notes section JSX after the closing links div**

```typescript
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
```

- [ ] **Step 3: Verify**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

- [ ] **Step 4: Commit**

```bash
git add components/vision-boards.tsx
git commit -m "feat: BoardTile notes textarea with 800ms debounced Firebase write"
```

---

## Task 7: Migration — visionPhotos → Default Board

**Files:**
- Modify: `components/vision-boards.tsx` — add migration logic to `VisionBoards` useEffect

- [ ] **Step 1: Add migration logic inside the VisionBoards Firebase subscription useEffect**

Replace the existing `useEffect` in `VisionBoards`:

```typescript
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
```

- [ ] **Step 2: Verify**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add components/vision-boards.tsx
git commit -m "feat: migrate existing visionPhotos to default board on first VisionBoards load"
```

---

## Task 8: Wire VisionBoards into page.tsx

**Files:**
- Modify: `app/page.tsx`

This task has the most surgical edits. Do them in order.

- [ ] **Step 1: Add the VisionBoards import**

At line 37, after the existing `LakeReport` import, add:

```typescript
import { VisionBoards } from '@/components/vision-boards'
```

- [ ] **Step 2: Remove visionPhotos state and visionInputRef**

Remove line 99:
```typescript
  const [visionPhotos, setVisionPhotos] = useState<PhotoUpload[]>([])
```

Remove line 120:
```typescript
  const visionInputRef = useRef<HTMLInputElement>(null)
```

On line 121, narrow the type union — change:
```typescript
  const [activeUploadTarget, setActiveUploadTarget] = useState<{ type: 'property' | 'inspiration' | 'vision'; id?: string } | null>(null)
```
To:
```typescript
  const [activeUploadTarget, setActiveUploadTarget] = useState<{ type: 'property' | 'inspiration'; id?: string } | null>(null)
```

- [ ] **Step 3: Remove visionPhotos from the Firebase subscription**

In the `onValue` callback for `photos` (around line 276), remove:
```typescript
        setVisionPhotos(data.visionPhotos ? Object.values(data.visionPhotos) as PhotoUpload[] : [])
```

- [ ] **Step 4: Remove visionPhotos from the Firebase write effect**

Around line 303, change:
```typescript
    set(dbRef(db, 'photos'), { propertyPhotos, inspirationPhotos, visionPhotos, customPropertySlots, customInspirationSlots, propertyOrder, inspirationOrder })
```
To:
```typescript
    set(dbRef(db, 'photos'), { propertyPhotos, inspirationPhotos, customPropertySlots, customInspirationSlots, propertyOrder, inspirationOrder })
```

Also remove `visionPhotos` from the dependency array on that useEffect:
```typescript
  }, [propertyPhotos, inspirationPhotos, customPropertySlots, customInspirationSlots, propertyOrder, inspirationOrder, photosLoaded])
```

- [ ] **Step 5: Remove vision branches from handleFileUpload, triggerUpload, and removePhoto**

In `handleFileUpload` (around line 424), remove:
```typescript
      } else if (target.type === 'vision') {
        setVisionPhotos(prev => [...prev, upload])
      }
```

In `triggerUpload` (around line 441), remove:
```typescript
    else visionInputRef.current?.click()
```
And narrow the signature — change:
```typescript
  const triggerUpload = (type: 'property' | 'inspiration' | 'vision', id?: string) => {
```
To:
```typescript
  const triggerUpload = (type: 'property' | 'inspiration', id?: string) => {
```

In `removePhoto` (around line 445), change signature and remove vision branch:
```typescript
  const removePhoto = (type: 'property' | 'inspiration', id: string) => {
```
Remove:
```typescript
    } else {
      photo = visionPhotos.find(p => p.id === id)
      setVisionPhotos(prev => prev.filter(p => p.id !== id))
    }
```

- [ ] **Step 6: Remove the hidden vision file input**

Find and remove the line (around line 562):
```typescript
      <input type="file" ref={visionInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
```

- [ ] **Step 7: Replace the entire Vision section with VisionBoards**

Replace the block from `{/* Vision Section */}` (line 1113) through the closing `</section>` tag (line 1214) with:

```tsx
      {/* Vision Section */}
      <section id="vision" className="px-6 py-20 md:px-12 lg:px-20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-50 pointer-events-none">
          <div className="absolute top-20 right-20 w-64 h-64 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(70, 130, 180, 0.15)' }} />
          <div className="absolute bottom-40 right-40 w-48 h-48 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(212, 165, 116, 0.15)' }} />
        </div>
        <div className="max-w-6xl mx-auto relative">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" style={{ color: '#d4a574' }} />
            <span>The Vision</span>
          </div>
          <h2 className="font-serif text-4xl md:text-5xl font-medium mb-4 text-balance leading-tight">
            This is just the <span className="italic">beginning</span>
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed mb-10">
            Every great adventure starts with a single step. Our cottage on Cub Lake 
            represents more than just a property — it&apos;s where memories will be made, 
            where mornings start with lake views, and where life slows down just enough 
            to really be enjoyed.
          </p>
          <VisionBoards />
        </div>
      </section>
```

- [ ] **Step 8: Build and verify**

```bash
npm run build 2>&1
```

Expected: Clean build with zero TypeScript errors. If there are lingering references to `visionPhotos` or `visionInputRef`, the error messages will point to exact lines — fix them.

- [ ] **Step 9: Smoke test in the browser**

```bash
npm run dev
```

Open http://localhost:3000. Scroll to "The Vision" section. Verify:
- Grid renders with "Add board" tile
- Clicking "Add board" opens the modal, entering a name and clicking Add creates a board in Firebase and it appears in the grid
- Uploading a photo to a board saves it and displays it in the grid
- Pasting a URL into the link input shows the preview card with thumbnail
- Typing in the notes textarea saves after ~800ms (check Firebase console)
- Clicking ⋯ → Delete board → Delete removes it and its photos from Firebase

- [ ] **Step 10: Commit**

```bash
git add app/page.tsx
git commit -m "feat: wire VisionBoards into page, remove old visionPhotos state and section"
```

---

## Task 9: Deploy and Verify Live

- [ ] **Step 1: Push to main**

```bash
git push origin main
```

- [ ] **Step 2: Confirm Vercel deployment**

Watch the Vercel dashboard or run:
```bash
gh run list --limit 5
```

Wait for the deploy to complete (typically 1-2 minutes).

- [ ] **Step 3: Smoke test the live site**

Open the live Vercel URL. Repeat the same smoke test from Task 8 Step 9 on the production site. Pay special attention to:
- The `/api/link-preview` route works in production (og: fetching is server-side)
- Firebase Storage uploads succeed with the production Firebase credentials
- The migration runs correctly if there are existing `visionPhotos` in the database
