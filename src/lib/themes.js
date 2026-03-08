'use client'
import { createContext, useContext, useEffect, useState } from 'react'

export const THEMES = {
  linen: {
    name: 'Warm Linen',
    themeColor: '#F7F3EE',
    emoji: '🌾',
    preview: ['#F7F3EE', '#2D7A5F', '#C17A3A', '#FFFFFF'],
    vars: {
      '--bg-primary': '#F7F3EE',
      '--bg-secondary': '#EFE9E1',
      '--bg-card': '#FFFFFF',
      '--bg-glass': 'rgba(255,255,255,0.7)',
      '--border-glass': '#E4D9CE',
      '--accent-green': '#2D7A5F',
      '--accent-terra': '#C17A3A',
      '--accent-blue': '#4A6FA5',
      '--accent-rose': '#C0605A',
      '--text-primary': '#1a140e',
      '--text-secondary': '#544739',
      '--text-muted': '#8c7e6d',
      '--sidebar-bg': '#FFFFFF',
      '--sidebar-border': '#E4D9CE',
      '--input-bg': '#FDFCFB',
      '--progress-track': '#EFE9E1',
    }
  },
  obsidian: {
    name: 'Dark Obsidian',
    themeColor: '#07090E',
    emoji: '🌑',
    preview: ['#07090E', '#10b981', '#6366f1', '#111827'],
    vars: {
      '--bg-primary': '#07090E', // Negro profundo
      '--bg-secondary': '#0F121A',
      '--bg-card': '#111827', // Azul noche
      '--bg-glass': 'rgba(17,24,39,0.8)',
      '--border-glass': 'rgba(255,255,255,0.06)',
      '--accent-green': '#10b981',
      '--accent-terra': '#f59e0b',
      '--accent-blue': '#6366f1', // Indigo para un look más moderno
      '--accent-rose': '#f43f5e',
      '--text-primary': '#F9FAFB',
      '--text-secondary': '#9CA3AF',
      '--text-muted': '#4B5563',
      '--sidebar-bg': '#0F121A',
      '--sidebar-border': 'rgba(255,255,255,0.05)',
      '--input-bg': 'rgba(255,255,255,0.03)',
      '--progress-track': '#1F2937',
    }
  },
  ocean: {
    name: 'Ocean Slate',
    themeColor: '#020617',
    emoji: '🌊',
    preview: ['#020617', '#38bdf8', '#818cf8', '#0f172a'],
    vars: {
      '--bg-primary': '#020617',
      '--bg-secondary': '#0B1120',
      '--bg-card': '#0F172A',
      '--bg-glass': 'rgba(15,23,42,0.8)',
      '--border-glass': 'rgba(56,189,248,0.1)',
      '--accent-green': '#22d3ee', // Cian
      '--accent-terra': '#818cf8',
      '--accent-blue': '#38bdf8',
      '--accent-rose': '#f43f5e',
      '--text-primary': '#F1F5F9',
      '--text-secondary': '#64748B',
      '--text-muted': '#334155',
      '--sidebar-bg': '#0B1120',
      '--sidebar-border': 'rgba(56,189,248,0.08)',
      '--input-bg': '#1E293B',
      '--progress-track': '#1E293B',
    }
  },
  forest: {
    name: 'Forest Moss',
    themeColor: '#F8FAF8',
    emoji: '🌿',
    preview: ['#F8FAF8', '#166534', '#854d0e', '#FFFFFF'],
    vars: {
      '--bg-primary': '#F8FAF8', // Blanco roto verdoso
      '--bg-secondary': '#EDF2ED',
      '--bg-card': '#FFFFFF',
      '--bg-glass': 'rgba(255,255,255,0.8)',
      '--border-glass': '#D1DBCE',
      '--accent-green': '#166534', // Verde bosque serio
      '--accent-terra': '#854d0e',
      '--accent-blue': '#1e40af',
      '--accent-rose': '#991b1b',
      '--text-primary': '#052e16',
      '--text-secondary': '#365314',
      '--text-muted': '#718371',
      '--sidebar-bg': '#FFFFFF',
      '--sidebar-border': '#D1DBCE',
      '--input-bg': '#F1F5F1',
      '--progress-track': '#EDF2ED',
    }
  },
}
const ThemeContext = createContext({ theme: 'linen', setTheme: () => { } })

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('linen')

  // Función interna para actualizar el meta tag dinámicamente
  const updateThemeMeta = (color) => {
    let meta = document.querySelector('meta[name="theme-color"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'theme-color'
      document.getElementsByTagName('head')[0].appendChild(meta)
    }
    meta.setAttribute('content', color)
  }

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('ff-theme') : null
    if (saved && THEMES[saved]) {
      setThemeState(saved)
      const t = THEMES[saved]
      const root = document.documentElement
      Object.entries(t.vars).forEach(([key, val]) => root.style.setProperty(key, val))
      
      // CAMBIO AQUÍ: Usamos la función dinámica
      updateThemeMeta(t.themeColor)
    }
  }, [])

  useEffect(() => {
    const t = THEMES[theme]
    if (!t) return
    const root = document.documentElement
    Object.entries(t.vars).forEach(([key, val]) => root.style.setProperty(key, val))
    localStorage.setItem('ff-theme', theme)
    
    // CAMBIO AQUÍ: Usamos la función dinámica
    updateThemeMeta(t.themeColor)
  }, [theme])

  function setTheme(t) {
    if (THEMES[t]) setThemeState(t)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}