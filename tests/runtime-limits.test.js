import { describe, expect, it } from "vitest"

import { applyRuntimeLimitsFromConfig } from "../src/runtime-limits.js"

describe("applyRuntimeLimitsFromConfig", () => {
  it("applies configured KB values as bytes", () => {
    const limits = {
      profileImageMaxBytes: 1,
      postImageMaxBytes: 1,
      postImagesTotalMaxBytes: 1,
    }

    applyRuntimeLimitsFromConfig(
      {
        profileImageMaxBytesKb: 300,
        postImageMaxBytesKb: 900,
        postImagesTotalMaxBytesKb: 2500,
      },
      limits,
    )

    expect(limits.profileImageMaxBytes).toBe(300 * 1024)
    expect(limits.postImageMaxBytes).toBe(900 * 1024)
    expect(limits.postImagesTotalMaxBytes).toBe(2500 * 1024)
  })

  it("keeps fallback values when config values are invalid", () => {
    const limits = {
      profileImageMaxBytes: 111,
      postImageMaxBytes: 222,
      postImagesTotalMaxBytes: 333,
    }

    applyRuntimeLimitsFromConfig(
      {
        profileImageMaxBytesKb: "nope",
        postImageMaxBytesKb: null,
        postImagesTotalMaxBytesKb: -2,
      },
      limits,
    )

    expect(limits.profileImageMaxBytes).toBe(111)
    expect(limits.postImageMaxBytes).toBe(222)
    expect(limits.postImagesTotalMaxBytes).toBe(333)
  })

  it("enforces total bytes to be at least per-image max", () => {
    const limits = {
      profileImageMaxBytes: 0,
      postImageMaxBytes: 1000,
      postImagesTotalMaxBytes: 2000,
    }

    applyRuntimeLimitsFromConfig(
      {
        profileImageMaxBytesKb: 1,
        postImageMaxBytesKb: 900,
        postImagesTotalMaxBytesKb: 100,
      },
      limits,
    )

    expect(limits.postImageMaxBytes).toBe(900 * 1024)
    expect(limits.postImagesTotalMaxBytes).toBe(900 * 1024)
  })
})
