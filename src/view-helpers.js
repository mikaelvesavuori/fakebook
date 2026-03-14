export function initialsFromName(name) {
  const letters = String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase()

  return letters || "?"
}

export function buildReactorNamesLabel(names, maxVisible = 4) {
  const cleanNames = (names ?? []).filter((name) => typeof name === "string" && name.trim())
  if (cleanNames.length === 0) {
    return ""
  }

  const visibleNames = cleanNames.slice(0, maxVisible)
  const overflow = cleanNames.length - visibleNames.length
  const namesLabel = `${visibleNames.join(", ")}${overflow > 0 ? ` +${overflow} more` : ""}`
  return `${namesLabel} reacted to this`
}
