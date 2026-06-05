import { getApiUrl } from './deploymentUrls'

export async function requestJson(url, options) {
  const response = await fetch(getApiUrl(url), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  const responseText = await response.text()
  let payload = null

  try {
    payload = responseText ? JSON.parse(responseText) : null
  } catch {
    payload = null
  }

  if (!response.ok) {
    const error = new Error(payload?.error || responseText || `Request failed (${response.status})`)
    error.payload = payload
    error.status = response.status
    throw error
  }

  return payload
}
