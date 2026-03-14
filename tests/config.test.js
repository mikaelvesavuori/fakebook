import { afterEach, describe, expect, it, vi } from "vitest"

import { DEFAULT_CONFIG } from "../src/constants.js"
import { loadConfig } from "../src/config.js"

function mockResponse({ ok = true, status = 200, jsonData = {}, textData = "" } = {}) {
  return {
    ok,
    status,
    async json() {
      return jsonData
    },
    async text() {
      return textData
    },
  }
}

describe("loadConfig", () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it("sanitizes supported config fields", async () => {
    globalThis.fetch = vi.fn(async () =>
      mockResponse({
        ok: true,
        jsonData: {
          platformName: "  My App  ",
          platformIcon: "  🧸  ",
          profileImageMaxBytesKb: 400,
          postImageMaxBytesKb: 1600,
          postImagesTotalMaxBytesKb: 14000,
          aiLanguage: " sv ",
          ollamaBaseUrl: " http://localhost:11434 ",
          ollamaModel: " llama3.2:3b ",
          ollamaTemperature: 0.9,
          ollamaTopP: 0.8,
          ollamaNumPredict: 200.2,
          ollamaRepeatPenalty: 1.2,
          ollamaKeepAlive: " 15m ",
          aiPostMaxChars: 300,
          aiCommentMaxChars: 150,
          aiUserPrompt: [" You are {{botName}} ", "", " friendly "],
          aiPostPromptTemplate: "  Post in {{language}}  ",
          aiCommentPromptTemplate: [" Reply to {{authorName}} "],
        },
      }),
    )

    const config = await loadConfig()

    expect(config.platformName).toBe("My App")
    expect(config.platformIcon).toBe("🧸")
    expect(config.profileImageMaxBytesKb).toBe(400)
    expect(config.postImageMaxBytesKb).toBe(1600)
    expect(config.postImagesTotalMaxBytesKb).toBe(14000)
    expect(config.aiLanguage).toBe("sv")
    expect(config.ollamaBaseUrl).toBe("http://localhost:11434")
    expect(config.ollamaModel).toBe("llama3.2:3b")
    expect(config.ollamaNumPredict).toBe(200)
    expect(config.ollamaKeepAlive).toBe("15m")
    expect(config.aiUserPrompt).toBe("You are {{botName}}\nfriendly")
    expect(config.aiPostPromptTemplate).toBe("Post in {{language}}")
    expect(config.aiCommentPromptTemplate).toBe("Reply to {{authorName}}")
    expect(config.aiUiText).toEqual(DEFAULT_CONFIG.aiUiText)
    expect(config.aiRuntimeText).toEqual(DEFAULT_CONFIG.aiRuntimeText)
    expect(config.aiActivityLabels).toEqual(DEFAULT_CONFIG.aiActivityLabels)
  })

  it("falls back for invalid numeric values", async () => {
    globalThis.fetch = vi.fn(async () =>
      mockResponse({
        ok: true,
        jsonData: {
          profileImageMaxBytesKb: 1,
          postImageMaxBytesKb: 999999,
          postImagesTotalMaxBytesKb: "nope",
          ollamaTemperature: 99,
          ollamaTopP: -1,
          ollamaNumPredict: 1,
          ollamaRepeatPenalty: 10,
          aiPostMaxChars: 5,
          aiCommentMaxChars: 5000,
        },
      }),
    )

    const config = await loadConfig()

    expect(config.profileImageMaxBytesKb).toBe(DEFAULT_CONFIG.profileImageMaxBytesKb)
    expect(config.postImageMaxBytesKb).toBe(DEFAULT_CONFIG.postImageMaxBytesKb)
    expect(config.postImagesTotalMaxBytesKb).toBe(DEFAULT_CONFIG.postImagesTotalMaxBytesKb)
    expect(config.ollamaTemperature).toBe(DEFAULT_CONFIG.ollamaTemperature)
    expect(config.ollamaTopP).toBe(DEFAULT_CONFIG.ollamaTopP)
    expect(config.ollamaNumPredict).toBe(DEFAULT_CONFIG.ollamaNumPredict)
    expect(config.ollamaRepeatPenalty).toBe(DEFAULT_CONFIG.ollamaRepeatPenalty)
    expect(config.aiPostMaxChars).toBe(DEFAULT_CONFIG.aiPostMaxChars)
    expect(config.aiCommentMaxChars).toBe(DEFAULT_CONFIG.aiCommentMaxChars)
  })

  it("returns default config when request fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    globalThis.fetch = vi.fn(async () => {
      throw new Error("network down")
    })

    const config = await loadConfig()

    expect(config).toBe(DEFAULT_CONFIG)
    expect(warn).toHaveBeenCalled()
  })

  it("returns default config when response is not ok", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    globalThis.fetch = vi.fn(async () => mockResponse({ ok: false, status: 500 }))

    const config = await loadConfig()

    expect(config).toBe(DEFAULT_CONFIG)
    expect(warn).toHaveBeenCalled()
  })
})
