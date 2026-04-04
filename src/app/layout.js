import './globals.css'
import { ThemeProvider } from '@/lib/themes'

export const metadata = {
  title:       ' Economía del Hogar',
  description: 'Gestión inteligente de los gastos del hogar',
  appleWebApp: {
    capable:         true,
    statusBarStyle:  'black-translucent',
    title:           'Economía del Hogar',
  },
  icons: {
    icon:  '/icon.svg',
    apple: '/icon.svg',
  },
}

export const viewport = {
  width:          'device-width',
  initialScale:   1,
  maximumScale:   1,
  userScalable:   false,
  viewportFit:    'cover',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* FIX 1: eliminado <link rel="manifest"> duplicado — metadata lo inyecta */}
        <meta name="mobile-web-app-capable"            content="yes" />
        <meta name="apple-mobile-web-app-capable"      content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title"        content="Economía del Hogar" />
        <link rel="apple-touch-icon" href="/icon.svg" />

        {/* Aplica el tema guardado ANTES del primer paint para evitar flash */}
        <script dangerouslySetInnerHTML={{
          __html: `
(function() {
  var T = {
    linen: {"--bg-primary":"#C9BFB3","--bg-secondary":"#E8DDD3","--bg-card":"#F5EFE8","--bg-dark-card":"#2C241E","--bg-glass":"rgba(245,239,232,0.78)","--border-glass":"rgba(255,255,255,0.62)","--sidebar-bg":"#EDE4D8","--sidebar-border":"rgba(120,100,82,0.28)","--progress-track":"#DDD0C2","--input-bg":"rgba(255,255,255,0.78)","--accent-main":"#B07838","--accent-green":"#3D7A56","--accent-terra":"#A85A28","--accent-blue":"#4A6898","--accent-rose":"#A85050","--accent-violet":"#6858A0","--accent-gold":"#A87028","--accent-danger":"#A83030","--text-primary":"#1A1410","--text-secondary":"#4A3C30","--text-muted":"#88786A","--text-on-dark":"rgba(255,255,255,0.95)","--glass-blur":"14px","--radius-xl":"28px","themeColor":"#C9BFB3"},
    ocean: {"--bg-primary":"#D6EEF5","--bg-secondary":"#EDF7FB","--bg-card":"#FAFEFF","--bg-dark-card":"#0B1C2E","--bg-glass":"rgba(230,246,252,0.76)","--border-glass":"rgba(8,130,168,0.20)","--sidebar-bg":"#E8F5FA","--sidebar-border":"rgba(8,130,168,0.22)","--progress-track":"#C8E8F2","--input-bg":"rgba(255,255,255,0.82)","--accent-main":"#0882A8","--accent-green":"#0D9E74","--accent-terra":"#E8703A","--accent-blue":"#2F7FD4","--accent-rose":"#D64F8A","--accent-violet":"#6248C8","--accent-gold":"#C88A10","--accent-danger":"#D63030","--text-primary":"#0B1C2E","--text-secondary":"#1C3A52","--text-muted":"#5C7A90","--text-on-dark":"rgba(255,255,255,0.95)","--glass-blur":"14px","--radius-xl":"28px","themeColor":"#D6EEF5"},
    greenHarmony: {"--bg-primary":"#2C8028","--bg-secondary":"#3A9035","--bg-card":"#82CB4E","--bg-dark-card":"#1A2A1E","--bg-glass":"rgba(255,255,255,0.86)","--border-glass":"rgba(44,128,40,0.18)","--sidebar-bg":"#F2FBF0","--sidebar-border":"rgba(44,128,40,0.12)","--progress-track":"#4EAA44","--input-bg":"#FFFFFF","--accent-main":"#1A6018","--accent-green":"#157A38","--accent-terra":"#A87828","--accent-blue":"#2A7888","--accent-rose":"#A84848","--accent-violet":"#605898","--accent-gold":"#A88820","--accent-danger":"#B81840","--text-primary":"#FFFFFF","--text-secondary":"#0A1A0F","--text-muted":"#2D5038","--text-on-dark":"#FFFFFF","--glass-blur":"14px","--radius-xl":"28px","themeColor":"#2C8028"},
    carbon: {"--bg-primary":"#080808","--bg-secondary":"#121212","--bg-card":"#181818","--bg-dark-card":"#050505","--bg-glass":"rgba(16,16,16,0.88)","--border-glass":"rgba(255,255,255,0.07)","--sidebar-bg":"#0A0A0A","--sidebar-border":"rgba(255,255,255,0.06)","--progress-track":"#262626","--input-bg":"#222222","--accent-main":"#C8A020","--accent-green":"#4A8A58","--accent-terra":"#C06830","--accent-blue":"#4A6A9A","--accent-rose":"#A85050","--accent-violet":"#7058A8","--accent-gold":"#D4AF37","--accent-danger":"#B02020","--text-primary":"#EDE8D8","--text-secondary":"#BCAC88","--text-muted":"#9A8848","--text-on-dark":"rgba(255,255,255,0.95)","--glass-blur":"14px","--radius-xl":"28px","themeColor":"#080808"},
    dusk: {"--bg-primary":"#1E1E2E","--bg-secondary":"#313244","--bg-card":"#2A2739","--bg-dark-card":"#11111B","--bg-glass":"rgba(42,39,57,0.76)","--border-glass":"rgba(205,214,244,0.12)","--sidebar-bg":"#181825","--sidebar-border":"rgba(205,214,244,0.08)","--progress-track":"rgba(49,50,68,0.80)","--input-bg":"rgba(55,56,76,0.95)","--accent-main":"#CBA6F7","--accent-green":"#A6E3A1","--accent-terra":"#FAB387","--accent-blue":"#89B4FA","--accent-rose":"#F38BA8","--accent-violet":"#B4BEFE","--accent-gold":"#F9E2AF","--accent-danger":"#F38BA8","--text-primary":"#CDD6F4","--text-secondary":"#BAC2DE","--text-muted":"#6C7086","--text-on-dark":"#1E1E2E","--glass-blur":"14px","--radius-xl":"28px","themeColor":"#1E1E2E"},
    silk: {"--bg-primary":"#E8D2D8","--bg-secondary":"#F2E5EA","--bg-card":"#FBF4F6","--bg-dark-card":"#281820","--bg-glass":"rgba(248,242,245,0.78)","--border-glass":"rgba(168,72,106,0.18)","--sidebar-bg":"#F5ECF0","--sidebar-border":"rgba(168,72,106,0.15)","--progress-track":"#DEC8CE","--input-bg":"rgba(255,255,255,0.85)","--accent-main":"#A8486A","--accent-green":"#5A7A4A","--accent-terra":"#A87050","--accent-blue":"#6070A8","--accent-rose":"#C04068","--accent-violet":"#8050A8","--accent-gold":"#A88038","--accent-danger":"#A02840","--text-primary":"#281820","--text-secondary":"#4A2838","--text-muted":"#8A6878","--text-on-dark":"rgba(255,255,255,0.95)","--glass-blur":"14px","--radius-xl":"28px","themeColor":"#E8D2D8"}
  };
  var saved = 'linen';
  try { saved = localStorage.getItem('ff-theme') || 'linen'; } catch(e) {}
  var t = T[saved] || T['linen'];
  var r = document.documentElement;
  r.setAttribute('data-theme', saved);
  for (var k in t) {
    if (k !== 'themeColor') r.style.setProperty(k, t[k]);
  }
  r.style.backgroundColor = t['--bg-primary'];
  var meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = t.themeColor;
  document.head.appendChild(meta);
})();
`}} />
      </head>

      <body suppressHydrationWarning>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}