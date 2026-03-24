'use client'
import { createContext, useContext, useEffect, useState } from 'react'

export const THEMES = {
 linen: {
  name: 'Warm Linen',
  themeColor: '#CEC6BB', 
  emoji: '🌾',
  preview: ['#B3A89D', '#D99E5C', '#F8F3EE', '#2C241E'],
  vars: {
    '--bg-primary': '#CEC6BB',
    '--bg-secondary': '#F1E9E0',
    '--bg-card': '#F8F3EE',
    '--bg-dark-card': '#2C241E',
    '--bg-glass': 'rgba(255,255,255,0.45)',
    '--border-glass': 'rgba(255,255,255,0.4)',
    '--input-bg': 'rgba(255,255,255,0.3)',
    '--accent-main': '#D99E5C',
    '--accent-green': '#2D7A5F',
    '--accent-terra': '#D99E5C',
    '--accent-blue': '#4A6FA5',
    '--accent-rose': '#C0605A',
    '--accent-violet': '#7C6FAB',
    '--accent-gold': '#C17A3A',
    '--sidebar-bg': '#F8F3EE',
    '--sidebar-border': 'rgba(255,255,255,0.4)',
    '--progress-track': '#EAE2D8',
    '--text-primary': '#1A1410',
    '--text-secondary': '#6D5F54',
    '--text-muted': '#918479',
  }
},
  
  ocean: {
    name: 'Ocean Slate',
    themeColor: '#E8F4F6',
    emoji: '🌊',
    preview: ['#FFFFFF', '#0ABDC6', '#F1F5F9', '#0F172A'],
    vars: {
      '--bg-primary': '#E8F4F6',
      '--bg-secondary': '#F1F5F9',
      '--bg-card': '#FFFFFF',
      '--bg-glass': 'rgba(255,255,255,0.85)',
      '--border-glass': 'rgba(10,189,198,0.15)',
      '--accent-green': '#0ABDC6',
      '--accent-terra': '#0ABDC6',
      '--accent-blue': '#38BDF8',
      '--accent-rose': '#F472B6',
      '--accent-violet': '#7C6FAB',
      '--accent-gold': '#F59E0B',
      '--accent-main': '#0ABDC6',
      '--accent-danger': '#EF4444',
      '--text-primary': '#0F172A',
      '--text-secondary': '#334155',
      '--text-muted': '#94A3B8',
      '--sidebar-bg': '#FFFFFF',
      '--sidebar-border': 'rgba(10,189,198,0.12)',
      '--input-bg': '#F1F5F9',
      '--progress-track': '#E2E8F0',
      '--bg-dark-card': '#0F172A',
    }
  },
  forest: {
    name: 'Forest Moss',
    themeColor: '#1A1A1A',
    emoji: '🛰️',
    preview: ['#1A1A1A', '#0056D6', '#4C7862', '#D35400'],
    vars: {
      '--bg-primary': '#EAECEE',
      '--bg-secondary': '#F4F6F7',
      '--bg-card': '#F4F6F7',
      '--bg-dark-card': '#1A1A1A',
      '--bg-glass': 'rgba(234, 236, 238, 0.75)',
      '--border-glass': '#BDC3C7',
      '--input-bg': '#EAECEE',
      '--progress-track': '#F4F6F7',
      '--accent-main': '#4C7862',
      '--accent-green': '#4C7862',
      '--accent-terra': '#D35400',
      '--accent-blue': '#0056D6',
      '--accent-rose': '#C0392B',
      '--accent-violet': '#8E44AD',
      '--accent-gold': '#B5833A',
      '--accent-danger': '#C0392B',
      '--text-primary': '#1A1A1A',
      '--text-secondary': '#7F8C8D',
      '--text-muted': '#95A5A6',
      '--sidebar-bg': '#F4F6F7',
      '--sidebar-border': '#BDC3C7',
    }
  },
  carbon: {
    name: 'Forged Carbon',
    themeColor: '#080808',
    emoji: '🕶️',
    preview: ['#080808', '#B8860B', '#1A1A1A', '#E0E0E0'],
    vars: {
      '--bg-primary': '#080808',
      '--bg-secondary': '#121212',
      '--bg-card': '#171717',
      '--bg-dark-card': '#050505',
      '--bg-glass': 'rgba(23, 23, 23, 0.8)',
      '--border-glass': '#262626',
      '--input-bg': '#0F0F0F',
      '--progress-track': '#262626',
      '--accent-main': '#B8860B',
      '--accent-green': '#3E5C45',
      '--accent-terra': '#8B4513',
      '--accent-blue': '#243447',
      '--accent-rose': '#5C2E2E',
      '--accent-violet': '#3D2B56',
      '--accent-gold': '#D4AF37',
      '--accent-danger': '#7F1D1D',
      '--text-primary': '#E5E5E5',
      '--text-secondary': '#A3A3A3',
      '--text-muted': '#525252',
      '--sidebar-bg': '#0A0A0A',
      '--sidebar-border': '#1A1A1A',
    }
  },
  silk: {
    name: 'Desert Silk',
    themeColor: '#F7F3F0',
    emoji: '🏺',
    preview: ['#F7F3F0', '#D4A373', '#6B705C', '#BC6C25'],
    vars: {
      '--bg-primary': '#F7F3F0',
      '--bg-secondary': '#EFE9E4',
      '--bg-card': '#FFFFFF',
      '--bg-dark-card': '#2D2824',
      '--bg-glass': 'rgba(255, 255, 255, 0.7)',
      '--border-glass': '#E2D9D2',
      '--input-bg': '#FAF9F8',
      '--progress-track': '#EFE9E4',
      '--accent-main': '#D4A373',
      '--accent-green': '#6B705C',
      '--accent-terra': '#BC6C25',
      '--accent-blue': '#A98467',
      '--accent-rose': '#A44A3F',
      '--accent-violet': '#582F0E',
      '--accent-gold': '#B5833A',
      '--accent-danger': '#8B322C',
      '--text-primary': '#2D2824',
      '--text-secondary': '#6B6158',
      '--text-muted': '#A39990',
      '--sidebar-bg': '#FFFFFF',
      '--sidebar-border': '#E2D9D2',
    }
  },
}

// ✅ Declarada DESPUÉS de THEMES para evitar el bug de hoisting con const
export function getThemeColors(themeName) {
  const vars = THEMES[themeName]?.vars
  if (!vars) return []
  return [
    vars['--accent-green'],
    vars['--accent-terra'],
    vars['--accent-blue'],
    vars['--accent-rose'],
    vars['--accent-violet'],
    vars['--accent-gold'],
  ].filter(Boolean)
}

const ThemeContext = createContext({ theme: 'linen', setTheme: () => { } })

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('linen')

  const updateThemeMeta = (color) => {
    let meta = document.querySelector('meta[name="theme-color"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'theme-color'
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', color)
  }

  useEffect(() => {
    let saved = null
    try { saved = localStorage.getItem('ff-theme') } catch (e) { }
    if (saved && THEMES[saved]) {
      setThemeState(saved)
      const t = THEMES[saved]
      const root = document.documentElement
      Object.entries(t.vars).forEach(([key, val]) => root.style.setProperty(key, val))
      updateThemeMeta(t.themeColor)
    }
  }, [])

  useEffect(() => {
    const t = THEMES[theme]
    if (!t) return
    const root = document.documentElement
    Object.entries(t.vars).forEach(([key, val]) => root.style.setProperty(key, val))
    try { localStorage.setItem('ff-theme', theme) } catch (e) { }
    updateThemeMeta(t.themeColor)
    window.dispatchEvent(new CustomEvent('theme-change'))
  }, [theme])

  // ← esta función faltaba
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