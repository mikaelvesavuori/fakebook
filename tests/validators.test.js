import { describe, expect, it } from "vitest"

import { validateCommentInput, validatePostInput, validateProfile } from "../src/validators.js"

describe("validateProfile", () => {
  it("accepts valid profile", () => {
    const result = validateProfile({
      name: "Alex",
      location: "Stockholm",
      description: "Developer",
    })

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
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
})
