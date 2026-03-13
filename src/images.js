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

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error ?? new Error("Failed reading file"))
    reader.readAsDataURL(file)
  })
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Unable to decode image"))
    image.src = dataUrl
  })
}

export async function processImageFile(file) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error("Unsupported image type. Use JPEG, PNG, or WebP.")
  }

  const sourceUrl = await readAsDataURL(file)
  const image = await loadImage(sourceUrl)
  const nextSize = resizeDimensions(image.naturalWidth, image.naturalHeight)

  const canvas = document.createElement("canvas")
  canvas.width = nextSize.width
  canvas.height = nextSize.height
  const context = canvas.getContext("2d")
  if (!context) {
    throw new Error("Unable to process image")
  }

  context.drawImage(image, 0, 0, nextSize.width, nextSize.height)

  return canvas.toDataURL("image/jpeg", LIMITS.imageQuality)
}

export async function processImageFiles(files, maxCount) {
  const processed = []

  for (const file of files) {
    if (processed.length >= maxCount) {
      break
    }

    processed.push(await processImageFile(file))
  }

  return processed
}
