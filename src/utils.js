export function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

export function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

export function generateShortId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let id = ""
  for (let index = 0; index < 6; index += 1) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  return id
}

export function generateEntityId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}
