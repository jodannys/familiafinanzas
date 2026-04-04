import { useRef, useCallback, useState } from 'react'

/**
 * Previene doble-tap/click en botones de acción async.
 * Devuelve [wrap, isPending]
 *
 * Uso:
 *   const [safe, pending] = useActionLock()
 *   <button onClick={safe(handleSubmit)} disabled={pending}>
 */
export function useActionLock(delay = 900) {
  const locked = useRef(false)
  const [isPending, setIsPending] = useState(false)

  const wrap = useCallback((fn) => async (...args) => {
    if (locked.current) return
    locked.current = true
    setIsPending(true)
    try {
      await fn(...args)
    } finally {
      setTimeout(() => {
        locked.current = false
        setIsPending(false)
      }, delay)
    }
  }, [delay])

  return [wrap, isPending]
}
