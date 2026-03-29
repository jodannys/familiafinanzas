'use client'
import { createContext, useContext, useEffect, useState } from 'react'

export const THEMES = {
  linen: {
    name: 'Warm Linen',
    themeColor: '#C9BFB3',
    emoji: '🌾',
    preview: ['#C9BFB3', '#C08540', '#F7F1EB', '#2C241E'],
    vars: {
      '--bg-primary': '#C9BFB3',
      '--bg-secondary': '#EDE4D9',
      '--bg-card': '#F7F1EB',
      '--bg-dark-card': '#2C241E',
      '--bg-glass': 'rgba(247,241,235,0.60)',
      '--border-glass': 'rgba(255,255,255,0.55)',
      '--input-bg': 'rgba(255,255,255,0.45)',
      '--accent-main': '#C08540',
      '--accent-green': '#3A7A5C',
      '--accent-terra': '#B8622A',
      '--accent-blue': '#4E6EA0',
      '--accent-rose': '#B85452',
      '--accent-violet': '#7060A8',
      '--accent-gold': '#B07830',
      '--accent-danger': '#B03030',
      '--sidebar-bg': '#F2EBE2',
      '--sidebar-border': 'rgba(180,165,150,0.45)',
      '--progress-track': '#E3D8CC',
      '--text-primary': '#1A1410',
      '--text-secondary': '#6A5C50',
      '--text-muted': '#9A8778',
      '--text-on-dark': 'rgba(255,255,255,0.95)',
    }
  },

  ocean: {
    name: 'Ocean Slate',
    themeColor: '#D6EEF5',
    emoji: '🌊',
    preview: ['#D6EEF5', '#0882A8', '#EDF7FB', '#0B1C2E'],
    vars: {
      '--bg-primary': '#D6EEF5',
      '--bg-secondary': '#EDF7FB',
      '--bg-card': '#FAFEFF',
      '--bg-dark-card': '#0B1C2E',
      '--bg-glass': 'rgba(250,254,255,0.68)',
      '--border-glass': 'rgba(8,130,168,0.18)',
      '--input-bg': '#EDF7FB',
      '--progress-track': '#C8E8F2',
      '--accent-main': '#0882A8',
      '--accent-green': '#0D9E74',
      '--accent-terra': '#E8703A',
      '--accent-blue': '#2F7FD4',
      '--accent-rose': '#D64F8A',
      '--accent-violet': '#6248C8',
      '--accent-gold': '#C88A10',
      '--accent-danger': '#D63030',
      '--text-primary': '#0B1C2E',
      '--text-secondary': '#1C3A52',
      '--text-muted': '#5C7A90',
      '--sidebar-bg': '#EAF6FA',
      '--sidebar-border': 'rgba(8,130,168,0.14)',
      '--text-on-dark': 'rgba(255,255,255,0.95)',
    }
  },

  /* VERSION 1: VERDE SALVIA ELEGANTE */
  sage: {
    name: 'Sage Oscuro',
    themeColor: '#101C17',
    emoji: '🌿',
    preview: ['#101C17', '#4A7C59', '#E8EFEA', '#86A789'],
    vars: {
      '--bg-primary': "linear-gradient(rgba(16, 28, 23, 0.40), rgba(16, 28, 23, 0.40)), url('/patterns/HD-wallpaper-whatsapp-g-background-doodle-pattern-patterns.jpg')",
      '--bg-secondary': '#192922',
      '--bg-card': '#1C2B24',
      '--bg-glass': '#1C2B24', // Añade esta línea para que el nav la encuentre
      '--bg-dark-card': '#0A120F',
      '--border-glass': 'rgba(134, 167, 137, 0.20)',
      '--accent-main': '#86A789',
      '--accent-green': '#4A7C59',
      '--accent-terra': '#C89F70',
      '--accent-blue': '#5C8090',
      '--accent-rose': '#B06A6A',
      '--accent-violet': '#7D7098',
      '--accent-gold': '#D4AF37',
      '--accent-danger': '#D15B5B',
      '--text-primary': '#E8EFEA',
      '--text-secondary': '#A3B8AC',
      '--text-muted': '#758F81',
      '--bg-pattern-size': '380px',
      '--glass-blur': '12px',
    }
  },

  /* VERSION 2: VERDE WHATSAPP OFICIAL */
  forest: {
    name: 'Verde Chat',
    themeColor: '#075E54',
    emoji: '💬',
    preview: ['#128C7E', '#25D366', '#DCF8C6', '#075E54'],
    vars: {
      '--bg-primary': "linear-gradient(rgba(11, 20, 26, 0.35), rgba(11, 20, 26, 0.35)), url('/patterns/HD-wallpaper-whatsapp-g-background-doodle-pattern-patterns.jpg')",
      '--bg-secondary': '#111B21',
      '--bg-card': '#202C33',
      '--bg-glass': '#202C33', // Añade esta línea sólida '--bg-card': 'rgba(32, 44, 51, 0.92)',
      '--bg-dark-card': '#0B141A',
      '--border-glass': 'rgba(0, 168, 132, 0.2)',
      '--accent-main': '#00A884',
      '--accent-green': '#25D366',
      '--accent-terra': '#E2A34A',
      '--accent-blue': '#53BDEB',
      '--accent-rose': '#F15C6D',
      '--accent-violet': '#B084CC',
      '--accent-gold': '#FFC531',
      '--accent-danger': '#F15C6D',
      '--text-primary': '#E9EDEF',
      '--text-secondary': '#8696A0',
      '--text-muted': '#667781',
      '--bg-pattern-size': '380px',
      '--glass-blur': '10px',
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
      '--text-on-dark': 'rgba(255,255,255,0.95)',
    }
  },

  dusk: {
    name: 'Dusk Violet',
    themeColor: '#1E1E2E',
    emoji: '🌌',
    preview: ['#1E1E2E', '#CBA6F7', '#2A2739', '#CDD6F4'],
    vars: {
      '--bg-primary': '#1E1E2E',
      '--bg-secondary': '#313244',
      '--bg-card': '#2A2739',
      '--bg-dark-card': '#11111B',
      '--bg-glass': 'rgba(49, 50, 68, 0.55)',
      '--border-glass': 'rgba(205, 214, 244, 0.1)',
      '--input-bg': 'rgba(49, 50, 68, 0.85)',
      '--progress-track': 'rgba(49, 50, 68, 0.7)',
      '--accent-main': '#CBA6F7',
      '--accent-green': '#A6E3A1',
      '--accent-terra': '#FAB387',
      '--accent-blue': '#89B4FA',
      '--accent-rose': '#F38BA8',
      '--accent-violet': '#B4BEFE',
      '--accent-gold': '#F9E2AF',
      '--accent-danger': '#F38BA8',
      '--text-primary': '#CDD6F4',
      '--text-secondary': '#BAC2DE',
      '--text-muted': '#6C7086',
      '--sidebar-bg': '#181825',
      '--sidebar-border': 'rgba(205, 214, 244, 0.08)',
      '--text-on-dark': '#1E1E2E',
    }
  },

  silk: {
    name: 'Rose Bloom',
    themeColor: '#F0E2E6',
    emoji: '🌸',
    preview: ['#F0E2E6', '#C05878', '#FDF5F7', '#2A1820'],
    vars: {
      '--bg-primary': '#F0E2E6',
      '--bg-secondary': '#F6EAEd',
      '--bg-card': '#FDF5F7',
      '--bg-dark-card': '#2A1820',
      '--bg-glass': 'rgba(253, 245, 247, 0.62)',
      '--border-glass': 'rgba(192, 88, 120, 0.20)',
      '--input-bg': '#FDF5F7',
      '--progress-track': '#EAD4DA',
      '--accent-main': '#C05878',
      '--accent-green': '#688A58',
      '--accent-terra': '#C07858',
      '--accent-blue': '#7888C0',
      '--accent-rose': '#D04070',
      '--accent-violet': '#9860B0',
      '--accent-gold': '#C09040',
      '--accent-danger': '#B02840',
      '--text-primary': '#2A1820',
      '--text-secondary': '#6A4858',
      '--text-muted': '#A08090',
      '--sidebar-bg': '#FAF0F2',
      '--sidebar-border': 'rgba(192, 88, 120, 0.16)',
      '--text-on-dark': 'rgba(255,255,255,0.95)',
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
    root.setAttribute('data-theme', theme)
    // Aplicar patrón de fondo directamente al body
    const pattern = t.vars['--bg-pattern']
    if (pattern) {
      document.body.style.backgroundImage = `url("${pattern}")`
      document.body.style.backgroundSize = t.vars['--bg-pattern-size'] || '360px'
      document.body.style.backgroundRepeat = 'repeat'
    } else {
      document.body.style.backgroundImage = ''
      document.body.style.backgroundSize = ''
      document.body.style.backgroundRepeat = ''
    }
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