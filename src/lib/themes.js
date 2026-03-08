'use client'
import { createContext, useContext, useEffect, useState } from 'react'

export const THEMES = {
  linen: {
    name: 'Warm Linen',
    themeColor: '#B3A89D', // El tono taupe de la imagen
    emoji: '🌾',
    preview: ['#B3A89D', '#D99E5C', '#F8F3EE','#2C241E'],
    vars: {
  '--bg-primary':    '#B3A89D',
  '--bg-secondary':  '#F1E9E0',
  '--bg-card':       '#F8F3EE',
  '--bg-dark-card':  '#2C241E',
  '--bg-glass':      'rgba(255,255,255,0.45)',
  '--border-glass':  'rgba(255,255,255,0.4)',
  '--input-bg':      'rgba(255,255,255,0.3)',
  '--accent-main':   '#D99E5C',
  '--accent-green':  '#2D7A5F',   // verde semántico (ingresos, positivo)
  '--accent-terra':  '#D99E5C',   // bronce — el acento cálido principal
  '--accent-blue':   '#4A6FA5',   // azul para básicos
  '--accent-rose':   '#C0605A',   // rojo alertas/deudas
  '--accent-violet': '#7C6FAB',   // violeta para deseos
  '--accent-gold':   '#C17A3A',   // dorado inversiones
  '--sidebar-bg':    '#F8F3EE',
  '--sidebar-border':'rgba(255,255,255,0.4)',
  '--progress-track':'#EAE2D8',
  '--text-primary':  '#1A1410',
  '--text-secondary':'#6D5F54',
  '--text-muted':    '#918479',
}
  },
  obsidian: {
    name: 'Dark Obsidian',
    themeColor: '#0F1115',
    emoji: '🌑',
    preview: ['#0F1115', '#4ADE80', '#818CF8', '#1C2127'],
    vars: {
      '--bg-primary': '#0F1115', '--bg-secondary': '#16191E', '--bg-card': '#1C2127', 
      '--bg-glass': 'rgba(28,33,39,0.8)', '--border-glass': 'rgba(255,255,255,0.05)',
      '--accent-green': '#4ADE80', '--accent-terra': '#D1A35C', '--accent-blue': '#818CF8',
      '--accent-rose': '#E879F9', '--text-primary': '#E2E8F0', '--text-secondary': '#94A3B8',
      '--text-muted': '#475569', '--sidebar-bg': '#16191E', '--sidebar-border': 'rgba(255,255,255,0.04)',
      '--input-bg': '#0F1115', '--progress-track': '#2D3748',
    }
  },
  ocean: {
    name: 'Ocean Slate',
    themeColor: '#0F172A',
    emoji: '🌊',
    preview: ['#0F172A', '#38BDF8', '#94A3B8', '#1E293B'],
    vars: {
      '--bg-primary': '#0F172A', '--bg-secondary': '#1E293B', '--bg-card': '#1E293B',
      '--bg-glass': 'rgba(30,41,59,0.8)', '--border-glass': 'rgba(255,255,255,0.06)',
      '--accent-green': '#34D399', '--accent-terra': '#94A3B8', '--accent-blue': '#38BDF8',
      '--accent-rose': '#F472B6', '--text-primary': '#F8FAFC', '--text-secondary': '#94A3B8',
      '--text-muted': '#475569', '--sidebar-bg': '#0F172A', '--sidebar-border': 'rgba(255,255,255,0.04)',
      '--input-bg': '#0F172A', '--progress-track': '#334155',
    }
  },
  forest: {
    name: 'Forest Moss',
    themeColor: '#F1F5F1',
    emoji: '🌿',
    preview: ['#F1F5F1', '#3A5A40', '#A3B18A', '#FFFFFF'],
    vars: {
      '--bg-primary': '#F1F5F1', '--bg-secondary': '#E2E8E2', '--bg-card': '#FFFFFF',
      '--bg-glass': 'rgba(255,255,255,0.7)', '--border-glass': '#D4DDD4',
      '--accent-green': '#3A5A40', '--accent-terra': '#A3B18A', '--accent-blue': '#588157',
      '--accent-rose': '#BC4749', '--text-primary': '#1B2E1B', '--text-secondary': '#344E41',
      '--text-muted': '#6B8E6B', '--sidebar-bg': '#FFFFFF', '--sidebar-border': '#D4DDD4',
      '--input-bg': '#F8FAF8', '--progress-track': '#E2E8E2',
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