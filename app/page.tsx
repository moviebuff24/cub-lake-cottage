'use client'

import { useState, useEffect, useRef } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ref as dbRef, onValue, set } from 'firebase/database'
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '@/lib/firebase'
import {
  Home,
  Waves,
  TreePine,
  Flame,
  Sparkles,
  CheckCircle2,
  Circle,
  ChevronRight,
  ChevronDown,
  MapPin,
  Bed,
  Bath,
  Ruler,
  Ship,
  Plus,
  ImageIcon,
  Sofa,
  UtensilsCrossed,
  Star,
  X,
  Upload,
  MessageSquare,
  GripVertical,
  Menu,
} from 'lucide-react'
import { type Task, initialTasks, MONTHS_ORDER } from '@/lib/tasks'
import { LakeReport } from '@/components/lake-report'
import { VisionBoards } from '@/components/vision-boards'

// Data
const FIRST_STAY = new Date('2026-08-01')
const TODAY = new Date()
const DAYS_TO_GO = Math.ceil((FIRST_STAY.getTime() - TODAY.getTime()) / (1000 * 60 * 60 * 24))

const propertyFeatures = [
  { icon: Bed, label: '2 bed' },
  { icon: Bath, label: '1 bath' },
  { icon: Waves, label: '100 ft lakefront' },
  { icon: Ruler, label: '0.88 acres' },
  { icon: Ship, label: 'Dock + boat shed' },
  { icon: Home, label: 'Built 1978' },
]

const photoCategories = [
  { id: 'front', label: 'Front of House', icon: Home, hasImage: true },
  { id: 'lake', label: 'Lake View', icon: Waves, hasImage: true },
  { id: 'dock', label: 'The Dock', icon: Ship, hasImage: true },
  { id: 'living', label: 'Living Room', icon: Sofa, hasImage: false },
  { id: 'kitchen', label: 'Kitchen', icon: UtensilsCrossed, hasImage: false },
]

const inspirationBoard = [
  { id: 'hottub', label: 'Hot Tub Dreams', icon: Sparkles, color: 'sunset' },
  { id: 'decor', label: 'Cabin Decor', icon: Home, color: 'pine' },
  { id: 'firepit', label: 'Fire Pit', icon: Flame, color: 'sunset' },
  { id: 'dock', label: 'Dock Vibes', icon: Ship, color: 'lake' },
]

interface PhotoUpload {
  id: string
  url: string
  name: string
  storagePath?: string
}


export default function CubLakeCottage() {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const [tasksLoaded, setTasksLoaded] = useState(false)
  const isFirebaseUpdate = useRef(false)
  const [showAddTask, setShowAddTask] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', category: 'personal' as Task['category'], dueDate: '', month: 'June 2026', notes: '' })
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({})
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [accordionTransitionsReady, setAccordionTransitionsReady] = useState(false)
  const openMonthsInitialized = useRef(false)
  
  // Scratchpad state — shared notes, synced via Firebase RTDB
  const [scratchpad, setScratchpad] = useState('')
  const [scratchpadSaved, setScratchpadSaved] = useState(false)
  const scratchpadWriteRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scratchpadFocusedRef = useRef(false)
  const pendingScratchpadUpdate = useRef<string | null>(null)

  // Photo states — synced via Firebase RTDB (metadata) + Firebase Storage (files)
  const [propertyPhotos, setPropertyPhotos] = useState<Record<string, PhotoUpload | null>>({ front: null, lake: null, dock: null, living: null, kitchen: null })
  const [inspirationPhotos, setInspirationPhotos] = useState<Record<string, PhotoUpload | null>>({ hottub: null, decor: null, firepit: null, dock: null })
const [photosLoaded, setPhotosLoaded] = useState(false)
  const isFirebasePhotoUpdate = useRef(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [customPropertySlots, setCustomPropertySlots] = useState<Array<{ id: string; label: string }>>([])
  const [customInspirationSlots, setCustomInspirationSlots] = useState<Array<{ id: string; label: string }>>([])
  const [propertyOrder, setPropertyOrder] = useState<string[]>(['front', 'lake', 'dock', 'living', 'kitchen'])
  const [inspirationOrder, setInspirationOrder] = useState<string[]>(['hottub', 'decor', 'firepit', 'dock'])
  const [addSlotModal, setAddSlotModal] = useState<{ type: 'property' | 'inspiration' } | null>(null)
  const [newSlotLabel, setNewSlotLabel] = useState('')
  const [inspirationCaptions, setInspirationCaptions] = useState<Record<string, string>>({})
  const captionWriteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  // Debounce refs for drag-and-drop Firebase writes
  const propertyOrderWriteRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inspirationOrderWriteRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // File input refs
  const propertyInputRef = useRef<HTMLInputElement>(null)
  const inspirationInputRef = useRef<HTMLInputElement>(null)
  const [activeUploadTarget, setActiveUploadTarget] = useState<{ type: 'property' | 'inspiration'; id?: string } | null>(null)

  // Computed values
  const completedCount = tasks.filter(t => t.completed).length
  const totalCount = tasks.length
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  useEffect(() => {
    setMounted(true)
  }, [])

  // Wait for two animation frames before enabling accordion transitions so the
  // browser has committed the initial 0fr state — prevents the first-click snap.
  useEffect(() => {
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => setAccordionTransitionsReady(true))
      return () => cancelAnimationFrame(raf2)
    })
    return () => cancelAnimationFrame(raf1)
  }, [])

  // YouTube background video — loop :04 to :18, muted, no controls
  useEffect(() => {
    const START = 4
    const LOOP_AT = 17.5  // show mask and seek 0.5s before end to hide YouTube UI flash
    let player: any = null
    let intervalId: ReturnType<typeof setInterval> | null = null

    const showMask = () => {
      const m = document.getElementById('yt-loop-mask') as HTMLElement | null
      if (!m) return
      m.style.transition = 'none'
      m.style.opacity = '1'
    }
    const hideMask = () => {
      const m = document.getElementById('yt-loop-mask') as HTMLElement | null
      if (!m) return
      setTimeout(() => {
        m.style.transition = 'opacity 0.4s'
        m.style.opacity = '0'
      }, 150)
    }

    const initPlayer = () => {
      player = new (window as any).YT.Player('yt-hero-player', {
        videoId: 'cyi6R1x1pkk',
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 0,
          start: START,
          end: 18,
          playsinline: 1,
          rel: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          disablekb: 1,
        },
        events: {
          onReady: (e: any) => {
            e.target.playVideo()
            // Poll playback time — mask + seek before YouTube's ENDED fires
            intervalId = setInterval(() => {
              try {
                if (e.target.getCurrentTime() >= LOOP_AT) {
                  showMask()
                  e.target.seekTo(START)
                  e.target.playVideo()
                  hideMask()
                }
              } catch {}
            }, 500)
          },
          // Fallback: if ENDED fires anyway (e.g. tab backgrounded), restart cleanly
          onStateChange: (e: any) => {
            if (e.data === 0) {
              showMask()
              e.target.seekTo(START)
              e.target.playVideo()
              hideMask()
            }
          },
        },
      })
    }

    if ((window as any).YT?.Player) {
      initPlayer()
    } else {
      const prev = (window as any).onYouTubeIframeAPIReady
      ;(window as any).onYouTubeIframeAPIReady = () => {
        if (prev) prev()
        initPlayer()
      }
      if (!document.getElementById('yt-iframe-api')) {
        const tag = document.createElement('script')
        tag.id = 'yt-iframe-api'
        tag.src = 'https://www.youtube.com/iframe_api'
        document.head.appendChild(tag)
      }
    }

    return () => {
      try { player?.destroy() } catch {}
      if (intervalId) clearInterval(intervalId)
    }
  }, [])

  // Subscribe to Firebase tasks — syncs across all devices in real time
  useEffect(() => {
    const tasksRef = dbRef(db, 'tasks')
    const unsubscribe = onValue(tasksRef, (snapshot) => {
      const data = snapshot.val()
      isFirebaseUpdate.current = true
      setTasks(data ?? initialTasks)
      setTasksLoaded(true)
    })
    return () => unsubscribe()
  }, [])

  // Write tasks to Firebase only when changed locally (not from Firebase)
  useEffect(() => {
    if (!tasksLoaded) return
    if (isFirebaseUpdate.current) {
      isFirebaseUpdate.current = false
      return
    }
    set(dbRef(db, 'tasks'), tasks).catch(err => console.error('Failed to sync tasks:', err))
  }, [tasks, tasksLoaded])

  // Initialize open/closed state for month groups once tasks load
  useEffect(() => {
    if (!tasksLoaded || openMonthsInitialized.current) return
    const grouped = tasks.reduce((acc, task) => {
      if (!acc[task.month]) acc[task.month] = []
      acc[task.month].push(task)
      return acc
    }, {} as Record<string, Task[]>)
    const initial: Record<string, boolean> = {}
    Object.entries(grouped).forEach(([month, monthTasks]) => {
      initial[month] = getDefaultMonthOpen(month, monthTasks)
    })
    setOpenMonths(initial)
    openMonthsInitialized.current = true
  }, [tasks, tasksLoaded])

  // Subscribe to Firebase photos metadata
  useEffect(() => {
    const photosRef = dbRef(db, 'photos')
    const unsubscribe = onValue(photosRef, (snapshot) => {
      const data = snapshot.val()
      isFirebasePhotoUpdate.current = true
      if (data) {
        setPropertyPhotos(data.propertyPhotos || { front: null, lake: null, dock: null, living: null, kitchen: null })
        setInspirationPhotos(data.inspirationPhotos || { hottub: null, decor: null, firepit: null, dock: null })
setCustomPropertySlots(data.customPropertySlots ? Object.values(data.customPropertySlots) as Array<{ id: string; label: string }> : [])
        setCustomInspirationSlots(data.customInspirationSlots ? Object.values(data.customInspirationSlots) as Array<{ id: string; label: string }> : [])
        if (data.propertyOrder?.length) setPropertyOrder(data.propertyOrder)
        if (data.inspirationOrder?.length) setInspirationOrder(data.inspirationOrder)
      }
      setPhotosLoaded(true)
    })
    return () => unsubscribe()
  }, [])

  // Subscribe to inspiration tile captions — separate path so main photo writes don't clobber them
  useEffect(() => {
    const captionsRef = dbRef(db, 'inspirationCaptions')
    const unsubscribe = onValue(captionsRef, (snapshot) => {
      setInspirationCaptions(snapshot.val() || {})
    })
    return () => unsubscribe()
  }, [])

  // Write photo metadata to Firebase only when changed locally
  useEffect(() => {
    if (!photosLoaded) return
    if (isFirebasePhotoUpdate.current) {
      isFirebasePhotoUpdate.current = false
      return
    }
    set(dbRef(db, 'photos'), { propertyPhotos, inspirationPhotos, customPropertySlots, customInspirationSlots, propertyOrder, inspirationOrder }).catch(err => console.error('Failed to sync photos:', err))
  }, [propertyPhotos, inspirationPhotos, customPropertySlots, customInspirationSlots, propertyOrder, inspirationOrder, photosLoaded])

  // Subscribe to shared scratchpad
  useEffect(() => {
    const scratchRef = dbRef(db, 'scratchpad')
    const unsubscribe = onValue(scratchRef, (snapshot) => {
      const data = snapshot.val() ?? ''
      if (scratchpadFocusedRef.current) {
        pendingScratchpadUpdate.current = data
      } else {
        setScratchpad(data)
      }
    })
    return () => unsubscribe()
  }, [])

  const handleScratchpadChange = (value: string) => {
    setScratchpad(value)
    setScratchpadSaved(false)
    if (scratchpadWriteRef.current) clearTimeout(scratchpadWriteRef.current)
    scratchpadWriteRef.current = setTimeout(() => {
      set(dbRef(db, 'scratchpad'), value).then(() => {
        setScratchpadSaved(true)
        setTimeout(() => setScratchpadSaved(false), 2500)
      }).catch(err => console.error('Failed to sync scratchpad:', err))
    }, 800)
  }

  const handleScratchpadFocus = () => { scratchpadFocusedRef.current = true }

  const handleScratchpadBlur = () => {
    scratchpadFocusedRef.current = false
    if (pendingScratchpadUpdate.current !== null) {
      setScratchpad(pendingScratchpadUpdate.current)
      pendingScratchpadUpdate.current = null
    }
  }

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const toggleMonth = (month: string) => {
    setOpenMonths(prev => ({ ...prev, [month]: !prev[month] }))
  }

  const toggleTask = (taskId: string) => {
    setTasks(prev => prev.map(task =>
      task.id === taskId ? { ...task, completed: !task.completed } : task
    ))
  }

  const deleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }

  const updateTaskNotes = (taskId: string, notes: string) => {
    setTasks(prev => prev.map(task =>
      task.id === taskId ? { ...task, notes: notes || undefined } : task
    ))
  }

  const updateInspirationCaption = (id: string, caption: string) => {
    setInspirationCaptions(prev => {
      const next = { ...prev, [id]: caption }
      if (captionWriteTimerRef.current) clearTimeout(captionWriteTimerRef.current)
      captionWriteTimerRef.current = setTimeout(() => {
        set(dbRef(db, 'inspirationCaptions'), next).catch(err => console.error('Failed to sync captions:', err))
      }, 800)
      return next
    })
  }

  const addTask = () => {
    if (!newTask.title.trim()) return
    const task: Task = {
      id: Date.now().toString(),
      title: newTask.title,
      category: newTask.category,
      completed: false,
      dueDate: newTask.dueDate || 'TBD',
      month: newTask.month,
      notes: newTask.notes || undefined,
    }
    setTasks(prev => [...prev, task])
    setNewTask({ title: '', category: 'personal', dueDate: '', month: 'June 2026', notes: '' })
    setShowAddTask(false)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeUploadTarget) return

    const MAX_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      setUploadError(`File too large — max 10 MB (this file is ${Math.round(file.size / 1024 / 1024)} MB)`)
      setTimeout(() => setUploadError(null), 4000)
      e.target.value = ''
      setActiveUploadTarget(null)
      return
    }

    const target = activeUploadTarget
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `photos/${Date.now()}-${safeName}`
    const fileRef = storageRef(storage, storagePath)

    setUploading(true)
    try {
      const snapshot = await uploadBytes(fileRef, file)
      const url = await getDownloadURL(snapshot.ref)
      const upload: PhotoUpload = { id: Date.now().toString(), url, name: file.name, storagePath }

      if (target.type === 'property' && target.id) {
        setPropertyPhotos(prev => ({ ...prev, [target.id!]: upload }))
      } else if (target.type === 'inspiration' && target.id) {
        setInspirationPhotos(prev => ({ ...prev, [target.id!]: upload }))
      }
    } catch (err) {
      console.error('Photo upload failed:', err)
      setUploadError('Upload failed — please try again')
      setTimeout(() => setUploadError(null), 4000)
    }

    setUploading(false)
    setActiveUploadTarget(null)
    e.target.value = ''
  }

  const triggerUpload = (type: 'property' | 'inspiration', id?: string) => {
    setActiveUploadTarget({ type, id })
    if (type === 'property') propertyInputRef.current?.click()
    else if (type === 'inspiration') inspirationInputRef.current?.click()
  }

  const removePhoto = (type: 'property' | 'inspiration', id: string) => {
    let photo: PhotoUpload | null | undefined

    if (type === 'property') {
      photo = propertyPhotos[id]
      setPropertyPhotos(prev => ({ ...prev, [id]: null }))
    } else if (type === 'inspiration') {
      photo = inspirationPhotos[id]
      setInspirationPhotos(prev => ({ ...prev, [id]: null }))
    }

    if (photo?.storagePath) {
      deleteObject(storageRef(storage, photo.storagePath)).catch(err =>
        console.error('Failed to delete from storage:', err)
      )
    }
  }

  const removeCustomSlot = (type: 'property' | 'inspiration', id: string) => {
    removePhoto(type, id)
    if (type === 'property') {
      setCustomPropertySlots(prev => prev.filter(s => s.id !== id))
      setPropertyOrder(prev => prev.filter(oid => oid !== id))
    } else {
      setCustomInspirationSlots(prev => prev.filter(s => s.id !== id))
      setInspirationOrder(prev => prev.filter(oid => oid !== id))
    }
  }

  const confirmAddSlot = () => {
    if (!newSlotLabel.trim() || !addSlotModal) return
    const id = `custom-${Date.now()}`
    if (addSlotModal.type === 'property') {
      setCustomPropertySlots(prev => [...prev, { id, label: newSlotLabel.trim() }])
      setPropertyOrder(prev => [...prev, id])
    } else {
      setCustomInspirationSlots(prev => [...prev, { id, label: newSlotLabel.trim() }])
      setInspirationOrder(prev => [...prev, id])
    }
    setNewSlotLabel('')
    setAddSlotModal(null)
  }

  // Drag-and-drop sensors — require 8px movement before drag activates so clicks still work
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const handlePropertyDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const knownIds = new Set(propertyOrder)
    const allIds = [
      ...propertyOrder,
      ...photoCategories.map(c => c.id).filter(id => !knownIds.has(id)),
      ...customPropertySlots.map(s => s.id).filter(id => !knownIds.has(id)),
    ]
    const from = allIds.indexOf(String(active.id))
    const to = allIds.indexOf(String(over.id))
    if (from === -1 || to === -1) return
    const newOrder = arrayMove(allIds, from, to)
    setPropertyOrder(newOrder)
    if (propertyOrderWriteRef.current) clearTimeout(propertyOrderWriteRef.current)
    propertyOrderWriteRef.current = setTimeout(() => {
      set(dbRef(db, 'photos/propertyOrder'), newOrder)
    }, 400)
  }

  const handleInspirationDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const knownIds = new Set(inspirationOrder)
    const allIds = [
      ...inspirationOrder,
      ...inspirationBoard.map(c => c.id).filter(id => !knownIds.has(id)),
      ...customInspirationSlots.map(s => s.id).filter(id => !knownIds.has(id)),
    ]
    const from = allIds.indexOf(String(active.id))
    const to = allIds.indexOf(String(over.id))
    if (from === -1 || to === -1) return
    const newOrder = arrayMove(allIds, from, to)
    setInspirationOrder(newOrder)
    if (inspirationOrderWriteRef.current) clearTimeout(inspirationOrderWriteRef.current)
    inspirationOrderWriteRef.current = setTimeout(() => {
      set(dbRef(db, 'photos/inspirationOrder'), newOrder)
    }, 400)
  }

  // Ordered tile arrays for rendering
  const allPropertyTiles = [
    ...photoCategories.map(c => ({ ...c, isCustom: false as const })),
    ...customPropertySlots.map(s => ({ id: s.id, label: s.label, icon: ImageIcon, hasImage: false, isCustom: true as const })),
  ]
  const allInspirationTiles = [
    ...inspirationBoard.map(c => ({ ...c, isCustom: false as const })),
    ...customInspirationSlots.map(s => ({ id: s.id, label: s.label, icon: ImageIcon, color: 'lake', isCustom: true as const })),
  ]
  // Ensure any tile whose ID isn't in the saved order yet still shows up
  const knownPropertyIds = new Set(propertyOrder)
  const knownInspirationIds = new Set(inspirationOrder)
  const fullPropertyOrder = [...propertyOrder, ...allPropertyTiles.map(t => t.id).filter(id => !knownPropertyIds.has(id))]
  const fullInspirationOrder = [...inspirationOrder, ...allInspirationTiles.map(t => t.id).filter(id => !knownInspirationIds.has(id))]
  const orderedPropertyTiles = fullPropertyOrder.map(id => allPropertyTiles.find(t => t.id === id)).filter((t): t is NonNullable<typeof t> => t != null)
  const orderedInspirationTiles = fullInspirationOrder.map(id => allInspirationTiles.find(t => t.id === id)).filter((t): t is NonNullable<typeof t> => t != null)

  const groupedTasks = tasks.reduce((acc, task) => {
    if (!acc[task.month]) acc[task.month] = []
    acc[task.month].push(task)
    return acc
  }, {} as Record<string, Task[]>)

  return (
    <main className="min-h-screen">
      {/* Hidden file inputs */}
      <input type="file" ref={propertyInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
      <input type="file" ref={inspirationInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
      {/* Mobile navigation menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Panel slides in from top */}
          <div className="absolute top-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md shadow-2xl px-6 pt-6 pb-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-white/10">
                  <TreePine className="w-5 h-5 text-white" />
                </div>
                <span className="text-white text-sm font-medium tracking-widest uppercase opacity-80">Est. 2026</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2.5 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {[
                { label: 'The Property', id: 'property' },
                { label: 'Progress', id: 'progress' },
                { label: 'Lake Report', id: 'weather' },
                { label: 'Notes', id: 'notes' },
                { label: 'Vision', id: 'vision' },
              ].map(({ label, id }) => (
                <button
                  key={id}
                  onClick={() => { scrollToSection(id); setMobileMenuOpen(false) }}
                  className="text-left px-4 py-4 rounded-xl text-white text-lg font-medium hover:bg-white/10 transition-colors"
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Upload progress banner */}
      {uploading && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full bg-foreground text-background text-sm font-medium shadow-xl flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
          Uploading photo…
        </div>
      )}

      {/* Hero Section - Replace HERO_IMAGE_URL with your cottage photo */}
      <section className="relative overflow-hidden text-white min-h-[85vh] flex flex-col">
        {/* YouTube background video */}
        <style dangerouslySetInnerHTML={{ __html: `
          #yt-hero-wrapper iframe {
            position: absolute;
            top: 50%;
            left: 50%;
            width: max(100%, 177.78vh);
            height: max(56.25vw, 100%);
            transform: translate(-50%, -50%);
            pointer-events: none;
          }
          #yt-hero-wrapper, #yt-hero-wrapper * {
            pointer-events: none !important;
          }
        ` }} />

        {/* Layer 0 — video + gradients, fully passive */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none" style={{ backgroundColor: '#3d5a3c' }}>
          <div id="yt-hero-wrapper" className="absolute inset-0">
            <div id="yt-hero-player" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-black/20" />
        </div>

        {/* Layer 1 — loop mask, between video and content so it never covers the title */}
        <div id="yt-loop-mask" className="absolute inset-0 z-10 pointer-events-none" style={{ backgroundColor: '#111', opacity: 0 }} />

        {/* Layer 2 — all content, always on top and always interactive */}
        <div className="relative z-20 flex-1 flex flex-col px-6 pt-8 pb-16 md:px-12 lg:px-20">
          {/* Header */}
          <div className={`flex items-center justify-between mb-auto ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-sm">
                <TreePine className="w-6 h-6" />
              </div>
              <span className="text-sm font-medium tracking-widest uppercase opacity-80">Est. 2026</span>
            </div>
            {/* Hamburger — mobile only */}
            <button
              className="md:hidden p-2.5 rounded-xl bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-8 text-sm">
              <button onClick={() => scrollToSection('property')} className="opacity-70 hover:opacity-100 transition-all hover:tracking-wide">The Property</button>
              <button onClick={() => scrollToSection('progress')} className="opacity-70 hover:opacity-100 transition-all hover:tracking-wide">Progress</button>
              <button onClick={() => scrollToSection('weather')} className="opacity-70 hover:opacity-100 transition-all hover:tracking-wide">Lake Report</button>
              <button onClick={() => scrollToSection('notes')} className="opacity-70 hover:opacity-100 transition-all hover:tracking-wide">Notes</button>
              <button onClick={() => scrollToSection('vision')} className="opacity-70 hover:opacity-100 transition-all hover:tracking-wide">Vision</button>
            </nav>
          </div>

          {/* Hero content - centered */}
          <div className="max-w-4xl mx-auto text-center my-auto py-12">
            <div className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 backdrop-blur-sm text-sm mb-8 ${mounted ? 'animate-fade-in-up delay-100' : 'opacity-0'}`}>
              <MapPin className="w-4 h-4" />
              <span className="tracking-wide">Kalkaska, Michigan</span>
              <span className="mx-2 opacity-40">|</span>
              <span className="opacity-80">Cub Lake</span>
            </div>
            
            <h1 className={`font-serif text-5xl md:text-7xl lg:text-8xl font-medium tracking-tight mb-6 drop-shadow-lg ${mounted ? 'animate-fade-in-up delay-200' : 'opacity-0'}`}>
              Cub Lake Cottage
            </h1>
            
            <p className={`text-lg md:text-xl opacity-90 mb-12 max-w-xl mx-auto text-pretty leading-relaxed ${mounted ? 'animate-fade-in-up delay-300' : 'opacity-0'}`}>
              Our adventure begins
            </p>

            {/* Countdown stats - cleaner cards */}
            <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 max-w-2xl mx-auto ${mounted ? 'animate-fade-in-up delay-400' : 'opacity-0'}`}>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
                <div className="font-serif text-3xl md:text-4xl font-medium">{completedCount}</div>
                <div className="text-xs uppercase tracking-wider opacity-70 mt-1">Done</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
                <div className="font-serif text-3xl md:text-4xl font-medium">{totalCount - completedCount}</div>
                <div className="text-xs uppercase tracking-wider opacity-70 mt-1">To Do</div>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center border border-white/20">
                <div className="font-serif text-3xl md:text-4xl font-medium">{DAYS_TO_GO}</div>
                <div className="text-xs uppercase tracking-wider opacity-70 mt-1">Days to Go</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
                <div className="font-serif text-3xl md:text-4xl font-medium">Aug 1</div>
                <div className="text-xs uppercase tracking-wider opacity-70 mt-1">First Stay</div>
              </div>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className={`flex justify-center ${mounted ? 'animate-fade-in-up delay-500' : 'opacity-0'}`}>
            <button 
              onClick={() => scrollToSection('property')}
              className="flex flex-col items-center gap-2 opacity-60 hover:opacity-100 transition-opacity"
            >
              <span className="text-xs uppercase tracking-widest">Explore</span>
              <ChevronRight className="w-5 h-5 rotate-90 animate-bounce" />
            </button>
          </div>
        </div>
      </section>

      {/* Progress Bar */}
      <div className="bg-card border-b border-border px-6 py-5">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-1">
                {[...Array(5)].map((_, i) => (
                  <div 
                    key={i}
                    className={`w-2 h-2 rounded-full border-2 border-card ${i < Math.ceil(progressPercent / 20) ? 'bg-primary' : 'bg-muted'}`}
                  />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">Overall Progress</span>
            </div>
            <span className="text-sm font-semibold" style={{ color: '#3d5a3c' }}>{progressPercent}% complete</span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-1000 relative overflow-hidden ${mounted ? 'animate-progress-fill' : ''}`}
              style={{ width: `${progressPercent}%`, backgroundColor: '#3d5a3c' }}
            >
              <div className="absolute inset-0 animate-shimmer" />
            </div>
          </div>
        </div>
      </div>

      {/* Property Section */}
      <section id="property" className="px-6 py-20 md:px-12 lg:px-20">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-10">
            <div className="p-3 rounded-2xl" style={{ backgroundColor: 'rgba(61, 90, 60, 0.1)' }}>
              <Home className="w-6 h-6" style={{ color: '#3d5a3c' }} />
            </div>
            <div>
              <h2 className="font-serif text-3xl md:text-4xl font-medium">The Property</h2>
              <p className="text-muted-foreground mt-1">10723 Black Bear Rd NE · Cub Lake</p>
            </div>
          </div>

          {/* Property features */}
          <div className="flex flex-wrap gap-3 mb-14">
            {propertyFeatures.map((feature, i) => (
              <div 
                key={i}
                className="group inline-flex items-center gap-2.5 px-5 py-3 rounded-full bg-card border border-border text-sm hover:border-primary/40 hover:shadow-md transition-all cursor-default"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <feature.icon className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                <span className="font-medium">{feature.label}</span>
              </div>
            ))}
          </div>

          {/* Photo grid - The place today */}
          <div className="mb-14">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-6 flex items-center gap-3">
              <span className="w-8 h-px bg-border" />
              The place today
              <span className="flex-1 h-px bg-border" />
            </h3>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePropertyDragEnd}>
              <SortableContext items={fullPropertyOrder} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {orderedPropertyTiles.map((cat) => {
                    const photo = propertyPhotos[cat.id]
                    const isCustom = cat.isCustom
                    return (
                      <SortablePhotoTile key={cat.id} id={cat.id}>
                        <button
                          onClick={() => triggerUpload('property', cat.id)}
                          className="group relative aspect-square w-full rounded-2xl bg-card border border-border overflow-hidden hover:border-primary/50 transition-all hover:shadow-xl hover:-translate-y-1"
                          onMouseEnter={() => setHoveredCategory(cat.id)}
                          onMouseLeave={() => setHoveredCategory(null)}
                        >
                          {photo ? (
                            <>
                              <img src={photo.url} alt={cat.label} className="absolute inset-0 w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-white text-sm font-medium">Change photo</span>
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); isCustom ? removeCustomSlot('property', cat.id) : removePhoto('property', cat.id) }}
                                onPointerDown={e => e.stopPropagation()}
                                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                              >
                                <X className="w-4 h-4" />
                              </button>
                              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                                <span className="text-white text-xs font-medium">{cat.label}</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="absolute top-0 right-0 w-12 h-12 overflow-hidden">
                                <div
                                  className={`absolute -top-6 -right-6 w-12 h-12 rounded-full transition-transform duration-300 ${hoveredCategory === cat.id ? 'scale-150' : ''}`}
                                  style={{ backgroundColor: 'rgba(70, 130, 180, 0.15)' }}
                                />
                              </div>
                              {isCustom && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); removeCustomSlot('property', cat.id) }}
                                  onPointerDown={e => e.stopPropagation()}
                                  className="absolute top-2 right-2 p-1.5 rounded-full bg-border text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive z-10"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
                                <div className={`p-4 rounded-2xl transition-all duration-300 ${hoveredCategory === cat.id ? 'scale-110 shadow-lg' : ''}`} style={{
                                  backgroundColor: hoveredCategory === cat.id ? '#3d5a3c' : 'rgba(61, 90, 60, 0.1)',
                                  color: hoveredCategory === cat.id ? 'white' : '#3d5a3c'
                                }}>
                                  <cat.icon className="w-6 h-6" />
                                </div>
                                <span className="text-sm font-medium text-center">{cat.label}</span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Plus className="w-3 h-3" /> Add photo
                                </span>
                              </div>
                            </>
                          )}
                        </button>
                      </SortablePhotoTile>
                    )
                  })}
                  <button
                    onClick={() => { setAddSlotModal({ type: 'property' }); setNewSlotLabel('') }}
                    className="group aspect-square rounded-2xl border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-3 transition-all hover:shadow-lg hover:-translate-y-1 hover:bg-secondary/50"
                  >
                    <div className="p-4 rounded-2xl bg-secondary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Plus className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">Add Photo</span>
                  </button>
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {/* Inspiration board — Mood Board */}
          <div>
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-3">
                <span className="w-8 h-px bg-border" />
                Mood Board
                <Sparkles className="w-4 h-4" style={{ color: '#d4a574' }} />
                <span className="flex-1 h-px bg-border" />
              </h3>
              <p className="text-sm text-muted-foreground text-center mt-2">
                Click any tile to pin an inspiration photo — add notes below each one
              </p>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleInspirationDragEnd}>
              <SortableContext items={fullInspirationOrder} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {orderedInspirationTiles.map((item) => {
                    const colorStyles = {
                      sunset: { bg: 'rgba(212, 165, 116, 0.12)', border: 'rgba(212, 165, 116, 0.3)', text: '#d4a574', hover: 'rgba(212, 165, 116, 0.2)' },
                      lake: { bg: 'rgba(70, 130, 180, 0.12)', border: 'rgba(70, 130, 180, 0.3)', text: '#4682b4', hover: 'rgba(70, 130, 180, 0.2)' },
                      pine: { bg: 'rgba(61, 90, 60, 0.12)', border: 'rgba(61, 90, 60, 0.3)', text: '#3d5a3c', hover: 'rgba(61, 90, 60, 0.2)' },
                    }
                    const colors = colorStyles[item.color as keyof typeof colorStyles] ?? colorStyles.lake
                    const photo = inspirationPhotos[item.id]
                    const isCustom = item.isCustom
                    return (
                      <SortablePhotoTile key={item.id} id={item.id}>
                        <div>
                          <button
                            onClick={() => triggerUpload('inspiration', item.id)}
                            className="group relative aspect-[4/3] w-full rounded-2xl overflow-hidden border-2 transition-all hover:shadow-xl hover:-translate-y-1"
                            style={{ backgroundColor: photo ? undefined : colors.bg, borderColor: colors.border }}
                          >
                            {photo ? (
                              <>
                                <img src={photo.url} alt={item.label} className="absolute inset-0 w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <span className="text-white text-sm font-medium">Change photo</span>
                                </div>
                                <button
                                  onClick={(e) => { e.stopPropagation(); isCustom ? removeCustomSlot('inspiration', item.id) : removePhoto('inspiration', item.id) }}
                                  onPointerDown={e => e.stopPropagation()}
                                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                                  <span className="text-white text-xs font-medium">{item.label}</span>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <div className="absolute inset-0 animate-shimmer" style={{ background: `linear-gradient(90deg, transparent 0%, ${colors.hover} 50%, transparent 100%)`, backgroundSize: '200% 100%' }} />
                                </div>
                                {isCustom && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); removeCustomSlot('inspiration', item.id) }}
                                    onPointerDown={e => e.stopPropagation()}
                                    className="absolute top-2 right-2 p-1.5 rounded-full bg-border text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive z-10"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
                                  <div className="p-3 rounded-2xl transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg" style={{ backgroundColor: colors.bg, color: colors.text }}>
                                    <item.icon className="w-5 h-5" />
                                  </div>
                                  <span className="text-xs font-semibold text-center leading-tight">{item.label}</span>
                                  <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">Tap to pin a photo</span>
                                </div>
                              </>
                            )}
                          </button>
                          {photo && (
                            <input
                              type="text"
                              value={inspirationCaptions[item.id] || ''}
                              onChange={e => updateInspirationCaption(item.id, e.target.value)}
                              onPointerDown={e => e.stopPropagation()}
                              placeholder="Add a note…"
                              className="w-full mt-1.5 px-2 py-1 text-xs bg-transparent rounded-lg border border-transparent hover:border-border focus:border-border focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground/60 transition-colors"
                            />
                          )}
                        </div>
                      </SortablePhotoTile>
                    )
                  })}
                  <button
                    onClick={() => { setAddSlotModal({ type: 'inspiration' }); setNewSlotLabel('') }}
                    className="group aspect-[4/3] rounded-2xl border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-3 transition-all hover:shadow-lg hover:-translate-y-1 hover:bg-secondary/50"
                  >
                    <div className="p-4 rounded-2xl bg-secondary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Plus className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">Add Category</span>
                  </button>
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>
      </section>

      {/* Tasks Section */}
      <section id="progress" className="px-6 py-20 md:px-12 lg:px-20 bg-card relative overflow-hidden">
        {/* Subtle pattern */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 -right-20 w-80 h-80 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(61, 90, 60, 0.1)' }} />
          <div className="absolute bottom-20 -left-20 w-60 h-60 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(70, 130, 180, 0.1)' }} />
        </div>
        
        <div className="max-w-6xl mx-auto relative">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl" style={{ backgroundColor: 'rgba(70, 130, 180, 0.1)' }}>
                <CheckCircle2 className="w-6 h-6" style={{ color: '#4682b4' }} />
              </div>
              <h2 className="font-serif text-3xl md:text-4xl font-medium">Project Timeline</h2>
            </div>
            <button
              onClick={() => setShowAddTask(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 md:px-5 md:py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-all hover:shadow-lg"
              style={{ backgroundColor: '#3d5a3c', color: 'white' }}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Task</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>

          {/* Task list by month */}
          <div className="space-y-6">
            {MONTHS_ORDER.filter(month => groupedTasks[month]?.length > 0).map((month, groupIndex) => {
              const monthTasks = groupedTasks[month] || []
              const isOpen = openMonths[month] ?? getDefaultMonthOpen(month, monthTasks)
              const completedInMonth = monthTasks.filter(t => t.completed).length
              const sortedTasks = [...monthTasks].sort((a, b) => {
                if (a.completed === b.completed) return 0
                return a.completed ? 1 : -1
              })
              return (
                <div key={month}>
                  <button
                    onClick={() => toggleMonth(month)}
                    className="flex items-center gap-4 mb-4 w-full text-left group"
                  >
                    <span
                      className="px-4 py-1.5 rounded-full text-sm font-semibold text-white shadow-sm"
                      style={{ backgroundColor: '#3d5a3c' }}
                    >
                      {month}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {completedInMonth}/{monthTasks.length} done
                    </span>
                    <div className="flex-1 h-px bg-border" />
                    <ChevronDown
                      className="w-4 h-4 text-muted-foreground transition-transform duration-200 group-hover:text-foreground"
                      style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                    />
                  </button>
                  {/* CSS grid trick — expands downward, never causes upward layout shift */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateRows: isOpen ? '1fr' : '0fr',
                      transition: accordionTransitionsReady ? 'grid-template-rows 250ms ease' : 'none',
                    }}
                  >
                    <div style={{ overflow: 'hidden' }}>
                      <div className="space-y-3 pb-1">
                        {sortedTasks.map((task, i) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            index={i}
                            groupIndex={groupIndex}
                            onToggle={() => toggleTask(task.id)}
                            onDelete={() => deleteTask(task.id)}
                            onUpdateNotes={(notes) => updateTaskNotes(task.id, notes)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Lake Report — live weather at the cottage */}
      <LakeReport />

      {/* Notepad Section */}
      <section id="notes" className="px-6 py-20 md:px-12 lg:px-20">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-10">
            <div className="p-3 rounded-2xl" style={{ backgroundColor: 'rgba(212, 165, 116, 0.1)' }}>
              <MessageSquare className="w-6 h-6" style={{ color: '#d4a574' }} />
            </div>
            <div>
              <h2 className="font-serif text-3xl md:text-4xl font-medium">The Notepad</h2>
              <p className="text-muted-foreground mt-1">Shared notes — syncs to all devices in real time</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <textarea
              value={scratchpad}
              onChange={e => handleScratchpadChange(e.target.value)}
              onFocus={handleScratchpadFocus}
              onBlur={handleScratchpadBlur}
              placeholder="Drop quick notes here — contractor quotes, decisions made, ideas, things to remember..."
              rows={8}
              className="w-full bg-transparent text-base resize-none focus:outline-none placeholder:text-muted-foreground/40 leading-relaxed"
            />
            <div className="flex items-center justify-between pt-4 border-t border-border mt-2">
              <span
                className="text-xs font-medium transition-opacity duration-300"
                style={{ color: '#3d5a3c', opacity: scratchpadSaved ? 1 : 0 }}
              >
                ✓ Saved
              </span>
              <button
                onClick={() => {
                  if (scratchpadWriteRef.current) clearTimeout(scratchpadWriteRef.current)
                  set(dbRef(db, 'scratchpad'), scratchpad).then(() => {
                    setScratchpadSaved(true)
                    setTimeout(() => setScratchpadSaved(false), 2500)
                  })
                }}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all hover:shadow-md"
                style={{ backgroundColor: '#3d5a3c' }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </section>

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

      {/* Footer */}
      <footer className="px-6 py-16 md:px-12 lg:px-20 border-t border-border relative overflow-hidden">
        <div className="absolute inset-0 opacity-50">
          <svg className="absolute bottom-0 left-0 w-full h-32 text-secondary" viewBox="0 0 1200 128" preserveAspectRatio="none">
            <path d="M0,128 L0,64 Q300,128 600,64 Q900,0 1200,64 L1200,128 Z" fill="currentColor" opacity="0.5" />
          </svg>
        </div>
        
        <div className="max-w-6xl mx-auto relative">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-xl" style={{ backgroundColor: 'rgba(61, 90, 60, 0.1)' }}>
                <TreePine className="w-6 h-6" style={{ color: '#3d5a3c' }} />
              </div>
              <div>
                <span className="font-serif text-xl font-medium block">Cub Lake Cottage</span>
                <span className="text-sm text-muted-foreground">Kalkaska, Michigan</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center md:text-right flex items-center gap-2">
              Made with 
              <span className="inline-block animate-pulse-soft" style={{ color: '#d4a574' }}>love</span> 
              for our next chapter
            </p>
          </div>
        </div>
      </footer>

      {/* Upload error toast */}
      {uploadError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-full bg-destructive text-white text-sm font-medium shadow-lg whitespace-nowrap">
          {uploadError}
        </div>
      )}

      {/* Add Task Modal */}
      {showAddTask && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowAddTask(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-task-title"
            className="bg-card rounded-2xl p-6 w-full max-w-md shadow-2xl border border-border"
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.key === 'Escape' && setShowAddTask(false)}
          >
            <h3 id="add-task-title" className="font-serif text-xl font-medium mb-5">Add New Task</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Task</label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={e => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && addTask()}
                  placeholder="What needs to be done?"
                  autoFocus
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Category</label>
                  <select
                    value={newTask.category}
                    onChange={e => setNewTask(prev => ({ ...prev, category: e.target.value as Task['category'] }))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="personal">Personal</option>
                    <option value="rental">Rental Prep</option>
                    <option value="milestone">Milestone</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Due Date</label>
                  <input
                    type="text"
                    value={newTask.dueDate}
                    onChange={e => setNewTask(prev => ({ ...prev, dueDate: e.target.value }))}
                    placeholder="e.g. Jul 15"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Month</label>
                <select
                  value={newTask.month}
                  onChange={e => setNewTask(prev => ({ ...prev, month: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {MONTHS_ORDER.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Notes (optional)</label>
                <textarea
                  value={newTask.notes}
                  onChange={e => setNewTask(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Vendor names, decisions, context..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddTask(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addTask}
                disabled={!newTask.title.trim()}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all hover:opacity-90"
                style={{ backgroundColor: '#3d5a3c' }}
              >
                Add Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Photo/Inspo Slot Modal */}
      {addSlotModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setAddSlotModal(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-slot-title"
            className="bg-card rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-border"
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.key === 'Escape' && setAddSlotModal(null)}
          >
            <h3 id="add-slot-title" className="font-serif text-xl font-medium mb-2">
              {addSlotModal.type === 'property' ? 'Add a photo spot' : 'Add inspiration'}
            </h3>
            <p className="text-sm text-muted-foreground mb-5">
              {addSlotModal.type === 'property'
                ? 'Name the room or area — you can upload a photo after.'
                : 'Name this inspiration category — you can upload a photo after.'}
            </p>
            <input
              type="text"
              value={newSlotLabel}
              onChange={e => setNewSlotLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmAddSlot()}
              placeholder={addSlotModal.type === 'property' ? 'e.g. Back Deck, Garage, Basement…' : 'e.g. Kayak Storage, Landscaping…'}
              autoFocus
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 mb-5"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setAddSlotModal(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmAddSlot}
                disabled={!newSlotLabel.trim()}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all hover:opacity-90"
                style={{ backgroundColor: '#3d5a3c' }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function SortablePhotoTile({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 10 : undefined, position: 'relative' }}
      {...attributes}
      className="group/tile"
    >
      {/* Drag handle — separate from the click target so both work independently */}
      <div
        {...listeners}
        className="absolute top-2 left-2 z-20 p-1 rounded-md bg-black/50 text-white opacity-0 group-hover/tile:opacity-100 transition-opacity cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </div>
      {children}
    </div>
  )
}

function getDefaultMonthOpen(month: string, monthTasks: Task[]): boolean {
  if (month === 'Future Projects') return false

  const [monthName, yearStr] = month.split(' ')
  const monthDate = new Date(`${monthName} 1, ${yearStr}`)
  const now = new Date()
  const firstOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  if (monthDate > firstOfCurrentMonth) return false  // future month

  const isCurrentMonth = monthDate.getTime() === firstOfCurrentMonth.getTime()
  const allComplete = monthTasks.length > 0 && monthTasks.every(t => t.completed)

  if (allComplete && !isCurrentMonth) return false  // past month fully done

  return true
}

function TaskCard({ task, index, groupIndex, onToggle, onDelete, onUpdateNotes }: {
  task: Task
  index: number
  groupIndex: number
  onToggle: () => void
  onDelete: () => void
  onUpdateNotes: (notes: string) => void
}) {
  const [showNotes, setShowNotes] = useState(false)
  const [notesValue, setNotesValue] = useState(task.notes || '')
  const [pendingDelete, setPendingDelete] = useState(false)

  const categoryStyles = {
    personal: { bg: 'rgba(61, 90, 60, 0.08)', text: '#3d5a3c', border: 'rgba(61, 90, 60, 0.2)', label: 'Personal' },
    rental: { bg: 'rgba(70, 130, 180, 0.08)', text: '#4682b4', border: 'rgba(70, 130, 180, 0.2)', label: 'Rental Prep' },
    milestone: { bg: 'rgba(212, 165, 116, 0.08)', text: '#d4a574', border: 'rgba(212, 165, 116, 0.2)', label: 'Milestone' },
  }

  const colors = categoryStyles[task.category]

  return (
    <div
      className={`group relative pl-5 pr-8 py-5 rounded-2xl bg-background border-2 border-border hover:border-primary/30 transition-all hover:shadow-lg hover:-translate-y-0.5 ${
        task.completed ? 'opacity-60' : ''
      }`}
      style={{ animationDelay: `${(groupIndex * 3 + index) * 50}ms` }}
    >
      <div className="flex items-center gap-4">
        <button className="flex-shrink-0 transition-transform hover:scale-110" onClick={onToggle}>
          {task.completed ? (
            <div className="relative">
              <CheckCircle2 className="w-7 h-7" style={{ color: '#3d5a3c' }} />
              <div className="absolute inset-0 rounded-full animate-ping opacity-30" style={{ backgroundColor: '#3d5a3c' }} />
            </div>
          ) : (
            <Circle className="w-7 h-7 text-muted-foreground group-hover:text-primary transition-colors" />
          )}
        </button>
        <div className="flex-grow min-w-0">
          <p className={`font-medium text-base ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span
              className="text-xs px-3 py-1 rounded-full border font-medium"
              style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }}
            >
              {colors.label}
            </span>
            {task.category === 'milestone' && (
              <Star className="w-3.5 h-3.5" style={{ color: '#d4a574' }} fill="currentColor" />
            )}
          </div>
        </div>
        {/* Date — fades out on hover to make room for action icons */}
        <div className="flex-shrink-0 text-right transition-opacity group-hover:opacity-0">
          <span className={`text-sm font-semibold ${task.completed ? 'text-muted-foreground' : ''}`} style={{ color: task.completed ? undefined : '#3d5a3c' }}>
            {task.dueDate}
          </span>
        </div>
        {/* Action icons — absolutely positioned so they don't push the date inward */}
        <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!pendingDelete ? (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setShowNotes(s => !s) }}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
                title={showNotes ? 'Hide notes' : 'Add / view notes'}
              >
                <MessageSquare className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setPendingDelete(true) }}
                className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                title="Delete task"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <span className="text-xs text-muted-foreground mr-1">Delete?</span>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete() }}
                className="px-2 py-1 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors"
              >
                Yes
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setPendingDelete(false) }}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
      {/* Notes preview — visible when panel is closed and notes exist */}
      {task.notes && !showNotes && (
        <p className="text-xs text-muted-foreground truncate mt-2 pl-8">{task.notes}</p>
      )}
      {/* Notes edit panel */}
      {showNotes && (
        <div className="mt-3 pt-3 border-t border-border" onClick={e => e.stopPropagation()}>
          <textarea
            value={notesValue}
            onChange={e => setNotesValue(e.target.value)}
            onBlur={() => onUpdateNotes(notesValue)}
            placeholder="Add notes, vendor names, decisions made..."
            rows={2}
            className="w-full text-sm text-muted-foreground bg-secondary/50 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary/30 border-0"
          />
        </div>
      )}
    </div>
  )
}
