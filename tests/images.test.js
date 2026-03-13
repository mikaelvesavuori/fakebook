import { describe, expect, it } from "vitest"

import { resizeDimensions } from "../src/images.js"

describe("resizeDimensions", () => {
  it("keeps size when under max", () => {
    expect(resizeDimensions(400, 300, 1200)).toEqual({ width: 400, height: 300 })
  })

  it("scales down larger images", () => {
    expect(resizeDimensions(2400, 1200, 1200)).toEqual({ width: 1200, height: 600 })
  })
})
