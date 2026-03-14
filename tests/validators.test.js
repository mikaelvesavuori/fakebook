import { describe, expect, it } from "vitest"

import { LIMITS } from "../src/constants.js"
import { validateCommentInput, validatePostInput, validateProfile } from "../src/validators.js"

describe("validateProfile", () => {
  it("accepts valid profile", () => {
    const result = validateProfile({
      name: "Alex",
      location: "Stockholm",
      description: "Developer",
      isBot: true,
    })

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.value.isBot).toBe(true)
  })

  it("rejects empty name", () => {
    const result = validateProfile({
      name: "",
      location: "",
      description: "",
    })

    expect(result.valid).toBe(false)
    expect(result.errors[0]).toMatch(/Name/)
  })

  it("trims values and preserves picture", () => {
    const picture = new Blob(["x"], { type: "image/jpeg" })
    const result = validateProfile({
      name: "  Alex  ",
      location: "  Stockholm  ",
      description: "  Developer  ",
      isBot: false,
      picture,
    })

    expect(result.valid).toBe(true)
    expect(result.value).toEqual({
      name: "Alex",
      location: "Stockholm",
      description: "Developer",
      isBot: false,
      picture,
    })
  })

  it("rejects too long location and description", () => {
    const result = validateProfile({
      name: "Alex",
      location: "x".repeat(LIMITS.locationMax + 1),
      description: "y".repeat(LIMITS.descriptionMax + 1),
      isBot: false,
    })

    expect(result.valid).toBe(false)
    expect(result.errors.join(" ")).toMatch(/Location/)
    expect(result.errors.join(" ")).toMatch(/Description/)
  })
})

describe("validatePostInput", () => {
  it("requires text or image", () => {
    const result = validatePostInput({ text: "", images: [] })

    expect(result.valid).toBe(false)
    expect(result.errors[0]).toMatch(/text or at least one image/i)
  })

  it("accepts text-only post", () => {
    const result = validatePostInput({ text: "Hello", images: [] })

    expect(result.valid).toBe(true)
  })

  it("rejects too long text and too many images", () => {
    const result = validatePostInput({
      text: "x".repeat(LIMITS.postTextMax + 1),
      images: new Array(LIMITS.maxPostImages + 1).fill({}),
    })

    expect(result.valid).toBe(false)
    expect(result.errors.join(" ")).toMatch(/Post text/)
    expect(result.errors.join(" ")).toMatch(/attach at most/i)
  })

  it("trims post text in value", () => {
    const result = validatePostInput({ text: "  Hello world  ", images: [] })
    expect(result.value.text).toBe("Hello world")
  })
})

describe("validateCommentInput", () => {
  it("requires comment text", () => {
    const result = validateCommentInput({ text: "" })

    expect(result.valid).toBe(false)
    expect(result.errors[0]).toMatch(/cannot be empty/i)
  })

  it("accepts valid text", () => {
    const result = validateCommentInput({ text: "Nice one!" })

    expect(result.valid).toBe(true)
    expect(result.value.text).toBe("Nice one!")
  })

  it("rejects comments longer than max", () => {
    const result = validateCommentInput({ text: "x".repeat(LIMITS.commentTextMax + 1) })
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toMatch(/at most/i)
  })
})
