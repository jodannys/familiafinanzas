'use client'
import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: 'rgba(44,32,22,0.35)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div className={`relative w-full rounded-2xl animate-enter ${sizes[size]}`}
        style={{ background: 'var(--bg-card)', border: '1px solid #E4D9CE', boxShadow: '0 20px 60px rgba(100,70,30,0.18)' }}>
        <div className="flex items-center justify-between p-6" style={{ borderBottom: '1px solid #F0E9DF' }}>
          <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-primary)', border:'1px solid #E4D9CE', cursor:'pointer' }}>
            <X size={16} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
