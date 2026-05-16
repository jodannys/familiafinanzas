'use client'
import { useTheme, getThemeColors } from '@/lib/themes'

function computeColor(nombre, themeColors) {
  if (!themeColors?.length) return '#cccccc'
  if (!nombre) return themeColors[0]
  let h = 0
  for (let i = 0; i < nombre.length; i++)
    h = (h * 31 + nombre.charCodeAt(i)) & 0x7fffffff
  return themeColors[h % themeColors.length]
}

export default function UserAvatar({ nombre, size = 36, onClick }) {
  const { theme } = useTheme()
  const themeColors = getThemeColors(theme)
  const color = computeColor(nombre, themeColors)
  const initial = nombre ? nombre.charAt(0).toUpperCase() : '?'

  const inner = Math.round(size * 0.75)
  const fontSize = Math.round(size * 0.32)

  const el = (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `color-mix(in srgb, ${color} 28%, transparent)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: inner, height: inner, borderRadius: '50%',
        background: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize, fontWeight: 700, color: 'var(--text-on-dark)', userSelect: 'none',
      }}>
        {initial}
      </div>
    </div>
  )

  if (onClick) {
    return (
      <button onClick={onClick} style={{
        padding: 0, border: 'none', background: 'transparent',
        cursor: 'pointer', display: 'flex', flexShrink: 0,
      }}>
        {el}
      </button>
    )
  }
  return el
}