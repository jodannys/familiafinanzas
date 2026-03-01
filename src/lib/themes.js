'use client'
import { createContext, useContext, useEffect, useState } from 'react'

export const THEMES = {
  linen: {
    name: 'Warm Linen',
    emoji: '🌾',
    preview: ['#F7F3EE', '#2D7A5F', '#C17A3A', '#FFFFFF'],
    vars: {
      '--bg-primary':    '#F7F3EE',
      '--bg-secondary':  '#EFE9E1',
      '--bg-card':       '#FFFFFF',
      '--bg-glass':      'rgba(255,255,255,0.75)',
      '--border-glass':  '#E4D9CE',
      '--accent-green':  '#2D7A5F',
      '--accent-terra':  '#C17A3A',
      '--accent-blue':   '#4A6FA5',
      '--accent-rose':   '#C0605A',
      '--text-primary':  '#2C2016',
      '--text-secondary':'#7A6A58',
      '--text-muted':    '#B5A592',
      '--sidebar-bg':    '#FFFFFF',
      '--sidebar-border':'#E4D9CE',
      '--input-bg':      '#EFE9E1',
      '--progress-track':'#EFE9E1',
    }
  },

  obsidian: {
    name: 'Dark Obsidian',
    emoji: '🌑',
    preview: ['#0a0f1e', '#10b981', '#f59e0b', '#111d33'],
    vars: {
      '--bg-primary':    '#0a0f1e',
      '--bg-secondary':  '#0d1526',
      '--bg-card':       '#111d33',
      '--bg-glass':      'rgba(255,255,255,0.04)',
      '--border-glass':  'rgba(255,255,255,0.08)',
      '--accent-green':  '#10b981',
      '--accent-terra':  '#f59e0b',
      '--accent-blue':   '#3b82f6',
      '--accent-rose':   '#f43f5e',
      '--text-primary':  '#f1f5f9',
      '--text-secondary':'#94a3b8',
      '--text-muted':    '#475569',
      '--sidebar-bg':    '#0d1526',
      '--sidebar-border':'rgba(255,255,255,0.06)',
      '--input-bg':      'rgba(255,255,255,0.05)',
      '--progress-track':'rgba(255,255,255,0.08)',
    }
  },

  ocean: {
    name: 'Ocean Slate',
    emoji: '🌊',
    preview: ['#0F1E2D', '#06B6D4', '#818CF8', '#162A3D'],
    vars: {
      '--bg-primary':    '#0F1E2D',
      '--bg-secondary':  '#162A3D',
      '--bg-card':       '#1A3248',
      '--bg-glass':      'rgba(6,182,212,0.04)',
      '--border-glass':  'rgba(6,182,212,0.12)',
      '--accent-green':  '#06B6D4',
      '--accent-terra':  '#818CF8',
      '--accent-blue':   '#38BDF8',
      '--accent-rose':   '#FB7185',
      '--text-primary':  '#E2F0FF',
      '--text-secondary':'#7BA4C4',
      '--text-muted':    '#3D6480',
      '--sidebar-bg':    '#0B1724',
      '--sidebar-border':'rgba(6,182,212,0.1)',
      '--input-bg':      'rgba(6,182,212,0.06)',
      '--progress-track':'rgba(255,255,255,0.07)',
    }
  },

  forest: {
    name: 'Forest Moss',
    emoji: '🌿',
    preview: ['#F2F7F2', '#2F6B3A', '#8B6914', '#FFFFFF'],
    vars: {
      '--bg-primary':    '#F2F7F2',
      '--bg-secondary':  '#E4EFE4',
      '--bg-card':       '#FFFFFF',
      '--bg-glass':      'rgba(255,255,255,0.8)',
      '--border-glass':  '#C8DEC8',
      '--accent-green':  '#2F6B3A',
      '--accent-terra':  '#8B6914',
      '--accent-blue':   '#2E6B8A',
      '--accent-rose':   '#A63D2F',
      '--text-primary':  '#1A2E1A',
      '--text-secondary':'#4A6B4A',
      '--text-muted':    '#8AAE8A',
      '--sidebar-bg':    '#FFFFFF',
      '--sidebar-border':'#C8DEC8',
      '--input-bg':      '#E4EFE4',
      '--progress-track':'#E4EFE4',
    }
  },
}

const ThemeContext = createContext({ theme: 'linen', setTheme: () => {} })

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('linen')

  // Load from localStorage on mount
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('ff-theme') : null
    if (saved && THEMES[saved]) setThemeState(saved)
  }, [])

  // Apply CSS variables to :root whenever theme changes
  useEffect(() => {
    const vars = THEMES[theme]?.vars
    if (!vars) return
    const root = document.documentElement
    Object.entries(vars).forEach(([key, val]) => root.style.setProperty(key, val))
    localStorage.setItem('ff-theme', theme)
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
