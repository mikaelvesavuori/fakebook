import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { LIMITS } from "../src/constants.js"
import { estimateImageBytes, processImageFile, processImageFiles, resizeDimensions } from "../src/images.js"

describe("resizeDimensions", () => {
  it("keeps size when under max", () => {
    expect(resizeDimensions(400, 300, 1200)).toEqual({ width: 400, height: 300 })
  })

  it("scales down larger images", () => {
    expect(resizeDimensions(2400, 1200, 1200)).toEqual({ width: 1200, height: 600 })
  })
})

describe("estimateImageBytes", () => {
  it("returns blob size", () => {
    const blob = new Blob(["12345"], { type: "text/plain" })
    expect(estimateImageBytes(blob)).toBe(5)
  })

  it("estimates data URL byte length", () => {
    expect(estimateImageBytes("data:image/png;base64,QUJDRA==")).toBe(6)
  })

  it("returns string length for non-data url strings", () => {
    expect(estimateImageBytes("abcdef")).toBe(6)
  })
})

describe("processImageFile / processImageFiles", () => {
  const originalImage = globalThis.Image
  const originalDocument = globalThis.document
  const originalCreateObjectURL = globalThis.URL.createObjectURL
  const originalRevokeObjectURL = globalThis.URL.revokeObjectURL

  const originalPostImageMaxBytes = LIMITS.postImageMaxBytes
  const originalPostImagesTotalMaxBytes = LIMITS.postImagesTotalMaxBytes
  const originalPostImageMaxDimension = LIMITS.postImageMaxDimension
  const originalPostImageQuality = LIMITS.postImageQuality

  function installImageMocks({
    decodeError = false,
    blobSize = 64 * 1024,
    failWebpOnce = false,
  } = {}) {
    let webpFailed = false

    globalThis.URL.createObjectURL = vi.fn(() => "blob:test-image")
    globalThis.URL.revokeObjectURL = vi.fn()

    class MockImage {
      constructor() {
        this.naturalWidth = 1600
        this.naturalHeight = 900
        this.onload = null
        this.onerror = null
      }

      set src(_value) {
        queueMicrotask(() => {
          if (decodeError) {
            this.onerror?.(new Error("decode failed"))
            return
          }
          this.onload?.()
        })
      }
    }

    globalThis.Image = MockImage

    globalThis.document = {
      createElement: vi.fn((tag) => {
        if (tag !== "canvas") {
          throw new Error(`unexpected tag: ${tag}`)
        }

        return {
          width: 0,
          height: 0,
          getContext: vi.fn(() => ({
            drawImage: vi.fn(),
          })),
          toBlob: vi.fn((cb, mimeType) => {
            if (failWebpOnce && mimeType === "image/webp" && !webpFailed) {
              webpFailed = true
              cb(null)
              return
            }
            cb(new Blob([new Uint8Array(blobSize)], { type: mimeType }))
          }),
        }
      }),
    }
  }

  beforeEach(() => {
    LIMITS.postImageMaxBytes = originalPostImageMaxBytes
    LIMITS.postImagesTotalMaxBytes = originalPostImagesTotalMaxBytes
    LIMITS.postImageMaxDimension = originalPostImageMaxDimension
    LIMITS.postImageQuality = originalPostImageQuality
  })

  afterEach(() => {
    globalThis.Image = originalImage
    globalThis.document = originalDocument
    globalThis.URL.createObjectURL = originalCreateObjectURL
    globalThis.URL.revokeObjectURL = originalRevokeObjectURL
    vi.restoreAllMocks()
  })

  it("rejects unsupported file types", async () => {
    await expect(
      processImageFile({ type: "application/pdf", name: "x.pdf" }, { kind: "post" }),
    ).rejects.toThrow(/Unsupported image type/i)
  })

  it("returns HEIC-specific decode error when heic file fails to decode", async () => {
    installImageMocks({ decodeError: true })

    await expect(
      processImageFile({ type: "image/heic", name: "fresh.heic" }, { kind: "post" }),
    ).rejects.toThrow(/HEIC\/HEIF/i)
  })

  it("falls back to JPEG when WebP blob encoding fails", async () => {
    installImageMocks({ failWebpOnce: true, blobSize: 80 * 1024 })

    const result = await processImageFile({ type: "image/jpeg", name: "photo.jpg" }, { kind: "post" })

    expect(result).toBeInstanceOf(Blob)
    expect(result.type).toBe("image/jpeg")
  })

  it("accepts camera files where mime type is missing but extension is valid", async () => {
    installImageMocks({ blobSize: 70 * 1024 })

    const result = await processImageFile({ type: "", name: "camera.HEIF" }, { kind: "post" })

    expect(result).toBeInstanceOf(Blob)
  })

  it("limits the number of processed files to maxCount", async () => {
    installImageMocks({ blobSize: 50 * 1024 })

    const files = [
      { type: "image/jpeg", name: "1.jpg" },
      { type: "image/jpeg", name: "2.jpg" },
      { type: "image/jpeg", name: "3.jpg" },
    ]

    const result = await processImageFiles(files, 2)

    expect(result).toHaveLength(2)
  })

  it("throws when total post image bytes would exceed limit", async () => {
    installImageMocks({ blobSize: 120 * 1024 })
    LIMITS.postImagesTotalMaxBytes = 150 * 1024

    await expect(
      processImageFiles([{ type: "image/jpeg", name: "post.jpg" }], 1, {
        existingImages: [new Blob([new Uint8Array(40 * 1024)], { type: "image/jpeg" })],
      }),
    ).rejects.toThrow(/Total post images are too large/i)
  })
})
