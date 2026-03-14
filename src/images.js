import { ALLOWED_IMAGE_TYPES, LIMITS } from "./constants.js"

export function resizeDimensions(width, height, maxDimension = LIMITS.maxImageDimension) {
  const largest = Math.max(width, height)
  if (largest <= maxDimension) {
    return { width, height }
  }

  const ratio = maxDimension / largest
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  }
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error("Unable to decode image"))
    }
    image.src = objectUrl
  })
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Unable to process image"))
          return
        }
        resolve(blob)
      },
      mimeType,
      quality,
    )
  })
}

function formatKb(bytes) {
  return `${Math.round(bytes / 1024)} KB`
}

function estimateDataUrlBytes(dataUrl) {
  const commaIndex = dataUrl.indexOf(",")
  if (commaIndex === -1) {
    return dataUrl.length
  }

  const base64 = dataUrl.slice(commaIndex + 1)
  return Math.floor((base64.length * 3) / 4)
}

export function estimateImageBytes(image) {
  if (image instanceof Blob) {
    return image.size
  }

  if (typeof image === "string") {
    return image.startsWith("data:") ? estimateDataUrlBytes(image) : image.length
  }

  return 0
}

const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"]

function hasAllowedImageExtension(fileName) {
  const lower = fileName.toLowerCase()
  return ALLOWED_IMAGE_EXTENSIONS.some((extension) => lower.endsWith(extension))
}

function isHeicFile(file) {
  const type = (file.type || "").toLowerCase()
  if (type.includes("heic") || type.includes("heif")) {
    return true
  }
  return file.name ? /\.(heic|heif)$/i.test(file.name) : false
}

function isSupportedInputImage(file) {
  if (ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return true
  }

  if (file.type && file.type.startsWith("image/")) {
    return true
  }

  if (!file.type && file.name) {
    return hasAllowedImageExtension(file.name)
  }

  return false
}

function processingProfile(kind) {
  if (kind === "profile") {
    return {
      maxDimension: LIMITS.profileImageMaxDimension,
      quality: LIMITS.profileImageQuality,
      maxBytes: LIMITS.profileImageMaxBytes,
    }
  }

  return {
    maxDimension: LIMITS.postImageMaxDimension,
    quality: LIMITS.postImageQuality,
    maxBytes: LIMITS.postImageMaxBytes,
  }
}

async function compressImage(image, { maxDimension, quality, maxBytes }) {
  let { width, height } = resizeDimensions(image.naturalWidth, image.naturalHeight, maxDimension)
  let currentQuality = quality

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d")
    if (!context) {
      throw new Error("Unable to process image")
    }

    context.drawImage(image, 0, 0, width, height)
    const blob = await canvasToBlob(canvas, "image/webp", currentQuality).catch(() =>
      canvasToBlob(canvas, "image/jpeg", currentQuality),
    )

    if (blob.size <= maxBytes) {
      return blob
    }

    if (currentQuality > 0.46) {
      currentQuality = Math.max(0.46, currentQuality - 0.08)
      continue
    }

    const longest = Math.max(width, height)
    if (longest <= 320) {
      break
    }

    width = Math.max(320, Math.round(width * 0.86))
    height = Math.max(320, Math.round(height * 0.86))
  }

  throw new Error(`Image is too large after compression. Keep it under ${formatKb(maxBytes)}.`)
}

export async function processImageFile(file, { kind = "post" } = {}) {
  if (!isSupportedInputImage(file)) {
    throw new Error("Unsupported image type. Use a standard image format.")
  }

  let image
  try {
    image = await loadImageFromFile(file)
  } catch (error) {
    if (isHeicFile(file)) {
      throw new Error(
        "This HEIC/HEIF photo could not be decoded here. Try a different photo or set iPhone Camera format to Most Compatible (JPEG).",
      )
    }
    throw error
  }
  return compressImage(image, processingProfile(kind))
}

export async function processImageFiles(files, maxCount, { existingImages = [] } = {}) {
  const processed = []
  let currentTotalBytes = existingImages.reduce(
    (total, image) => total + estimateImageBytes(image),
    0,
  )

  for (const file of files) {
    if (processed.length >= maxCount) {
      break
    }

    const next = await processImageFile(file, { kind: "post" })
    if (currentTotalBytes + next.size > LIMITS.postImagesTotalMaxBytes) {
      throw new Error(
        `Total post images are too large. Keep the post under ${formatKb(LIMITS.postImagesTotalMaxBytes)}.`,
      )
    }

    processed.push(next)
    currentTotalBytes += next.size
  }

  return processed
}
