export const REACTIONS = ["👍", "❤️", "🚀", "😂", "⭐️", "🎉", "🧠", "👑", "🥳"]

export const LIMITS = {
  profileNameMin: 1,
  profileNameMax: 50,
  locationMax: 80,
  descriptionMax: 280,
  postTextMax: 1200,
  commentTextMax: 280,
  maxPostImages: 10,
  profileImageMaxDimension: 640,
  profileImageQuality: 0.78,
  profileImageMaxBytes: 280 * 1024,
  postImageMaxDimension: 1200,
  postImageQuality: 0.66,
  postImageMaxBytes: 520 * 1024,
  postImagesTotalMaxBytes: 3 * 1024 * 1024,
  maxImageDimension: 1200,
  imageQuality: 0.65,
  feedBatchSize: 20,
  scrollThresholdPx: 400,
}

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]

export const DEFAULT_AI_UI_TEXT = {
  statusLoadingActive: "Active (checking Ollama...)",
  statusLoadingInactive: "Checking Ollama...",
  statusError: "Error",
  statusRunning: "Running...",
  statusReady: "Active (local Ollama)",
  statusOff: "Off",
  errorMissingPromptConfig: "AI prompt templates are missing in config.",
  errorNoProfiles: "No AI user profiles found.",
  errorModelUnavailable: "Ollama model unavailable.",
  noticeMissingPromptConfig:
    "Configure aiUserPrompt, aiPostPromptTemplate, and aiCommentPromptTemplate in config.json.",
  noticeNeedSignIn: "Sign in first to run AI users.",
  noticeCreateProfileFirst: "Create at least one AI user profile first.",
  noticeStopped: "AI users stopped.",
  noticeStarted: "AI users are active locally.",
  noticeStartFailed: "Could not connect to local Ollama.",
}

export const DEFAULT_AI_RUNTIME_TEXT = {
  unknownAiError: "Unknown AI error.",
  requestTimeout: "AI request timeout.",
  requestFailed: "AI request failed.",
  ollamaUnavailable: "Could not reach Ollama.",
  ollamaBadResponse: "Ollama returned an invalid response.",
  ollamaModelMissing: "No Ollama model configured.",
}

export const DEFAULT_AI_ACTIVITY_LABELS = {
  1: "Very slow",
  2: "Slow",
  3: "Normal",
  4: "Fast",
  5: "Very fast",
}

export const DEFAULT_CONFIG = {
  platformName: "Fakebook",
  platformIcon: "💬",
  aiLanguage: "en",
  ollamaBaseUrl: "http://127.0.0.1:11434",
  ollamaModel: "",
  ollamaTemperature: 0.75,
  ollamaTopP: 0.95,
  ollamaNumPredict: 220,
  ollamaRepeatPenalty: 1.05,
  ollamaKeepAlive: "10m",
  aiPostMaxChars: 260,
  aiCommentMaxChars: 180,
  aiUserPrompt: "",
  aiPostPromptTemplate: "",
  aiCommentPromptTemplate: "",
  aiUiText: { ...DEFAULT_AI_UI_TEXT },
  aiRuntimeText: { ...DEFAULT_AI_RUNTIME_TEXT },
  aiActivityLabels: { ...DEFAULT_AI_ACTIVITY_LABELS },
}
