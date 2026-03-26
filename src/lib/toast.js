export function toast(msg, type = 'error') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ff-toast', { detail: { msg, type } }))
  }
}
