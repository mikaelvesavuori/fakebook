import { LIMITS } from "./constants.js"

export function validateProfile(input) {
  const errors = []
  const name = input.name.trim()
  const location = input.location.trim()
  const description = input.description.trim()
  const isBot = Boolean(input.isBot)

  if (name.length < LIMITS.profileNameMin || name.length > LIMITS.profileNameMax) {
    errors.push(`Name must be ${LIMITS.profileNameMin}-${LIMITS.profileNameMax} characters.`)
  }

  if (location.length > LIMITS.locationMax) {
    errors.push(`Location can be at most ${LIMITS.locationMax} characters.`)
  }

  if (description.length > LIMITS.descriptionMax) {
    errors.push(`Description can be at most ${LIMITS.descriptionMax} characters.`)
  }

  return {
    valid: errors.length === 0,
    errors,
    value: {
      name,
      location,
      description,
      isBot,
      picture: input.picture ?? null,
    },
  }
}

export function validatePostInput(input) {
  const errors = []
  const text = input.text.trim()
  const images = input.images ?? []

  if (text.length > LIMITS.postTextMax) {
    errors.push(`Post text can be at most ${LIMITS.postTextMax} characters.`)
  }

  if (images.length > LIMITS.maxPostImages) {
    errors.push(`You can attach at most ${LIMITS.maxPostImages} images.`)
  }

  if (!text && images.length === 0) {
    errors.push("A post needs text or at least one image.")
  }

  return {
    valid: errors.length === 0,
    errors,
    value: {
      text,
      images,
    },
  }
}

export function validateCommentInput(input) {
  const errors = []
  const text = input.text.trim()

  if (!text) {
    errors.push("Comment cannot be empty.")
  }

  if (text.length > LIMITS.commentTextMax) {
    errors.push(`Comment can be at most ${LIMITS.commentTextMax} characters.`)
  }

  return {
    valid: errors.length === 0,
    errors,
    value: {
      text,
    },
  }
}
