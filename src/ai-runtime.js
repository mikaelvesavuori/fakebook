const AI_ACTIVITY_LEVELS = {
  1: { min: 120000, max: 220000 },
  2: { min: 70000, max: 130000 },
  3: { min: 35000, max: 90000 },
  4: { min: 10000, max: 30000 },
  5: { min: 3000, max: 9000 },
}

const AI_POST_MAX_CHARS_DEFAULT = 260
const AI_COMMENT_MAX_CHARS_DEFAULT = 180
const AI_OLLAMA_TIMEOUT_MS = 180000
const AI_OLLAMA_PING_TIMEOUT_MS = 8000
const AI_RECENT_TEXT_LIMIT = 12
const AI_TEXT_VARIATION_ATTEMPTS = 2
const DEFAULT_ACTIVITY_LEVEL = 3

export function createAiState() {
  return {
    enabled: false,
    status: "off",
    error: null,
    timerId: null,
    stepRunning: false,
    activityLevel: DEFAULT_ACTIVITY_LEVEL,
    recentPostsByBot: new Map(),
    recentCommentsByBot: new Map(),
  }
}

export function createAiRuntime({
  appState,
  render,
  setNotice,
  refreshFeed,
  listPosts,
  createPost,
  createComment,
  getReactionSummary,
  toggleReaction,
  reactions,
  storage,
  activityStorageKey = "fakebook:aiActivityLevel",
}) {
  const redraw = typeof render === "function" ? render : () => {}
  const notify = typeof setNotice === "function" ? setNotice : () => {}
  const refreshFeedFn = typeof refreshFeed === "function" ? refreshFeed : async () => {}
  const safeStorage =
    storage && typeof storage.getItem === "function" && typeof storage.setItem === "function"
      ? storage
      : null
  const reactionPool =
    Array.isArray(reactions) && reactions.length > 0 ? [...new Set(reactions)] : ["❤️"]

  function uiText(key) {
    const source = appState.config?.aiUiText
    const value = source && typeof source[key] === "string" ? source[key].trim() : ""
    return value
  }

  function runtimeText(key) {
    const source = appState.config?.aiRuntimeText
    const value = source && typeof source[key] === "string" ? source[key].trim() : ""
    return value
  }

  function clearAiTimer() {
    if (appState.ai.timerId) {
      window.clearTimeout(appState.ai.timerId)
      appState.ai.timerId = null
    }
  }

  function loadActivityLevel() {
    if (!safeStorage) {
      return DEFAULT_ACTIVITY_LEVEL
    }

    const raw = Number(safeStorage.getItem(activityStorageKey))
    if (Number.isInteger(raw) && raw >= 1 && raw <= 5) {
      return raw
    }

    return DEFAULT_ACTIVITY_LEVEL
  }

  function persistActivityLevel(level) {
    if (!safeStorage) {
      return
    }
    safeStorage.setItem(activityStorageKey, String(level))
  }

  function pickRandom(items) {
    if (!items.length) {
      return null
    }
    return items[Math.floor(Math.random() * items.length)]
  }

  function randomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  function trimToLength(input, maxChars) {
    const compact = String(input)
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^["'“”]+|["'“”]+$/g, "")
    if (compact.length <= maxChars) {
      return compact
    }

    const shortened = compact.slice(0, maxChars + 1)
    const sentenceBoundary = Math.max(
      shortened.lastIndexOf("."),
      shortened.lastIndexOf("!"),
      shortened.lastIndexOf("?"),
    )
    if (sentenceBoundary >= Math.floor(maxChars * 0.55)) {
      return shortened.slice(0, sentenceBoundary + 1).trim()
    }

    const boundary = shortened.lastIndexOf(" ")
    return (boundary > 48 ? shortened.slice(0, boundary) : shortened.slice(0, maxChars)).trim()
  }

  function getPostMaxChars() {
    const value = Number(appState.config.aiPostMaxChars)
    if (Number.isFinite(value) && value >= 60 && value <= 1200) {
      return Math.round(value)
    }
    return AI_POST_MAX_CHARS_DEFAULT
  }

  function getCommentMaxChars() {
    const value = Number(appState.config.aiCommentMaxChars)
    if (Number.isFinite(value) && value >= 40 && value <= 600) {
      return Math.round(value)
    }
    return AI_COMMENT_MAX_CHARS_DEFAULT
  }

  function getStatusLabel() {
    if (appState.ai.status === "loading") {
      return appState.ai.enabled ? uiText("statusLoadingActive") : uiText("statusLoadingInactive")
    }

    if (appState.ai.status === "error") {
      return uiText("statusError")
    }

    if (appState.ai.enabled && appState.ai.stepRunning) {
      return uiText("statusRunning")
    }

    if (appState.ai.enabled && appState.ai.status === "ready") {
      return uiText("statusReady")
    }

    return uiText("statusOff")
  }

  function getActivityLabel() {
    const labels = appState.config?.aiActivityLabels
    const label =
      labels && typeof labels[String(appState.ai.activityLevel)] === "string"
        ? labels[String(appState.ai.activityLevel)].trim()
        : ""
    if (label) {
      return label
    }

    const fallback =
      labels && typeof labels[String(DEFAULT_ACTIVITY_LEVEL)] === "string"
        ? labels[String(DEFAULT_ACTIVITY_LEVEL)].trim()
        : ""
    return fallback
  }

  function aiDelayRange() {
    return (
      AI_ACTIVITY_LEVELS[appState.ai.activityLevel] ?? AI_ACTIVITY_LEVELS[DEFAULT_ACTIVITY_LEVEL]
    )
  }

  function aiLanguageInstruction() {
    const language = String(appState.config.aiLanguage || "sv")
      .trim()
      .toLowerCase()
    if (language.startsWith("sv")) {
      return "svenska"
    }
    if (language.startsWith("en")) {
      return "english"
    }
    return language
  }

  function aiLanguageCode() {
    const language = String(appState.config.aiLanguage || "sv")
      .trim()
      .toLowerCase()
    if (language.startsWith("sv")) {
      return "sv"
    }
    if (language.startsWith("en")) {
      return "en"
    }
    return language
  }

  function languageHardRule(languageCode) {
    if (languageCode === "sv") {
      return "IMPORTANT: Output must be in Swedish only. Do not use English."
    }
    if (languageCode === "en") {
      return "IMPORTANT: Output must be in English only. Do not use Swedish."
    }
    return ""
  }

  function hasPromptConfig() {
    return Boolean(
      String(appState.config.aiUserPrompt || "").trim() &&
        String(appState.config.aiPostPromptTemplate || "").trim() &&
        String(appState.config.aiCommentPromptTemplate || "").trim(),
    )
  }

  function interpolatePromptTemplate(template, variables) {
    return String(template || "").replaceAll(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
      const value = variables[key]
      return value == null ? match : String(value)
    })
  }

  function buildAiBasePrompt(botName, personality, language) {
    return interpolatePromptTemplate(appState.config.aiUserPrompt, {
      botName,
      personality,
      language,
    }).trim()
  }

  function normalizeAiText(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .replace(/\s+/g, " ")
      .trim()
  }

  function recentTextsForBot(map, botId) {
    return map.get(botId) ?? []
  }

  function rememberAiText(map, botId, text) {
    if (!botId || !text) {
      return
    }

    const existing = recentTextsForBot(map, botId)
    const updated = [String(text), ...existing]
    map.set(botId, updated.slice(0, AI_RECENT_TEXT_LIMIT))
  }

  function isAiTextRepeated(text, recentTexts) {
    if (!text) {
      return false
    }
    const normalized = normalizeAiText(text)
    return recentTexts.some((entry) => normalizeAiText(entry) === normalized)
  }

  function isTimeoutError(error) {
    return (
      error?.name === "AbortError" ||
      String(error?.message || "")
        .toLowerCase()
        .includes("timeout")
    )
  }

  function normalizeBaseUrl() {
    const raw = String(appState.config.ollamaBaseUrl || "").trim()
    const fallback = "http://127.0.0.1:11434"
    return (raw || fallback).replace(/\/+$/, "")
  }

  async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      })
    } finally {
      window.clearTimeout(timeoutId)
    }
  }

  function ollamaRequestBody(prompt) {
    return {
      model: String(appState.config.ollamaModel || "").trim(),
      prompt,
      stream: false,
      keep_alive: String(appState.config.ollamaKeepAlive || "10m"),
      options: {
        temperature: Number(appState.config.ollamaTemperature ?? 0.72),
        top_p: Number(appState.config.ollamaTopP ?? 0.9),
        num_predict: Number(appState.config.ollamaNumPredict ?? 180),
        repeat_penalty: Number(appState.config.ollamaRepeatPenalty ?? 1.05),
      },
    }
  }

  function buildRecentSection(entries, languageCode, type) {
    if (!entries.length) {
      return ""
    }

    if (languageCode === "sv") {
      const label = type === "post" ? "inlägg" : "kommentarer"
      return `Undvik att upprepa dessa tidigare ${label}:\n${entries.map((entry) => `- ${entry}`).join("\n")}`
    }

    const label = type === "post" ? "posts" : "comments"
    return `Avoid repeating these earlier ${label}:\n${entries.map((entry) => `- ${entry}`).join("\n")}`
  }

  async function ensureOllamaReachable() {
    const baseUrl = normalizeBaseUrl()
    let response

    try {
      response = await fetchWithTimeout(
        `${baseUrl}/api/version`,
        { method: "GET" },
        AI_OLLAMA_PING_TIMEOUT_MS,
      )
    } catch (error) {
      if (isTimeoutError(error)) {
        throw new Error(runtimeText("requestTimeout"))
      }
      throw new Error(runtimeText("ollamaUnavailable"))
    }

    if (!response.ok) {
      throw new Error(runtimeText("ollamaUnavailable"))
    }
  }

  async function callOllamaGenerate(prompt, timeoutMs = AI_OLLAMA_TIMEOUT_MS) {
    const baseUrl = normalizeBaseUrl()
    const model = String(appState.config.ollamaModel || "").trim()

    if (!model) {
      throw new Error(runtimeText("ollamaModelMissing"))
    }

    let response
    try {
      response = await fetchWithTimeout(
        `${baseUrl}/api/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(ollamaRequestBody(prompt)),
        },
        timeoutMs,
      )
    } catch (error) {
      if (isTimeoutError(error)) {
        throw new Error(runtimeText("requestTimeout"))
      }
      throw new Error(runtimeText("ollamaUnavailable"))
    }

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`${runtimeText("requestFailed")} (${response.status}): ${body.slice(0, 180)}`)
    }

    const payload = await response.json()
    if (typeof payload?.response !== "string") {
      throw new Error(runtimeText("ollamaBadResponse"))
    }

    return payload.response
  }

  async function verifyOllamaModel() {
    const warmupPrompt = "Reply with exactly: ok"
    const text = await callOllamaGenerate(warmupPrompt, AI_OLLAMA_TIMEOUT_MS)
    if (!String(text || "").trim()) {
      throw new Error(runtimeText("ollamaBadResponse"))
    }
  }

  function buildPostPrompt(botName, personality, language, recentPosts = []) {
    const languageCode = aiLanguageCode()
    const basePrompt = buildAiBasePrompt(botName, personality, language)
    const recentSection = buildRecentSection(recentPosts, languageCode, "post")
    const postMaxChars = getPostMaxChars()
    const taskPrompt = interpolatePromptTemplate(appState.config.aiPostPromptTemplate, {
      language,
      maxChars: postMaxChars,
      recentSection,
    })
    const strictLanguageRule = languageHardRule(languageCode)
    return `${basePrompt}\n${taskPrompt}\n${strictLanguageRule}`.trim()
  }

  function buildCommentPrompt(
    botName,
    personality,
    language,
    postText,
    authorName,
    recentComments = [],
  ) {
    const languageCode = aiLanguageCode()
    const basePrompt = buildAiBasePrompt(botName, personality, language)
    const recentSection = buildRecentSection(recentComments, languageCode, "comment")
    const commentMaxChars = getCommentMaxChars()
    const taskPrompt = interpolatePromptTemplate(appState.config.aiCommentPromptTemplate, {
      authorName,
      language,
      maxChars: commentMaxChars,
      recentSection,
      postText: postText.slice(0, 180),
    })
    const strictLanguageRule = languageHardRule(languageCode)
    return `${basePrompt}\n${taskPrompt}\n${strictLanguageRule}`.trim()
  }

  async function generateAiText({ prompt, maxChars, recentTexts }) {
    if (appState.ai.status !== "ready") {
      return ""
    }

    let fallbackText = ""
    for (let index = 0; index < AI_TEXT_VARIATION_ATTEMPTS; index += 1) {
      try {
        const result = await callOllamaGenerate(prompt, AI_OLLAMA_TIMEOUT_MS)
        const text = trimToLength(String(result || ""), maxChars)
        if (!text) {
          continue
        }

        if (!fallbackText) {
          fallbackText = text
        }

        if (!isAiTextRepeated(text, recentTexts)) {
          appState.ai.error = null
          return text
        }
      } catch (error) {
        if (isTimeoutError(error)) {
          appState.ai.error = runtimeText("requestTimeout")
        } else {
          appState.ai.error = error?.message ?? runtimeText("unknownAiError")
          console.error(error)
        }
      }
    }

    return fallbackText
  }

  async function chooseAiReactionForPost(postId, profileId) {
    const summary = await getReactionSummary(postId, profileId)
    const mine = new Set(summary.mine ?? [])
    const available = reactionPool.filter((emoji) => !mine.has(emoji))
    return pickRandom(available.length ? available : reactionPool) ?? reactionPool[0] ?? "❤️"
  }

  function pickAiAction({ hasPosts, canComment, preferContent }) {
    if (!hasPosts) {
      return "post"
    }

    const options = []
    const postWeight = preferContent ? 7 : 4
    const commentWeight = preferContent ? 6 : 3
    const reactWeight = preferContent ? 0 : 2

    for (let index = 0; index < postWeight; index += 1) {
      options.push("post")
    }
    if (canComment) {
      for (let index = 0; index < commentWeight; index += 1) {
        options.push("comment")
      }
    }
    for (let index = 0; index < reactWeight; index += 1) {
      options.push("react")
    }

    return pickRandom(options) ?? "post"
  }

  function getBotProfiles() {
    return appState.profiles.filter((profile) => profile.isBot)
  }

  async function runAiStep({ preferContent = false, forceAction = null } = {}) {
    if (!appState.ai.enabled || appState.ai.stepRunning) {
      return
    }

    appState.ai.stepRunning = true
    redraw()

    try {
      const bots = getBotProfiles()
      const actingBot = pickRandom(bots)
      if (!actingBot) {
        appState.ai.enabled = false
        appState.ai.status = "off"
        appState.ai.error = uiText("errorNoProfiles")
        clearAiTimer()
        notify("error", uiText("noticeCreateProfileFirst"))
        return
      }

      const actingBotId = actingBot.id
      const botName = String(actingBot.name || actingBot.id || "").trim()
      const personality = String(actingBot.description || "").trim()
      const language = aiLanguageInstruction()
      const posts = await listPosts()
      const postsNotMine = posts.filter((post) => post.authorId !== actingBotId)
      const recentPostTexts = recentTextsForBot(appState.ai.recentPostsByBot, actingBotId).slice(
        0,
        4,
      )
      const recentCommentTexts = recentTextsForBot(
        appState.ai.recentCommentsByBot,
        actingBotId,
      ).slice(0, 4)
      const action =
        forceAction ??
        pickAiAction({
          hasPosts: posts.length > 0,
          canComment: postsNotMine.length > 0,
          preferContent,
        })

      const reactToAnyPost = async () => {
        const post = pickRandom(postsNotMine.length ? postsNotMine : posts)
        if (!post) {
          return
        }
        const reaction = await chooseAiReactionForPost(post.id, actingBotId)
        await toggleReaction({
          postId: post.id,
          profileId: actingBotId,
          emoji: reaction,
        })
      }

      if (action === "post") {
        const postMaxChars = getPostMaxChars()
        const postText = await generateAiText({
          prompt: buildPostPrompt(botName, personality, language, recentPostTexts),
          maxChars: postMaxChars,
          recentTexts: recentPostTexts,
        })

        if (postText) {
          await createPost({ authorId: actingBotId, text: postText, images: [] })
          rememberAiText(appState.ai.recentPostsByBot, actingBotId, postText)
        } else {
          await reactToAnyPost()
        }
      } else if (action === "comment" && postsNotMine.length > 0) {
        const post = pickRandom(postsNotMine)
        if (post) {
          const commentMaxChars = getCommentMaxChars()
          const authorName = String(
            appState.profileMap.get(post.authorId)?.name || post.authorId || "",
          ).trim()
          const postText = String(post.text || "").trim()
          const commentText = await generateAiText({
            prompt: buildCommentPrompt(
              botName,
              personality,
              language,
              postText,
              authorName,
              recentCommentTexts,
            ),
            maxChars: commentMaxChars,
            recentTexts: recentCommentTexts,
          })

          if (commentText) {
            await createComment({ postId: post.id, authorId: actingBotId, text: commentText })
            rememberAiText(appState.ai.recentCommentsByBot, actingBotId, commentText)
          } else {
            await reactToAnyPost()
          }
        }
      } else {
        await reactToAnyPost()
      }

      if (appState.currentProfileId) {
        await refreshFeedFn({ reset: true })
      }
    } catch (error) {
      console.error(error)
      appState.ai.error = error?.message ?? runtimeText("unknownAiError")
    } finally {
      appState.ai.stepRunning = false
      redraw()
    }
  }

  function scheduleAiStep() {
    clearAiTimer()
    if (!appState.ai.enabled) {
      return
    }

    const range = aiDelayRange()
    appState.ai.timerId = window.setTimeout(
      async () => {
        appState.ai.timerId = null
        await runAiStep({ preferContent: appState.ai.activityLevel >= 4 })
        scheduleAiStep()
      },
      randomDelay(range.min, range.max),
    )
  }

  function stop() {
    clearAiTimer()
    appState.ai.enabled = false
    appState.ai.status = "off"
    appState.ai.error = null
    appState.ai.stepRunning = false
  }

  async function setEnabled(enabled) {
    if (!enabled) {
      stop()
      redraw()
      return
    }

    if (appState.ai.enabled) {
      return
    }

    if (!appState.currentProfileId) {
      notify("error", uiText("noticeNeedSignIn"))
      return
    }

    if (!hasPromptConfig()) {
      appState.ai.error = uiText("errorMissingPromptConfig")
      redraw()
      notify("error", uiText("noticeMissingPromptConfig"))
      return
    }

    if (getBotProfiles().length === 0) {
      appState.ai.error = uiText("errorNoProfiles")
      redraw()
      notify("error", uiText("noticeCreateProfileFirst"))
      return
    }

    appState.ai.enabled = true
    appState.ai.status = "loading"
    appState.ai.error = null
    if (appState.feed.filter !== "all") {
      appState.feed.filter = "all"
    }
    redraw()

    try {
      await ensureOllamaReachable()
      await verifyOllamaModel()
      if (!appState.ai.enabled) {
        return
      }

      appState.ai.status = "ready"
      appState.ai.error = null
      await runAiStep({ preferContent: true, forceAction: "post" })
      if (!appState.ai.enabled) {
        redraw()
        return
      }
      scheduleAiStep()
      notify("info", uiText("noticeStarted"))
    } catch (error) {
      console.error(error)
      appState.ai.enabled = false
      appState.ai.status = "error"
      appState.ai.error = error?.message || uiText("errorModelUnavailable")
      clearAiTimer()
      notify("error", uiText("noticeStartFailed"))
    }

    redraw()
  }

  function setActivityLevel(level) {
    const normalized = Math.max(1, Math.min(5, Number(level) || DEFAULT_ACTIVITY_LEVEL))
    if (normalized === appState.ai.activityLevel) {
      return
    }

    appState.ai.activityLevel = normalized
    persistActivityLevel(normalized)

    if (appState.ai.enabled) {
      scheduleAiStep()
    }

    redraw()
  }

  return {
    getStatusLabel,
    getActivityLabel,
    getBotProfiles,
    loadActivityLevel,
    setActivityLevel,
    setEnabled,
    stop,
    __debug: {
      uiText,
      runtimeText,
      clearAiTimer,
      pickRandom,
      randomDelay,
      trimToLength,
      getPostMaxChars,
      getCommentMaxChars,
      aiDelayRange,
      aiLanguageInstruction,
      aiLanguageCode,
      languageHardRule,
      hasPromptConfig,
      interpolatePromptTemplate,
      buildAiBasePrompt,
      normalizeAiText,
      recentTextsForBot,
      rememberAiText,
      isAiTextRepeated,
      isTimeoutError,
      normalizeBaseUrl,
      ollamaRequestBody,
      buildRecentSection,
      ensureOllamaReachable,
      callOllamaGenerate,
      verifyOllamaModel,
      buildPostPrompt,
      buildCommentPrompt,
      generateAiText,
      chooseAiReactionForPost,
      pickAiAction,
      runAiStep,
      scheduleAiStep,
    },
  }
}
