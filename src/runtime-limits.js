import { LIMITS } from "./constants.js"

export function applyRuntimeLimitsFromConfig(config, limits = LIMITS) {
  const toBytes = (value, fallback) => {
    const kb = Number(value)
    if (Number.isFinite(kb) && kb > 0) {
      return Math.round(kb * 1024)
    }
    return fallback
  }

  limits.profileImageMaxBytes = toBytes(config.profileImageMaxBytesKb, limits.profileImageMaxBytes)
  limits.postImageMaxBytes = toBytes(config.postImageMaxBytesKb, limits.postImageMaxBytes)
  limits.postImagesTotalMaxBytes = toBytes(
    config.postImagesTotalMaxBytesKb,
    limits.postImagesTotalMaxBytes,
  )

  if (limits.postImagesTotalMaxBytes < limits.postImageMaxBytes) {
    limits.postImagesTotalMaxBytes = limits.postImageMaxBytes
  }
}
