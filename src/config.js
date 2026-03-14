import { DEFAULT_CONFIG } from "./constants.js"

function sanitizeString(value, fallback) {
  if (typeof value === "string" && value.trim()) {
    return value.trim()
  }
  return fallback
}

function sanitizeNumber(value, fallback, min, max) {
  const parsed = Number(value)
  if (Number.isFinite(parsed) && parsed >= min && parsed <= max) {
    return parsed
  }
  return fallback
}

function sanitizePromptTemplate(value, fallback) {
  if (typeof value === "string" && value.trim()) {
    return value.trim()
  }

  if (Array.isArray(value)) {
    const lines = value
      .filter((line) => typeof line === "string")
      .map((line) => line.trim())
      .filter(Boolean)
    if (lines.length > 0) {
      return lines.join("\n")
    }
  }

  return fallback
}

function sanitizeConfig(config) {
  if (!config || typeof config !== "object") {
    return {
      ...DEFAULT_CONFIG,
      aiUiText: { ...DEFAULT_CONFIG.aiUiText },
      aiRuntimeText: { ...DEFAULT_CONFIG.aiRuntimeText },
      aiActivityLabels: { ...DEFAULT_CONFIG.aiActivityLabels },
    }
  }

  const platformName = sanitizeString(config.platformName, DEFAULT_CONFIG.platformName)

  const platformIcon = sanitizeString(config.platformIcon, DEFAULT_CONFIG.platformIcon)

  const aiLanguage = sanitizeString(config.aiLanguage, DEFAULT_CONFIG.aiLanguage)
  const ollamaBaseUrl = sanitizeString(config.ollamaBaseUrl, DEFAULT_CONFIG.ollamaBaseUrl)
  const ollamaModel = sanitizeString(config.ollamaModel, DEFAULT_CONFIG.ollamaModel)
  const ollamaTemperature = sanitizeNumber(
    config.ollamaTemperature,
    DEFAULT_CONFIG.ollamaTemperature,
    0,
    2,
  )
  const ollamaTopP = sanitizeNumber(config.ollamaTopP, DEFAULT_CONFIG.ollamaTopP, 0, 1)
  const ollamaNumPredict = Math.round(
    sanitizeNumber(config.ollamaNumPredict, DEFAULT_CONFIG.ollamaNumPredict, 16, 512),
  )
  const ollamaRepeatPenalty = sanitizeNumber(
    config.ollamaRepeatPenalty,
    DEFAULT_CONFIG.ollamaRepeatPenalty,
    1,
    1.5,
  )
  const ollamaKeepAlive = sanitizeString(config.ollamaKeepAlive, DEFAULT_CONFIG.ollamaKeepAlive)
  const aiPostMaxChars = Math.round(
    sanitizeNumber(config.aiPostMaxChars, DEFAULT_CONFIG.aiPostMaxChars, 60, 1200),
  )
  const aiCommentMaxChars = Math.round(
    sanitizeNumber(config.aiCommentMaxChars, DEFAULT_CONFIG.aiCommentMaxChars, 40, 600),
  )

  const aiUserPrompt = sanitizePromptTemplate(config.aiUserPrompt, DEFAULT_CONFIG.aiUserPrompt)
  const aiPostPromptTemplate = sanitizePromptTemplate(
    config.aiPostPromptTemplate,
    DEFAULT_CONFIG.aiPostPromptTemplate,
  )
  const aiCommentPromptTemplate = sanitizePromptTemplate(
    config.aiCommentPromptTemplate,
    DEFAULT_CONFIG.aiCommentPromptTemplate,
  )
  return {
    platformName,
    platformIcon,
    aiLanguage,
    ollamaBaseUrl,
    ollamaModel,
    ollamaTemperature,
    ollamaTopP,
    ollamaNumPredict,
    ollamaRepeatPenalty,
    ollamaKeepAlive,
    aiPostMaxChars,
    aiCommentMaxChars,
    aiUserPrompt,
    aiPostPromptTemplate,
    aiCommentPromptTemplate,
    aiUiText: { ...DEFAULT_CONFIG.aiUiText },
    aiRuntimeText: { ...DEFAULT_CONFIG.aiRuntimeText },
    aiActivityLabels: { ...DEFAULT_CONFIG.aiActivityLabels },
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
