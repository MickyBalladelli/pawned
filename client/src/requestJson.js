import { getApiUrl } from './deploymentUrls'

export async function requestJson(url, options) {
  const response = await fetch(getApiUrl(url), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const error = new Error(payload?.error || 'Request failed')
    error.payload = payload
    error.status = response.status
    throw error
  }

  return payload
}
