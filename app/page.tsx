'use client'

import { useState, useEffect, useRef } from 'react'
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
} from 'lucide-react'
import { type Task, initialTasks, MONTHS_ORDER } from '@/lib/tasks'

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
  
  // Photo states — synced via Firebase RTDB (metadata) + Firebase Storage (files)
  const [propertyPhotos, setPropertyPhotos] = useState<Record<string, PhotoUpload | null>>({ front: null, lake: null, dock: null, living: null, kitchen: null })
  const [inspirationPhotos, setInspirationPhotos] = useState<Record<string, PhotoUpload | null>>({ hottub: null, decor: null, firepit: null, dock: null })
  const [visionPhotos, setVisionPhotos] = useState<PhotoUpload[]>([])
  const [photosLoaded, setPhotosLoaded] = useState(false)
  const isFirebasePhotoUpdate = useRef(false)
  const [uploading, setUploading] = useState(false)
  
  // File input refs
  const propertyInputRef = useRef<HTMLInputElement>(null)
  const inspirationInputRef = useRef<HTMLInputElement>(null)
  const visionInputRef = useRef<HTMLInputElement>(null)
  const [activeUploadTarget, setActiveUploadTarget] = useState<{ type: 'property' | 'inspiration' | 'vision'; id?: string } | null>(null)

  // Computed values
  const completedCount = tasks.filter(t => t.completed).length
  const totalCount = tasks.length
  const progressPercent = Math.round((completedCount / totalCount) * 100)

  useEffect(() => {
    setMounted(true)
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
    set(dbRef(db, 'tasks'), tasks)
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
        setVisionPhotos(data.visionPhotos ? Object.values(data.visionPhotos) as PhotoUpload[] : [])
      }
      setPhotosLoaded(true)
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
    set(dbRef(db, 'photos'), { propertyPhotos, inspirationPhotos, visionPhotos })
  }, [propertyPhotos, inspirationPhotos, visionPhotos, photosLoaded])

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
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
      } else if (target.type === 'vision') {
        setVisionPhotos(prev => [...prev, upload])
      }
    } catch (err) {
      console.error('Photo upload failed:', err)
    }

    setUploading(false)
    setActiveUploadTarget(null)
    e.target.value = ''
  }

  const triggerUpload = (type: 'property' | 'inspiration' | 'vision', id?: string) => {
    setActiveUploadTarget({ type, id })
    if (type === 'property') propertyInputRef.current?.click()
    else if (type === 'inspiration') inspirationInputRef.current?.click()
    else visionInputRef.current?.click()
  }

  const removePhoto = (type: 'property' | 'inspiration' | 'vision', id: string) => {
    let photo: PhotoUpload | null | undefined

    if (type === 'property') {
      photo = propertyPhotos[id]
      setPropertyPhotos(prev => ({ ...prev, [id]: null }))
    } else if (type === 'inspiration') {
      photo = inspirationPhotos[id]
      setInspirationPhotos(prev => ({ ...prev, [id]: null }))
    } else {
      photo = visionPhotos.find(p => p.id === id)
      setVisionPhotos(prev => prev.filter(p => p.id !== id))
    }

    if (photo?.storagePath) {
      deleteObject(storageRef(storage, photo.storagePath)).catch(err =>
        console.error('Failed to delete from storage:', err)
      )
    }
  }

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
      <input type="file" ref={visionInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
      
      {/* Upload progress banner */}
      {uploading && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full bg-foreground text-background text-sm font-medium shadow-xl flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
          Uploading photo…
        </div>
      )}

      {/* Hero Section - Replace HERO_IMAGE_URL with your cottage photo */}
      <section className="relative overflow-hidden text-white min-h-[85vh] flex flex-col">
        {/* Background Image - swap this URL for your cottage photo */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ 
            backgroundImage: `url('/cottage-hero.jpg')`,
            backgroundColor: '#3d5a3c' // Fallback color until you add your image
          }}
        >
          {/* Gradient overlays for text readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-black/20" />
        </div>

        <div className="relative flex-1 flex flex-col px-6 pt-8 pb-16 md:px-12 lg:px-20">
          {/* Header */}
          <div className={`flex items-center justify-between mb-auto ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-sm">
                <TreePine className="w-6 h-6" />
              </div>
              <span className="text-sm font-medium tracking-widest uppercase opacity-80">Est. 2026</span>
            </div>
            <nav className="hidden md:flex items-center gap-8 text-sm">
              <button onClick={() => scrollToSection('property')} className="opacity-70 hover:opacity-100 transition-all hover:tracking-wide">The Property</button>
              <button onClick={() => scrollToSection('progress')} className="opacity-70 hover:opacity-100 transition-all hover:tracking-wide">Progress</button>
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {photoCategories.map((cat, i) => {
                const photo = propertyPhotos[cat.id]
                return (
                  <button
                    key={cat.id}
                    onClick={() => triggerUpload('property', cat.id)}
                    className="group relative aspect-square rounded-2xl bg-card border border-border overflow-hidden hover:border-primary/50 transition-all hover:shadow-xl hover:-translate-y-1"
                    onMouseEnter={() => setHoveredCategory(cat.id)}
                    onMouseLeave={() => setHoveredCategory(null)}
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    {photo ? (
                      <>
                        <img src={photo.url} alt={cat.label} className="absolute inset-0 w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-white text-sm font-medium">Change photo</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); removePhoto('property', cat.id) }}
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
                        {/* Decorative corner */}
                        <div className="absolute top-0 right-0 w-12 h-12 overflow-hidden">
                          <div 
                            className={`absolute -top-6 -right-6 w-12 h-12 rounded-full transition-transform duration-300 ${hoveredCategory === cat.id ? 'scale-150' : ''}`}
                            style={{ backgroundColor: 'rgba(70, 130, 180, 0.15)' }}
                          />
                        </div>
                        
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
                          <div className={`p-4 rounded-2xl transition-all duration-300 ${
                            hoveredCategory === cat.id ? 'scale-110 shadow-lg' : ''
                          }`} style={{ 
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
                )
              })}
            </div>
          </div>

          {/* Inspiration board - Where it's headed */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-6 flex items-center gap-3">
              <span className="w-8 h-px bg-border" />
              Where it&apos;s headed 
              <Sparkles className="w-4 h-4" style={{ color: '#d4a574' }} />
              <span className="flex-1 h-px bg-border" />
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {inspirationBoard.map((item) => {
                const colorStyles = {
                  sunset: { bg: 'rgba(212, 165, 116, 0.12)', border: 'rgba(212, 165, 116, 0.3)', text: '#d4a574', hover: 'rgba(212, 165, 116, 0.2)' },
                  lake: { bg: 'rgba(70, 130, 180, 0.12)', border: 'rgba(70, 130, 180, 0.3)', text: '#4682b4', hover: 'rgba(70, 130, 180, 0.2)' },
                  pine: { bg: 'rgba(61, 90, 60, 0.12)', border: 'rgba(61, 90, 60, 0.3)', text: '#3d5a3c', hover: 'rgba(61, 90, 60, 0.2)' },
                }
                const colors = colorStyles[item.color as keyof typeof colorStyles]
                const photo = inspirationPhotos[item.id]
                
                return (
                  <button
                    key={item.id}
                    onClick={() => triggerUpload('inspiration', item.id)}
                    className="group relative aspect-[4/3] rounded-2xl overflow-hidden border-2 transition-all hover:shadow-xl hover:-translate-y-1"
                    style={{ backgroundColor: photo ? undefined : colors.bg, borderColor: colors.border }}
                  >
                    {photo ? (
                      <>
                        <img src={photo.url} alt={item.label} className="absolute inset-0 w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-white text-sm font-medium">Change photo</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); removePhoto('inspiration', item.id) }}
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
                        {/* Shimmer effect on hover */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="absolute inset-0 animate-shimmer" style={{ background: `linear-gradient(90deg, transparent 0%, ${colors.hover} 50%, transparent 100%)`, backgroundSize: '200% 100%' }} />
                        </div>
                        
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
                          <div 
                            className="p-4 rounded-2xl transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg"
                            style={{ backgroundColor: colors.bg, color: colors.text }}
                          >
                            <item.icon className="w-6 h-6" />
                          </div>
                          <span className="text-sm font-semibold">{item.label}</span>
                        </div>
                      </>
                    )}
                  </button>
                )
              })}
              <button 
                onClick={() => triggerUpload('inspiration', `custom-${Date.now()}`)}
                className="group aspect-[4/3] rounded-2xl border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-3 transition-all hover:shadow-lg hover:-translate-y-1 hover:bg-secondary/50"
              >
                <div className="p-4 rounded-2xl bg-secondary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Plus className="w-6 h-6" />
                </div>
                <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">Add Inspo</span>
              </button>
            </div>
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
          <div className="space-y-10">
            {Object.entries(groupedTasks).map(([month, monthTasks], groupIndex) => (
              <div key={month}>
                <div className="flex items-center gap-4 mb-5">
                  <span 
                    className="px-4 py-1.5 rounded-full text-sm font-semibold text-white shadow-sm"
                    style={{ backgroundColor: '#3d5a3c' }}
                  >
                    {month}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {monthTasks.length} task{monthTasks.length !== 1 ? 's' : ''}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="space-y-3">
                  {monthTasks.map((task, i) => (
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
            ))}
          </div>
        </div>
      </section>

      {/* Vision Section */}
      <section id="vision" className="px-6 py-20 md:px-12 lg:px-20 relative overflow-hidden">
        {/* Decorative background */}
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-50 pointer-events-none">
          <div className="absolute top-20 right-20 w-64 h-64 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(70, 130, 180, 0.15)' }} />
          <div className="absolute bottom-40 right-40 w-48 h-48 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(212, 165, 116, 0.15)' }} />
        </div>
        
        <div className="max-w-6xl mx-auto relative">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-sm font-medium mb-6">
                <Sparkles className="w-4 h-4" style={{ color: '#d4a574' }} />
                <span>The Vision</span>
              </div>
              <h2 className="font-serif text-4xl md:text-5xl font-medium mb-8 text-balance leading-tight">
                This is just the <span className="italic">beginning</span>
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed mb-8">
                Every great adventure starts with a single step. Our cottage on Cub Lake 
                represents more than just a property — it&apos;s where memories will be made, 
                where mornings start with lake views, and where life slows down just enough 
                to really be enjoyed.
              </p>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-3 text-sm bg-card px-4 py-2 rounded-full border border-border">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#3d5a3c' }} />
                  <span className="font-medium">Renovations</span>
                </div>
                <div className="flex items-center gap-3 text-sm bg-card px-4 py-2 rounded-full border border-border">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#4682b4' }} />
                  <span className="font-medium">Lake Life</span>
                </div>
                <div className="flex items-center gap-3 text-sm bg-card px-4 py-2 rounded-full border border-border">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#d4a574' }} />
                  <span className="font-medium">Short-term Rental</span>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-[4/3] rounded-3xl bg-secondary border border-border overflow-hidden shadow-2xl">
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-8">
                  <div className="p-5 rounded-2xl bg-background shadow-sm">
                    <ImageIcon className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-lg mb-2">Add your vision board</p>
                    <p className="text-sm text-muted-foreground">Upload inspiration photos and mockups</p>
                  </div>
                  <button
                    onClick={() => triggerUpload('vision')}
                    className="mt-2 px-6 py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-all hover:shadow-lg"
                    style={{ backgroundColor: '#3d5a3c', color: 'white' }}
                  >
                    Upload Photos
                  </button>
                </div>
              </div>
              {/* Decorative elements */}
              <div className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full blur-2xl" style={{ backgroundColor: 'rgba(70, 130, 180, 0.3)' }} />
              <div className="absolute -top-6 -left-6 w-24 h-24 rounded-full blur-xl" style={{ backgroundColor: 'rgba(212, 165, 116, 0.3)' }} />
              {/* Corner accent */}
              <div className="absolute -top-3 -right-3 w-24 h-24">
                <svg viewBox="0 0 100 100" className="w-full h-full" style={{ color: '#d4a574' }}>
                  <circle cx="80" cy="20" r="3" fill="currentColor" opacity="0.6" />
                  <circle cx="90" cy="35" r="2" fill="currentColor" opacity="0.4" />
                  <circle cx="70" cy="10" r="2" fill="currentColor" opacity="0.3" />
                </svg>
              </div>
            </div>
          </div>
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

      {/* Add Task Modal */}
      {showAddTask && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowAddTask(false)}
        >
          <div
            className="bg-card rounded-2xl p-6 w-full max-w-md shadow-2xl border border-border"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-serif text-xl font-medium mb-5">Add New Task</h3>
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
    </main>
  )
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

  const categoryStyles = {
    personal: { bg: 'rgba(61, 90, 60, 0.08)', text: '#3d5a3c', border: 'rgba(61, 90, 60, 0.2)', label: 'Personal' },
    rental: { bg: 'rgba(70, 130, 180, 0.08)', text: '#4682b4', border: 'rgba(70, 130, 180, 0.2)', label: 'Rental Prep' },
    milestone: { bg: 'rgba(212, 165, 116, 0.08)', text: '#d4a574', border: 'rgba(212, 165, 116, 0.2)', label: 'Milestone' },
  }

  const colors = categoryStyles[task.category]

  return (
    <div
      className={`group p-5 rounded-2xl bg-background border-2 border-border hover:border-primary/30 transition-all hover:shadow-lg hover:-translate-y-0.5 ${
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
        <div className="flex-shrink-0 text-right">
          <span className={`text-sm font-semibold ${task.completed ? 'text-muted-foreground' : ''}`} style={{ color: task.completed ? undefined : '#3d5a3c' }}>
            {task.dueDate}
          </span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); setShowNotes(s => !s) }}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
            title={showNotes ? 'Hide notes' : 'Add / view notes'}
          >
            <MessageSquare className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            title="Delete task"
          >
            <X className="w-4 h-4" />
          </button>
          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-all" />
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
