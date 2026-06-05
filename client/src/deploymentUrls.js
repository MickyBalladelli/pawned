function normalizeOrigin(value) {
  return String(value || '').trim().replace(/\/+$/, '')
}

const apiOrigin = normalizeOrigin(import.meta.env.VITE_API_ORIGIN)
const socketOrigin = normalizeOrigin(import.meta.env.VITE_SOCKET_ORIGIN || import.meta.env.VITE_API_ORIGIN)

export function getApiUrl(url) {
  if (!apiOrigin || !url.startsWith('/')) {
    return url
  }

  return `${apiOrigin}${url}`
}

export function getSocketClientUrl() {
  return `${socketOrigin || ''}/socket.io/socket.io.js`
}

export function getSocketConnectionTarget() {
  return socketOrigin || undefined
}
