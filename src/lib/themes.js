'use client'
import { createContext, useContext, useEffect, useState } from 'react'

export const THEMES = {

  // ─────────────────────────────────────────────────────────────────────────
  // 🌾 WARM LINEN — Papel artesanal, tinta de roble, oro viejo
  // ─────────────────────────────────────────────────────────────────────────
  linen: {
    name: 'Warm Linen',
    themeColor: '#C9BFB3',          // = --bg-primary → status bar integrada
    emoji: '🌾',
    preview: ['#C9BFB3', '#B07838', '#F5EFE8', '#1A1410'],
    vars: {
      // Fondos
      '--bg-primary':      '#C9BFB3',
      '--bg-secondary':    '#E8DDD3',
      '--bg-pattern':      '',
      '--bg-pattern-size': '360px',
      // Tarjetas
      '--bg-card':         '#F5EFE8',
      '--bg-dark-card':    '#2C241E',
      '--bg-glass':        'rgba(245,239,232,0.78)',   // vidrio cálido translúcido
      '--border-glass':    'rgba(255,255,255,0.62)',
      '--radius-xl':       '28px',
      // Navegación
      '--sidebar-bg':      '#EDE4D8',
      '--sidebar-border':  'rgba(120,100,82,0.28)',
      '--progress-track':  '#DDD0C2',
      // Inputs — claramente más blancos que el vidrio del modal
      '--input-bg':        'rgba(255,255,255,0.78)',
      // Acentos
      '--accent-main':     '#B07838',
      '--accent-green':    '#3D7A56',
      '--accent-terra':    '#A85A28',
      '--accent-blue':     '#4A6898',
      '--accent-rose':     '#A85050',
      '--accent-violet':   '#6858A0',
      '--accent-gold':     '#A87028',
      '--accent-danger':   '#A83030',
      // Tipografía — jerarquía oscura sobre fondo claro
      '--text-primary':    '#1A1410',   // máximo contraste: títulos
      '--text-secondary':  '#4A3C30',   // medio: datos y filas
      '--text-muted':      '#88786A',   // suave: etiquetas e inputs
      '--text-on-dark':    'rgba(255,255,255,0.95)',
      // Efectos
      '--glass-blur':      '14px',
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 🌊 OCEAN SLATE — Cielo atlántico, espuma, profundidad marina
  // ─────────────────────────────────────────────────────────────────────────
  ocean: {
    name: 'Ocean Slate',
    themeColor: '#D6EEF5',          // = --bg-primary
    emoji: '🌊',
    preview: ['#D6EEF5', '#0882A8', '#EDF7FB', '#0B1C2E'],
    vars: {
      '--bg-primary':      '#D6EEF5',
      '--bg-secondary':    '#EDF7FB',
      '--bg-pattern':      '',
      '--bg-pattern-size': '360px',
      '--bg-card':         '#FAFEFF',
      '--bg-dark-card':    '#0B1C2E',
      '--bg-glass':        'rgba(230,246,252,0.76)',
      '--border-glass':    'rgba(8,130,168,0.20)',
      '--radius-xl':       '28px',
      '--sidebar-bg':      '#E8F5FA',
      '--sidebar-border':  'rgba(8,130,168,0.22)',
      '--progress-track':  '#C8E8F2',
      '--input-bg':        'rgba(255,255,255,0.82)',
      '--accent-main':     '#0882A8',
      '--accent-green':    '#0D9E74',
      '--accent-terra':    '#E8703A',
      '--accent-blue':     '#2F7FD4',
      '--accent-rose':     '#D64F8A',
      '--accent-violet':   '#6248C8',
      '--accent-gold':     '#C88A10',
      '--accent-danger':   '#D63030',
      '--text-primary':    '#0B1C2E',
      '--text-secondary':  '#1C3A52',
      '--text-muted':      '#5C7A90',
      '--text-on-dark':    'rgba(255,255,255,0.95)',
      '--glass-blur':      '14px',
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 🌿 GREEN HARMONY — Dosel selvático, lima vibrante, tierra oscura
  // ─────────────────────────────────────────────────────────────────────────
  greenHarmony: {
    name: 'Green Harmony',
    themeColor: '#2C8028',          // = --bg-primary
    emoji: '🌿',
    preview: ['#2C8028', '#82CB4E', '#1F2A23', '#F0FAF2'],
    vars: {
      '--bg-primary':      '#2C8028',   // INTOCABLE ✓
      // bg-secondary muy cercano al primary → no crea rectángulos visibles
      '--bg-secondary':    '#3A9035',
      '--bg-pattern':      '',
      '--bg-pattern-size': '360px',
      '--bg-card':         '#82CB4E',   // INTOCABLE ✓
      '--bg-dark-card':    '#1A2A1E',
      // Modal: blanco translúcido suave
      '--bg-glass':        'rgba(255,255,255,0.86)',
      '--border-glass':    'rgba(44,128,40,0.18)',
      '--radius-xl':       '28px',
      '--sidebar-bg':      '#F2FBF0',   // verde muy pálido (no blanco puro)
      '--sidebar-border':  'rgba(44,128,40,0.12)',
      '--progress-track':  '#4EAA44',   // verde medio — armónico con primary
      // CRÍTICO: blanco sólido — inputs visibles sobre lima
      '--input-bg':        '#FFFFFF',
      // Acentos más oscuros/saturados para que los botones resalten sobre el lima
      '--accent-main':     '#1A6018',   // verde bosque para CTA principal
      '--accent-green':    '#157A38',
      '--accent-terra':    '#A87828',   // ocre cálido — contrasta con lima
      '--accent-blue':     '#2A7888',   // teal oscuro — claramente visible
      '--accent-rose':     '#A84848',   // carmín apagado
      '--accent-violet':   '#605898',   // violeta musgo
      '--accent-gold':     '#A88820',   // oro oliva
      '--accent-danger':   '#B81840',
      // text-primary BLANCO sobre --bg-primary (fondo verde oscuro #2C8028)
      '--text-primary':    '#FFFFFF',
      // text-secondary VERDE CASI NEGRO sobre --bg-card (lima #82CB4E) — WCAG AA ~10:1
      '--text-secondary':  '#0A1A0F',
      // text-muted: verde bosque desaturado (no gris genérico)
      '--text-muted':      '#2D5038',
      '--text-on-dark':    '#FFFFFF',
      '--glass-blur':      '14px',
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 🕶️ FORGED CARBON — Acero bruñido, oro antiguo, carbono puro
  // ─────────────────────────────────────────────────────────────────────────
  carbon: {
    name: 'Forged Carbon',
    themeColor: '#080808',          // = --bg-primary
    emoji: '🕶️',
    preview: ['#080808', '#C8A020', '#181818', '#E8E8E8'],
    vars: {
      '--bg-primary':      '#080808',
      '--bg-secondary':    '#121212',
      '--bg-pattern':      '',
      '--bg-pattern-size': '360px',
      '--bg-card':         '#181818',
      '--bg-dark-card':    '#050505',
      '--bg-glass':        'rgba(16,16,16,0.88)',      // vidrio oscuro translúcido
      '--border-glass':    'rgba(255,255,255,0.07)',
      '--radius-xl':       '28px',
      '--sidebar-bg':      '#0A0A0A',
      '--sidebar-border':  'rgba(255,255,255,0.06)',
      '--progress-track':  '#262626',
      '--input-bg':        '#222222',                  // más claro que card: resalta
      '--accent-main':     '#C8A020',
      // Acentos CORREGIDOS: más saturados para ser legibles sobre #181818
      '--accent-green':    '#4A8A58',
      '--accent-terra':    '#C06830',
      '--accent-blue':     '#4A6A9A',
      '--accent-rose':     '#A85050',
      '--accent-violet':   '#7058A8',
      '--accent-gold':     '#D4AF37',
      '--accent-danger':   '#B02020',
      // Tríada tipográfica: off-white dorado (no gris genérico) sobre carbono puro
      // --bg-card: #181818 | WCAG AA mínimo 4.5:1 sobre card
      '--text-primary':    '#EDE8D8',   // off-white ámbar  — ratio vs #181818 ≈ 17:1
      '--text-secondary':  '#BCAC88',   // piedra dorada    — ratio vs #181818 ≈  8.5:1
      '--text-muted':      '#9A8848',   // oro ceniza       — ratio vs #181818 ≈  4.5:1 (WCAG AA)
      '--text-on-dark':    'rgba(255,255,255,0.95)',
      '--glass-blur':      '14px',
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 🌌 DUSK VIOLET — Catppuccin nocturno, neblina púrpura
  // ─────────────────────────────────────────────────────────────────────────
  dusk: {
    name: 'Dusk Violet',
    themeColor: '#1E1E2E',          // = --bg-primary
    emoji: '🌌',
    preview: ['#1E1E2E', '#CBA6F7', '#2A2739', '#CDD6F4'],
    vars: {
      '--bg-primary':      '#1E1E2E',
      '--bg-secondary':    '#313244',
      '--bg-pattern':      '',
      '--bg-pattern-size': '360px',
      '--bg-card':         '#2A2739',
      '--bg-dark-card':    '#11111B',
      '--bg-glass':        'rgba(42,39,57,0.76)',      // vidrio violeta translúcido
      '--border-glass':    'rgba(205,214,244,0.12)',
      '--radius-xl':       '28px',
      '--sidebar-bg':      '#181825',
      '--sidebar-border':  'rgba(205,214,244,0.08)',
      '--progress-track':  'rgba(49,50,68,0.80)',
      '--input-bg':        'rgba(55,56,76,0.95)',      // más opaco que glass: resalta
      '--accent-main':     '#CBA6F7',
      '--accent-green':    '#A6E3A1',
      '--accent-terra':    '#FAB387',
      '--accent-blue':     '#89B4FA',
      '--accent-rose':     '#F38BA8',
      '--accent-violet':   '#B4BEFE',
      '--accent-gold':     '#F9E2AF',
      '--accent-danger':   '#F38BA8',
      '--text-primary':    '#CDD6F4',
      '--text-secondary':  '#BAC2DE',
      '--text-muted':      '#6C7086',
      '--text-on-dark':    '#1E1E2E',
      '--glass-blur':      '14px',
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 🌸 ROSE BLOOM — Peonía apagada, seda nude, malva profundo — PREMIUM
  // ─────────────────────────────────────────────────────────────────────────
  silk: {
    name: 'Rose Bloom',
    themeColor: '#E8D2D8',          // = --bg-primary
    emoji: '🌸',
    preview: ['#E8D2D8', '#A8486A', '#FBF4F6', '#281820'],
    vars: {
      // Fondos — rosa desaturado elegante, no pastel chillón
      '--bg-primary':      '#E8D2D8',
      '--bg-secondary':    '#F2E5EA',
      '--bg-pattern':      '',
      '--bg-pattern-size': '360px',
      // Tarjetas — blanco marfil con tinte rosado mínimo
      '--bg-card':         '#FBF4F6',
      '--bg-dark-card':    '#281820',
      '--bg-glass':        'rgba(248,242,245,0.78)',   // vidrio rosado suave
      '--border-glass':    'rgba(168,72,106,0.18)',
      '--radius-xl':       '28px',
      // Navegación
      '--sidebar-bg':      '#F5ECF0',
      '--sidebar-border':  'rgba(168,72,106,0.15)',
      '--progress-track':  '#DEC8CE',
      // Inputs — más blancos que el modal: claramente diferenciables
      '--input-bg':        'rgba(255,255,255,0.85)',
      // Acentos — desaturados y profundos (premium, no pop art)
      '--accent-main':     '#A8486A',
      '--accent-green':    '#5A7A4A',
      '--accent-terra':    '#A87050',
      '--accent-blue':     '#6070A8',
      '--accent-rose':     '#C04068',
      '--accent-violet':   '#8050A8',
      '--accent-gold':     '#A88038',
      '--accent-danger':   '#A02840',
      // Tipografía — jerarquía oscura sobre blanco marfil
      '--text-primary':    '#281820',   // casi negro-vino: máximo contraste
      '--text-secondary':  '#4A2838',   // malva oscuro: registros y datos
      '--text-muted':      '#8A6878',   // polvoriento: etiquetas e inputs
      '--text-on-dark':    'rgba(255,255,255,0.95)',
      // Efectos
      '--glass-blur':      '14px',
    }
  }

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