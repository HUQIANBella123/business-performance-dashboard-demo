import { describe, expect, it } from "vitest"
import {
  channelNarrative,
  overviewNarrative,
  renewalNarrative,
  resolveSummary,
  standoutLine,
  type NarrativeInput,
} from "./narrative"

function input(patch: Partial<NarrativeInput> = {}): NarrativeInput {
  const base = {
    motor: null,
    inquiries: null,
    deals: null,
    nbDeals: null,
    rnDeals: null,
    nbApps: null,
    rnApps: null,
    hkd: null,
    nbHkd: null,
    rnHkd: null,
    commission: null,
    online: null,
    offline: null,
    taiping: null,
    picc: null,
    semCost: null,
    fbCost: null,
    semClicks: null,
    fbClicks: null,
  }
  return {
    month: "2026-07",
    ...base,
    prev: { ...base },
    yoy: { ...base },
    topChannel: null,
    topPlan: null,
    planCount: null,
    renewalDue: null,
    renewalRenewed: null,
    renewalOpen: null,
    equivalentDue: null,
    equivalentRenewed: null,
    equivalentOpen: null,
    nextRenewal: null,
    socialHeadline: null,
    ...patch,
  }
}

describe("narratives follow the loaded numbers", () => {
  it("writes overview, channel, and renewal from the current month", () => {
    const current = input({
      motor: 11,
      inquiries: 22,
      deals: 33,
      nbDeals: 21,
      rnDeals: 12,
      nbApps: 30,
      hkd: 4400,
      nbHkd: 2500,
      rnHkd: 1900,
      commission: 800,
      online: 40,
      offline: 15,
      prev: { ...input().prev, online: 10, offline: 20, deals: 33, hkd: 4400 },
      topChannel: "测试渠道",
      renewalDue: 141,
      renewalRenewed: 90,
      renewalOpen: 51,
      equivalentDue: 7,
      equivalentRenewed: 2,
      equivalentOpen: 5,
      nextRenewal: "26年8月应续保 4、已续保 1、未续保 3",
    })
    const overview = overviewNarrative(current)
    expect(overview).toContain("验车 11")
    expect(overview).toContain("成交 33")
    expect(overview).toContain("线上 40")
    expect(overview).not.toContain("623")

    const channels = channelNarrative(current)
    expect(channels).toContain("线上成交 40")
    expect(channels).toContain("线下成交 15")
    expect(channels).toContain("线上成交多于线下")
    expect(channels).toContain("测试渠道")
    expect(channels).not.toContain("整体仍然是线下贡献更多成交")

    const renewal = renewalNarrative(current)
    expect(renewal).toContain("一站式应续保 141，已续保 90，未续保 51")
    expect(renewal).toContain("等效先认应续保 7，已续保 2，未续保 5，续保率 28.6%")
    expect(renewal).toContain("26年8月应续保 4")
    expect(renewal).not.toContain("1 月底")
    expect(renewal).not.toContain("2026 年各月应续保为 0")
  })

  it("does not call a mixed move a straight rise", () => {
    const text = standoutLine(
      input({
        online: 50,
        deals: 10,
        prev: { ...input().prev, online: 10, deals: 40 },
      }),
    )
    expect(text).toContain("涨跌都有")
    expect(text).not.toContain("这几项走强")
  })
})

describe("saved summaries", () => {
  it("drops a note written against an older dataset", () => {
    const generated = "26年7月成交 244。"
    expect(resolveSummary("26年7月成交 623。", generated)).toBe(generated)
    expect(resolveSummary(JSON.stringify({ text: "手工补充。", base: "26年7月成交 623。" }), generated)).toBe(generated)
  })

  it("keeps a note the user edited for the current numbers", () => {
    const generated = "26年7月成交 244。"
    expect(resolveSummary(JSON.stringify({ text: "244 单，重点看续保。", base: generated }), generated)).toBe("244 单，重点看续保。")
  })
})
