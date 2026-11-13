import { useEffect, useState } from 'react'

export type Loaded<T> = { state: 'loading' } | { state: 'unavailable' } | { state: 'ok'; data: T }

/** Fetch a JSON file from the pipeline output. A 404 or non-JSON reply becomes 'unavailable'. */
export function useJson<T>(path: string | null): Loaded<T> {
  const [res, setRes] = useState<{ path: string | null; v: Loaded<T> }>({
    path: null,
    v: { state: 'loading' },
  })
  useEffect(() => {
    if (path === null) return
    let cancelled = false
    const url = `${import.meta.env.BASE_URL}${path}`
    fetch(url)
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status))
        // The dev server may answer 200 + index.html for a missing file; JSON.parse then fails.
        return JSON.parse(await r.text()) as T
      })
      .then((data) => {
        if (!cancelled) setRes({ path, v: { state: 'ok', data } })
      })
      .catch(() => {
        if (!cancelled) setRes({ path, v: { state: 'unavailable' } })
      })
    return () => {
      cancelled = true
    }
  }, [path])
  if (path === null) return { state: 'unavailable' }
  return res.path === path ? res.v : { state: 'loading' }
}
