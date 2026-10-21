import { describe, expect, it } from "vitest"
import { DEFAULT_RULES, sanitizeRules } from "./rules"

describe("sanitizeRules", () => {
  it("drops null and non-numeric commission rates", () => {
    const rules = sanitizeRules({ taipingRate: null, oneStopRate: Number.NaN, equivalentOnlineRate: "20" })
    expect(rules.taipingRate).toBe(DEFAULT_RULES.taipingRate)
    expect(rules.oneStopRate).toBe(DEFAULT_RULES.oneStopRate)
    expect(rules.equivalentOnlineRate).toBe(DEFAULT_RULES.equivalentOnlineRate)
    expect(rules.equivalentOfflineRate).toBe(DEFAULT_RULES.equivalentOfflineRate)
  })

  it("keeps a finite rate", () => {
    expect(sanitizeRules({ taipingRate: 0.2 }).taipingRate).toBe(0.2)
  })
})
