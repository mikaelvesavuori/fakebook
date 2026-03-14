import { describe, expect, it, vi } from "vitest"

import { clamp, escapeHtml, formatDate, generateEntityId, generateShortId } from "../src/utils.js"

describe("utils", () => {
  it("escapeHtml encodes the most common unsafe characters", () => {
    expect(escapeHtml(`<script a='1' b="2">&`)).toBe(
      "&lt;script a=&#039;1&#039; b=&quot;2&quot;&gt;&amp;",
    )
  })

  it("formatDate returns a non-empty localized string", () => {
    const value = formatDate("2026-03-14T10:20:00.000Z")
    expect(typeof value).toBe("string")
    expect(value.length).toBeGreaterThan(0)
  })

  it("generateShortId returns six chars from allowed alphabet", () => {
    const id = generateShortId()
    expect(id).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/)
  })

  it("generateEntityId includes prefix and random suffix", () => {
    vi.spyOn(Date, "now").mockReturnValue(123456)
    vi.spyOn(Math, "random").mockReturnValue(0.123456789)

    expect(generateEntityId("post")).toBe("post_123456_4fzzzxjy")
  })

  it("clamp clamps values to min/max", () => {
    expect(clamp(5, 1, 10)).toBe(5)
    expect(clamp(-3, 1, 10)).toBe(1)
    expect(clamp(40, 1, 10)).toBe(10)
  })
})
