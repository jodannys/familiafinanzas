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
    '--sidebar-bg': '#F2EBE2',
    '--sidebar-border': 'rgba(180,165,150,0.45)',
    '--progress-track': '#E3D8CC',
    '--text-primary': '#1A1410',
    '--text-secondary': '#6A5C50',
    '--text-muted': '#9A8778',
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
    }
  },
  forest: {
    name: 'Forest Moss',
    themeColor: '#131C10',
    emoji: '🛰️',
    preview: ['#131C10', '#5A9E42', '#1C2D18', '#D2E8C8'],
    vars: {
      '--bg-primary': '#131C10',
      '--bg-secondary': '#1A2816',
      '--bg-card': '#1F3019',
      '--bg-dark-card': '#0B1209',
      '--bg-glass': 'rgba(31, 48, 25, 0.70)',
      '--border-glass': 'rgba(90, 158, 66, 0.20)',
      '--input-bg': 'rgba(26, 40, 22, 0.92)',
      '--progress-track': 'rgba(31, 48, 25, 0.75)',
      '--accent-main': '#5A9E42',
      '--accent-green': '#74C258',
      '--accent-terra': '#C86C38',
      '--accent-blue': '#4882C4',
      '--accent-rose': '#C45878',
      '--accent-violet': '#9858C8',
      '--accent-gold': '#C49C2C',
      '--accent-danger': '#C43838',
      '--text-primary': '#D0E8C4',
      '--text-secondary': '#84A472',
      '--text-muted': '#486240',
      '--sidebar-bg': '#0E1608',
      '--sidebar-border': 'rgba(90, 158, 66, 0.16)',
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
  dusk: {
    name: 'Dusk Violet',
    themeColor: '#1E1E2E',
    emoji: '🌌',
    preview: ['#1E1E2E', '#CBA6F7', '#2A2739', '#CDD6F4'],
    vars: {
      '--bg-primary':    '#1E1E2E',
      '--bg-secondary':  '#313244',
      '--bg-card':       '#2A2739',
      '--bg-dark-card':  '#11111B',
      '--bg-glass':      'rgba(49, 50, 68, 0.55)',
      '--border-glass':  'rgba(205, 214, 244, 0.1)',
      '--input-bg':      'rgba(49, 50, 68, 0.85)',
      '--progress-track':'rgba(49, 50, 68, 0.7)',
      '--accent-main':   '#CBA6F7',
      '--accent-green':  '#A6E3A1',
      '--accent-terra':  '#FAB387',
      '--accent-blue':   '#89B4FA',
      '--accent-rose':   '#F38BA8',
      '--accent-violet': '#B4BEFE',
      '--accent-gold':   '#F9E2AF',
      '--accent-danger': '#F38BA8',
      '--text-primary':  '#CDD6F4',
      '--text-secondary':'#BAC2DE',
      '--text-muted':    '#6C7086',
      '--sidebar-bg':    '#181825',
      '--sidebar-border':'rgba(205, 214, 244, 0.08)',
    }
  },

  ember: {
    name: 'Ember Glow',
    themeColor: '#1A1008',
    emoji: '🔥',
    preview: ['#1A1008', '#D4620A', '#2A1A0A', '#F0D0A0'],
    vars: {
      '--bg-primary': '#1A1008',
      '--bg-secondary': '#221408',
      '--bg-card': '#2A1A0A',
      '--bg-dark-card': '#100A04',
      '--bg-glass': 'rgba(42, 26, 10, 0.70)',
      '--border-glass': 'rgba(212, 98, 10, 0.22)',
      '--input-bg': 'rgba(34, 20, 8, 0.92)',
      '--progress-track': 'rgba(42, 26, 10, 0.75)',
      '--accent-main': '#D4620A',
      '--accent-green': '#7A9A30',
      '--accent-terra': '#E04808',
      '--accent-blue': '#5878B0',
      '--accent-rose': '#C04858',
      '--accent-violet': '#8858A8',
      '--accent-gold': '#D09820',
      '--accent-danger': '#C03020',
      '--text-primary': '#F0D0A0',
      '--text-secondary': '#A07840',
      '--text-muted': '#604830',
      '--sidebar-bg': '#140C04',
      '--sidebar-border': 'rgba(212, 98, 10, 0.18)',
    }
  },

  frost: {
    name: 'Steel Frost',
    themeColor: '#E6EEF4',
    emoji: '❄️',
    preview: ['#E6EEF4', '#4A7AAA', '#F6F9FC', '#1A2A3A'],
    vars: {
      '--bg-primary': '#E6EEF4',
      '--bg-secondary': '#EEF3F8',
      '--bg-card': '#F6F9FC',
      '--bg-dark-card': '#1A2A3A',
      '--bg-glass': 'rgba(246, 249, 252, 0.64)',
      '--border-glass': 'rgba(74, 122, 170, 0.18)',
      '--input-bg': '#F2F6FA',
      '--progress-track': '#DAE3EC',
      '--accent-main': '#4A7AAA',
      '--accent-green': '#3A8A68',
      '--accent-terra': '#C07050',
      '--accent-blue': '#3A6ACC',
      '--accent-rose': '#B04870',
      '--accent-violet': '#7050B0',
      '--accent-gold': '#A07828',
      '--accent-danger': '#B03030',
      '--text-primary': '#1A2A3A',
      '--text-secondary': '#384E62',
      '--text-muted': '#6A7E90',
      '--sidebar-bg': '#ECF1F6',
      '--sidebar-border': 'rgba(74, 122, 170, 0.14)',
    }
  },

  silk: {
    name: 'Desert Silk',
    themeColor: '#F0E6D8',
    emoji: '🏺',
    preview: ['#F0E6D8', '#C88C38', '#2A2018', '#FBF5EE'],
    vars: {
      '--bg-primary': '#F0E6D8',
      '--bg-secondary': '#E6D8C8',
      '--bg-card': '#FAF5EE',
      '--bg-dark-card': '#2A2018',
      '--bg-glass': 'rgba(250, 245, 238, 0.62)',
      '--border-glass': 'rgba(200, 140, 56, 0.22)',
      '--input-bg': '#FAF5EE',
      '--progress-track': '#E4D4C0',
      '--accent-main': '#C88C38',
      '--accent-green': '#587848',
      '--accent-terra': '#B85C28',
      '--accent-blue': '#687898',
      '--accent-rose': '#A83C4C',
      '--accent-violet': '#785898',
      '--accent-gold': '#BE7824',
      '--accent-danger': '#A02828',
      '--text-primary': '#2A2018',
      '--text-secondary': '#665848',
      '--text-muted': '#988878',
      '--sidebar-bg': '#FAF5EE',
      '--sidebar-border': 'rgba(200, 140, 56, 0.18)',
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