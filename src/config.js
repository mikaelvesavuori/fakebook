import { DEFAULT_CONFIG } from "./constants.js"

function sanitizeConfig(config) {
  if (!config || typeof config !== "object") {
    return DEFAULT_CONFIG
  }

  const platformName =
    typeof config.platformName === "string" && config.platformName.trim()
      ? config.platformName.trim()
      : DEFAULT_CONFIG.platformName

  const platformIcon =
    typeof config.platformIcon === "string" && config.platformIcon.trim()
      ? config.platformIcon.trim()
      : DEFAULT_CONFIG.platformIcon

  return {
    platformName,
    platformIcon,
  }
}

export async function loadConfig() {
  try {
    const response = await fetch("./config.json")
    if (!response.ok) {
      throw new Error(`Failed loading config (${response.status})`)
    }

    return sanitizeConfig(await response.json())
  } catch (error) {
    console.warn("Using default config due to config load issue", error)
    return DEFAULT_CONFIG
  }
}
