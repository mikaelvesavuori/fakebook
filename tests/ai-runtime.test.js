import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createAiRuntime, createAiState } from "../src/ai-runtime.js"
import { DEFAULT_CONFIG } from "../src/constants.js"

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() {
      return body
    },
    async text() {
      return typeof body === "string" ? body : JSON.stringify(body)
    },
  }
}

function createRuntimeHarness(overrides = {}) {
  const appState = {
    config: {
      ...DEFAULT_CONFIG,
      aiUiText: { ...DEFAULT_CONFIG.aiUiText },
      aiRuntimeText: { ...DEFAULT_CONFIG.aiRuntimeText },
      aiActivityLabels: { ...DEFAULT_CONFIG.aiActivityLabels },
      aiLanguage: "en",
      ollamaModel: "llama3.2:3b",
      aiUserPrompt: "You are {{botName}}. Personality: {{personality}}. Language: {{language}}.",
      aiPostPromptTemplate: "Write a short post in {{language}} max {{maxChars}}. {{recentSection}}",
      aiCommentPromptTemplate:
        "Write one comment to {{authorName}} in {{language}} max {{maxChars}} about {{postText}}. {{recentSection}}",
    },
    ai: createAiState(),
    profiles: [{ id: "bot1", name: "Bot", description: "Friendly", isBot: true }],
    profileMap: new Map([
      ["user1", { id: "user1", name: "Mikael" }],
      ["user2", { id: "user2", name: "Sara" }],
    ]),
    feed: { filter: "all" },
    currentProfileId: "user1",
    ...overrides.appState,
  }

  const deps = {
    render: vi.fn(),
    setNotice: vi.fn(),
    refreshFeed: vi.fn(async () => {}),
    listPosts: vi.fn(async () => []),
    createPost: vi.fn(async () => {}),
    createComment: vi.fn(async () => {}),
    getReactionSummary: vi.fn(async () => ({ mine: [] })),
    toggleReaction: vi.fn(async () => {}),
    reactions: ["👍", "❤️", "🎉"],
    storage: {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    },
    ...overrides.deps,
  }

  const runtime = createAiRuntime({
    appState,
    ...deps,
  })

  return { appState, deps, runtime }
}

describe("ai-runtime", () => {
  const originalWindow = globalThis.window
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.window = {
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    }
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    globalThis.window = originalWindow
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it("creates default AI state", () => {
    const state = createAiState()
    expect(state.enabled).toBe(false)
    expect(state.status).toBe("off")
    expect(state.activityLevel).toBe(3)
    expect(state.recentPostsByBot).toBeInstanceOf(Map)
  })

  it("returns only bot profiles", () => {
    const { runtime } = createRuntimeHarness({
      appState: {
        profiles: [
          { id: "bot1", isBot: true },
          { id: "user1", isBot: false },
        ],
      },
    })
    expect(runtime.getBotProfiles()).toEqual([{ id: "bot1", isBot: true }])
  })

  it("loads activity level from storage and persists updates", () => {
    const { runtime, appState, deps } = createRuntimeHarness({
      deps: {
        storage: {
          getItem: vi.fn(() => "4"),
          setItem: vi.fn(),
        },
      },
    })

    expect(runtime.loadActivityLevel()).toBe(4)
    runtime.setActivityLevel(5)
    expect(appState.ai.activityLevel).toBe(5)
    expect(deps.storage.setItem).toHaveBeenCalledWith("fakebook:aiActivityLevel", "5")
  })

  it("falls back to default activity level when storage is missing or invalid", () => {
    const missingStorage = createRuntimeHarness({ deps: { storage: null } })
    expect(missingStorage.runtime.loadActivityLevel()).toBe(3)

    const badStorage = createRuntimeHarness({
      deps: {
        storage: {
          getItem: vi.fn(() => "bad"),
          setItem: vi.fn(),
        },
      },
    })
    expect(badStorage.runtime.loadActivityLevel()).toBe(3)
  })

  it("exposes status and activity labels across branches", () => {
    const { runtime, appState } = createRuntimeHarness()

    appState.ai.status = "loading"
    appState.ai.enabled = true
    expect(runtime.getStatusLabel()).toBe(DEFAULT_CONFIG.aiUiText.statusLoadingActive)

    appState.ai.enabled = false
    expect(runtime.getStatusLabel()).toBe(DEFAULT_CONFIG.aiUiText.statusLoadingInactive)

    appState.ai.status = "error"
    expect(runtime.getStatusLabel()).toBe(DEFAULT_CONFIG.aiUiText.statusError)

    appState.ai.status = "ready"
    appState.ai.enabled = true
    appState.ai.stepRunning = true
    expect(runtime.getStatusLabel()).toBe(DEFAULT_CONFIG.aiUiText.statusRunning)

    appState.ai.stepRunning = false
    expect(runtime.getStatusLabel()).toBe(DEFAULT_CONFIG.aiUiText.statusReady)

    appState.ai.enabled = false
    appState.ai.status = "off"
    expect(runtime.getStatusLabel()).toBe(DEFAULT_CONFIG.aiUiText.statusOff)

    appState.ai.activityLevel = 5
    appState.config.aiActivityLabels = { 3: "Normal fallback" }
    expect(runtime.getActivityLabel()).toBe("Normal fallback")

    appState.config.aiActivityLabels = {}
    expect(runtime.getActivityLabel()).toBe("")
  })

  it("has debug helpers for string and language normalization", () => {
    const { runtime, appState } = createRuntimeHarness()
    const d = runtime.__debug

    expect(d.uiText("statusOff")).toBe(DEFAULT_CONFIG.aiUiText.statusOff)
    expect(d.runtimeText("requestTimeout")).toBe(DEFAULT_CONFIG.aiRuntimeText.requestTimeout)

    expect(d.trimToLength('  "Hello   world!"  ', 30)).toBe("Hello world!")
    expect(d.trimToLength("This is one. This is two. This is three.", 18)).toBe("This is one.")
    expect(d.trimToLength("This sentence should be cut on a word boundary near the end", 52)).toBe(
      "This sentence should be cut on a word boundary near",
    )

    appState.config.aiPostMaxChars = 500
    appState.config.aiCommentMaxChars = 280
    expect(d.getPostMaxChars()).toBe(500)
    expect(d.getCommentMaxChars()).toBe(280)
    appState.config.aiPostMaxChars = 5
    appState.config.aiCommentMaxChars = 9999
    expect(d.getPostMaxChars()).toBe(260)
    expect(d.getCommentMaxChars()).toBe(180)

    appState.config.aiLanguage = "sv-SE"
    expect(d.aiLanguageInstruction()).toBe("svenska")
    expect(d.aiLanguageCode()).toBe("sv")
    appState.config.aiLanguage = "en-US"
    expect(d.aiLanguageInstruction()).toBe("english")
    expect(d.aiLanguageCode()).toBe("en")
    appState.config.aiLanguage = "fi"
    expect(d.aiLanguageInstruction()).toBe("fi")
    expect(d.aiLanguageCode()).toBe("fi")

    expect(d.languageHardRule("sv")).toMatch(/Swedish/)
    expect(d.languageHardRule("en")).toMatch(/English/)
    expect(d.languageHardRule("fi")).toBe("")

    expect(d.interpolatePromptTemplate("Hello {{name}} {{missing}}", { name: "A" })).toBe(
      "Hello A {{missing}}",
    )
    expect(d.buildAiBasePrompt("Bot", "Kind", "english")).toContain("Bot")

    expect(d.normalizeAiText("Hej!!  världen?")).toBe("hej världen")
    expect(d.isAiTextRepeated("Hej världen", ["hej, världen!!"])).toBe(true)
    expect(d.isAiTextRepeated("", ["x"])).toBe(false)

    const memory = new Map()
    d.rememberAiText(memory, "", "x")
    d.rememberAiText(memory, "bot1", "")
    expect(d.recentTextsForBot(memory, "bot1")).toEqual([])
    for (let index = 0; index < 20; index += 1) {
      d.rememberAiText(memory, "bot1", `entry-${index}`)
    }
    expect(d.recentTextsForBot(memory, "bot1")).toHaveLength(12)
    expect(d.recentTextsForBot(memory, "bot1")[0]).toBe("entry-19")

    expect(d.isTimeoutError({ name: "AbortError" })).toBe(true)
    expect(d.isTimeoutError({ message: "Request timeout after 10s" })).toBe(true)
    expect(d.isTimeoutError(new Error("x"))).toBe(false)

    appState.config.ollamaBaseUrl = " http://localhost:11434/ "
    expect(d.normalizeBaseUrl()).toBe("http://localhost:11434")
    appState.config.ollamaBaseUrl = ""
    expect(d.normalizeBaseUrl()).toBe("http://127.0.0.1:11434")

    const body = d.ollamaRequestBody("Hello")
    expect(body.model).toBe("llama3.2:3b")
    expect(body.prompt).toBe("Hello")
  })

  it("has debug helpers for random selection and prompt sections", () => {
    const { runtime } = createRuntimeHarness()
    const d = runtime.__debug

    vi.spyOn(Math, "random").mockReturnValueOnce(0)
    expect(d.pickRandom(["a", "b", "c"])).toBe("a")
    expect(d.pickRandom([])).toBeNull()

    vi.spyOn(Math, "random").mockReturnValueOnce(0)
    expect(d.randomDelay(100, 200)).toBe(100)

    expect(d.buildRecentSection([], "en", "post")).toBe("")
    expect(d.buildRecentSection(["Hej"], "sv", "post")).toMatch(/inlägg/)
    expect(d.buildRecentSection(["Hi"], "en", "comment")).toMatch(/comments/)

    expect(d.pickAiAction({ hasPosts: false, canComment: false, preferContent: false })).toBe("post")
    vi.spyOn(Math, "random").mockReturnValue(0.99)
    expect(d.pickAiAction({ hasPosts: true, canComment: false, preferContent: false })).toBe("react")
    vi.spyOn(Math, "random").mockReturnValue(0.7)
    expect(d.pickAiAction({ hasPosts: true, canComment: true, preferContent: true })).toBe("comment")
  })

  it("handles low-level Ollama calls and errors", async () => {
    const { runtime, appState } = createRuntimeHarness()
    const d = runtime.__debug

    globalThis.fetch = vi.fn(async (url) => {
      if (String(url).endsWith("/api/version")) {
        return jsonResponse({ version: "1.0.0" })
      }
      return jsonResponse({ response: "ok" })
    })
    await expect(d.ensureOllamaReachable()).resolves.toBeUndefined()
    await expect(d.callOllamaGenerate("hello")).resolves.toBe("ok")

    globalThis.fetch = vi.fn(async () => jsonResponse({}, { ok: false, status: 500 }))
    await expect(d.ensureOllamaReachable()).rejects.toThrow(DEFAULT_CONFIG.aiRuntimeText.ollamaUnavailable)

    const timeoutError = new Error("aborted")
    timeoutError.name = "AbortError"
    globalThis.fetch = vi.fn(async () => {
      throw timeoutError
    })
    await expect(d.ensureOllamaReachable()).rejects.toThrow(DEFAULT_CONFIG.aiRuntimeText.requestTimeout)

    appState.config.ollamaModel = ""
    await expect(d.callOllamaGenerate("x")).rejects.toThrow(DEFAULT_CONFIG.aiRuntimeText.ollamaModelMissing)
    appState.config.ollamaModel = "llama3.2:3b"

    globalThis.fetch = vi.fn(async () => jsonResponse("broken", { ok: false, status: 429 }))
    await expect(d.callOllamaGenerate("x")).rejects.toThrow(/AI request failed/)

    globalThis.fetch = vi.fn(async () => jsonResponse({ nope: true }))
    await expect(d.callOllamaGenerate("x")).rejects.toThrow(DEFAULT_CONFIG.aiRuntimeText.ollamaBadResponse)

    globalThis.fetch = vi.fn(async () => jsonResponse({ response: "  " }))
    await expect(d.verifyOllamaModel()).rejects.toThrow(DEFAULT_CONFIG.aiRuntimeText.ollamaBadResponse)
  })

  it("builds prompts and generates text with repetition handling", async () => {
    const { runtime, appState } = createRuntimeHarness()
    const d = runtime.__debug

    appState.config.aiLanguage = "sv"
    const postPrompt = d.buildPostPrompt("Bot", "Kind", "svenska", ["Hej igen"])
    expect(postPrompt).toMatch(/IMPORTANT: Output must be in Swedish only/)
    expect(postPrompt).toMatch(/Hej igen/)

    const commentPrompt = d.buildCommentPrompt(
      "Bot",
      "Kind",
      "svenska",
      "x".repeat(250),
      "Mikael",
      ["Hej"],
    )
    expect(commentPrompt).toMatch(/Mikael/)
    expect(commentPrompt).toMatch(/IMPORTANT: Output must be in Swedish only/)
    expect(commentPrompt).toContain("x".repeat(180))

    appState.ai.status = "off"
    expect(await d.generateAiText({ prompt: "x", maxChars: 50, recentTexts: [] })).toBe("")

    appState.ai.status = "ready"
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ response: "Hello there." }))
      .mockResolvedValueOnce(jsonResponse({ response: "Hello there." }))
    const repeated = await d.generateAiText({
      prompt: "x",
      maxChars: 50,
      recentTexts: ["hello there"],
    })
    expect(repeated).toBe("Hello there.")

    const timeoutError = new Error("timeout")
    timeoutError.name = "AbortError"
    globalThis.fetch = vi.fn(async () => {
      throw timeoutError
    })
    const timeoutText = await d.generateAiText({ prompt: "x", maxChars: 50, recentTexts: [] })
    expect(timeoutText).toBe("")
    expect(appState.ai.error).toBe(DEFAULT_CONFIG.aiRuntimeText.requestTimeout)

    globalThis.fetch = vi.fn(async () => {
      throw {}
    })
    const unknownText = await d.generateAiText({ prompt: "x", maxChars: 50, recentTexts: [] })
    expect(unknownText).toBe("")
    expect(appState.ai.error).toBe(DEFAULT_CONFIG.aiRuntimeText.ollamaUnavailable)
  })

  it("chooses reactions and runs all AI action paths", async () => {
    const { runtime, appState, deps } = createRuntimeHarness({
      deps: {
        listPosts: vi.fn(async () => [{ id: "p1", authorId: "user2", text: "hello from user2" }]),
      },
    })
    const d = runtime.__debug
    appState.ai.enabled = true
    appState.ai.status = "ready"

    deps.getReactionSummary.mockResolvedValue({ mine: ["👍", "❤️"], reactorProfileIds: [] })
    vi.spyOn(Math, "random").mockReturnValue(0)
    expect(await d.chooseAiReactionForPost("p1", "bot1")).toBe("🎉")

    deps.getReactionSummary.mockResolvedValue({ mine: ["👍"], reactorProfileIds: [] })
    expect(await d.chooseAiReactionForPost("p1", "bot1")).toBe("❤️")

    globalThis.fetch = vi.fn(async () => jsonResponse({ response: "A generated post." }))
    await d.runAiStep({ forceAction: "post" })
    expect(deps.createPost).toHaveBeenCalledTimes(1)

    globalThis.fetch = vi.fn(async () => jsonResponse({ response: "A generated comment." }))
    await d.runAiStep({ forceAction: "comment" })
    expect(deps.createComment).toHaveBeenCalledTimes(1)

    globalThis.fetch = vi.fn(async () => jsonResponse({ response: "   " }))
    await d.runAiStep({ forceAction: "comment" })
    expect(deps.toggleReaction).toHaveBeenCalled()

    await d.runAiStep({ forceAction: "react" })
    expect(deps.toggleReaction).toHaveBeenCalled()
  })

  it("handles runAiStep early returns and errors", async () => {
    const { runtime, appState, deps } = createRuntimeHarness({
      deps: {
        listPosts: vi.fn(async () => [{ id: "p1", authorId: "user2", text: "hello" }]),
      },
    })
    const d = runtime.__debug

    appState.ai.enabled = false
    await d.runAiStep()
    expect(deps.listPosts).not.toHaveBeenCalled()

    appState.ai.enabled = true
    appState.ai.stepRunning = true
    await d.runAiStep()
    expect(deps.listPosts).not.toHaveBeenCalled()
    appState.ai.stepRunning = false

    appState.profiles = [{ id: "u1", isBot: false }]
    appState.ai.timerId = 123
    window.clearTimeout = vi.fn()
    await d.runAiStep()
    expect(appState.ai.enabled).toBe(false)
    expect(appState.ai.status).toBe("off")
    expect(appState.ai.error).toBe(DEFAULT_CONFIG.aiUiText.errorNoProfiles)

    appState.ai.enabled = true
    appState.ai.status = "ready"
    appState.profiles = [{ id: "bot1", name: "Bot", description: "", isBot: true }]
    deps.listPosts.mockRejectedValueOnce(new Error("boom"))
    await d.runAiStep()
    expect(appState.ai.error).toBe("boom")
    expect(appState.ai.stepRunning).toBe(false)

    deps.listPosts.mockRejectedValueOnce({})
    await d.runAiStep()
    expect(appState.ai.error).toBe(DEFAULT_CONFIG.aiRuntimeText.unknownAiError)
  })

  it("schedules and clears AI steps", async () => {
    const { runtime, appState, deps } = createRuntimeHarness({
      deps: {
        listPosts: vi.fn(async () => []),
      },
    })
    const d = runtime.__debug

    const scheduled = []
    window.setTimeout = vi.fn((fn) => {
      scheduled.push(fn)
      return scheduled.length
    })
    window.clearTimeout = vi.fn()

    appState.ai.enabled = false
    d.scheduleAiStep()
    expect(window.setTimeout).not.toHaveBeenCalled()

    appState.ai.enabled = true
    appState.ai.status = "ready"
    globalThis.fetch = vi.fn(async () => jsonResponse({ response: "Scheduled post." }))
    d.scheduleAiStep()
    expect(window.setTimeout).toHaveBeenCalledTimes(1)
    expect(appState.ai.timerId).toBe(1)

    await scheduled[0]()
    expect(window.setTimeout.mock.calls.length).toBeGreaterThanOrEqual(3)
    expect(deps.createPost).toHaveBeenCalled()

    runtime.stop()
    expect(window.clearTimeout).toHaveBeenCalled()
    expect(appState.ai.enabled).toBe(false)
  })

  it("covers setEnabled branches and transitions", async () => {
    const { runtime, appState, deps } = createRuntimeHarness()

    await runtime.setEnabled(false)
    expect(appState.ai.enabled).toBe(false)

    appState.ai.enabled = true
    await runtime.setEnabled(true)
    expect(appState.ai.enabled).toBe(true)
    appState.ai.enabled = false

    appState.currentProfileId = null
    await runtime.setEnabled(true)
    expect(deps.setNotice).toHaveBeenCalledWith("error", DEFAULT_CONFIG.aiUiText.noticeNeedSignIn)
    appState.currentProfileId = "user1"

    appState.config.aiUserPrompt = ""
    await runtime.setEnabled(true)
    expect(appState.ai.error).toBe(DEFAULT_CONFIG.aiUiText.errorMissingPromptConfig)
    appState.config.aiUserPrompt = "You are {{botName}}"

    appState.profiles = [{ id: "u1", isBot: false }]
    await runtime.setEnabled(true)
    expect(appState.ai.error).toBe(DEFAULT_CONFIG.aiUiText.errorNoProfiles)
    appState.profiles = [{ id: "bot1", name: "Bot", isBot: true }]

    appState.feed.filter = "mine"
    globalThis.fetch = vi.fn(async (url) => {
      if (String(url).endsWith("/api/version")) {
        return jsonResponse({ version: "1.0.0" })
      }
      return jsonResponse({ response: "ok" })
    })
    await runtime.setEnabled(true)
    expect(appState.feed.filter).toBe("all")
    runtime.stop()

    globalThis.fetch = vi.fn(async (url) => {
      if (String(url).endsWith("/api/version")) {
        return jsonResponse({ version: "1.0.0" })
      }
      runtime.stop()
      return jsonResponse({ response: "ok" })
    })
    await runtime.setEnabled(true)
    expect(appState.ai.enabled).toBe(false)

    const harness2 = createRuntimeHarness({
      deps: {
        createPost: vi.fn(async () => {
          harness2.runtime.stop()
        }),
        listPosts: vi.fn(async () => []),
      },
    })
    globalThis.fetch = vi.fn(async (url) => {
      if (String(url).endsWith("/api/version")) {
        return jsonResponse({ version: "1.0.0" })
      }
      const callIndex = globalThis.fetch.mock.calls.filter(([u]) =>
        String(u).endsWith("/api/generate"),
      ).length
      if (callIndex === 1) {
        return jsonResponse({ response: "ok" })
      }
      return jsonResponse({ response: "post text" })
    })
    await harness2.runtime.setEnabled(true)
    expect(harness2.appState.ai.enabled).toBe(false)

    const networkDown = createRuntimeHarness()
    globalThis.fetch = vi.fn(async () => {
      throw new Error("network down")
    })
    await networkDown.runtime.setEnabled(true)
    expect(networkDown.appState.ai.status).toBe("error")
    expect(networkDown.deps.setNotice).toHaveBeenCalledWith(
      "error",
      DEFAULT_CONFIG.aiUiText.noticeStartFailed,
    )
  })

  it("clamps activity level and reschedules when enabled", () => {
    const { runtime, appState, deps } = createRuntimeHarness()
    const d = runtime.__debug

    const scheduled = []
    window.setTimeout = vi.fn((fn) => {
      scheduled.push(fn)
      return scheduled.length
    })
    window.clearTimeout = vi.fn()

    runtime.setActivityLevel(3)
    expect(deps.render).not.toHaveBeenCalled()

    runtime.setActivityLevel(20)
    expect(appState.ai.activityLevel).toBe(5)

    appState.ai.enabled = true
    d.scheduleAiStep()
    runtime.setActivityLevel(1)
    expect(appState.ai.activityLevel).toBe(1)
    expect(window.clearTimeout).toHaveBeenCalled()
  })
})
