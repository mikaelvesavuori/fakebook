import { describe, expect, it } from "vitest"

import { buildReactorNamesLabel, initialsFromName } from "../src/view-helpers.js"

describe("view helpers", () => {
  describe("initialsFromName", () => {
    it("builds initials from first two words", () => {
      expect(initialsFromName("Stjarn Nova")).toBe("SN")
    })

    it("returns fallback for empty values", () => {
      expect(initialsFromName("")).toBe("?")
      expect(initialsFromName(null)).toBe("?")
    })
  })

  describe("buildReactorNamesLabel", () => {
    it("returns empty string when there are no names", () => {
      expect(buildReactorNamesLabel([])).toBe("")
      expect(buildReactorNamesLabel(null)).toBe("")
    })

    it("builds label with all names when under max", () => {
      expect(buildReactorNamesLabel(["A", "B", "C"])).toBe("A, B, C reacted to this")
    })

    it("adds overflow count when more than max visible names", () => {
      expect(buildReactorNamesLabel(["A", "B", "C", "D", "E"], 4)).toBe(
        "A, B, C, D +1 more reacted to this",
      )
    })
  })
})
