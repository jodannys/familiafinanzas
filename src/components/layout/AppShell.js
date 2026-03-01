'use client'
import Sidebar from '@/components/layout/Sidebar'

export default function AppShell({ children }) {
  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen">
        {/* Background mesh */}
        <div className="fixed inset-0 ml-64 pointer-events-none" style={{ zIndex: 0 }}>
          <div style={{
            position: 'absolute', top: '-20%', right: '-10%',
            width: '600px', height: '600px',
            background: 'radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)',
          }} />
          <div style={{
            position: 'absolute', bottom: '-10%', left: '20%',
            width: '400px', height: '400px',
            background: 'radial-gradient(circle, rgba(59,130,246,0.04) 0%, transparent 70%)',
          }} />
        </div>
        <div className="relative z-10 p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
