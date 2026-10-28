import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { buildCases, coverageFromAmounts, coverageFromText, renewalFromCases } from "./cases"
import { buildView } from "./view"
import { parseListBuffer, type RawRow } from "./parseList"
import { parseSalesReport } from "./parseSalesReport"
import { parseSocial } from "./parseSocial"
import { parseSupplement } from "./parseSupplement"
import { DEFAULT_RULES } from "./rules"

const sales = readFileSync("public/samples/ctia-sales-report.xlsx")
const supplement = readFileSync("public/samples/ctia-bpr-supplement.xlsx")
const social = readFileSync("public/samples/ctia-social-monthly.xlsx")

function bufferOf(file: Buffer): ArrayBuffer {
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer
}

describe("sales report", () => {
  const parsed = parseSalesReport(bufferOf(sales))
  const feb = parsed.months["2026-02"]
  const mar = parsed.months["2026-03"]

  it("reads February operating figures", () => {
    expect(feb.motor).toBe(460)
    expect(feb.inquiries).toBe(237)
    expect(feb.nbApplication).toBe(64)
    expect(feb.nbApplicationByInsurer["太平"]).toBe(14)
    expect(feb.nbApplicationByInsurer["人保"]).toBe(50)
    expect(feb.rnApplication).toBe(27)
    expect(feb.rnApplicationByInsurer["太平"]).toBe(10)
    expect(feb.nbSales).toBe(60)
    expect(feb.rnSales).toBe(31)
    expect(feb.onlineNb).toBe(14)
    expect(feb.offlineNb).toBe(46)
    expect(feb.nbCountByInsurer["太平"]).toBe(12)
    expect(feb.nbCountByInsurer["人保"]).toBe(48)
    expect(feb.premiumNb).toBe(119116)
    expect(feb.rnCountAnomaly).toBe(false)
    expect(feb.rnCountByInsurer["太平"]).toBe(8)
    expect(feb.rnCountByInsurer["人保"]).toBe(23)
    expect(feb.plans.find((item) => item.scope === "整体" && item.label.includes("300万") && item.label.includes("1万"))?.count).toBe(13)
    expect(feb.plans.filter((item) => item.scope === "太平").reduce((sum, item) => sum + item.count, 0)).toBe(13)
  })

  it("ignores formula zeros in months that have not been closed", () => {
    expect(parsed.months["2026-07"].nbSales).toBe(87)
    expect(parsed.months["2026-07"].workingDays).toBe(23)
    expect(parsed.months["2026-09"].nbSales).toBeNull()
    expect(parsed.months["2026-09"].motor).toBeNull()
    expect(parsed.months["2026-09"].oneStopDue).toBe(76)
    expect(parsed.months["2026-09"].oneStopRenewed).toBe(1)
    expect(parsed.months["2026-09"].oneStopOpen).toBe(75)
    expect(parsed.months["2026-03"].nbSales).toBe(88)
    expect(parsed.months["2026-03"].rnCountAnomaly).toBe(false)
  })

  it("reads March renewal counts from the insurer rows", () => {
    expect(mar.nbApplication).toBe(100)
    expect(mar.nbSales).toBe(88)
    expect(mar.nbApplicationByInsurer["太平"]).toBe(31)
    expect(mar.rnSales).toBe(67)
    expect(mar.rnCountByInsurer["太平"]).toBe(10)
    expect(mar.rnCountByInsurer["人保"]).toBe(57)
    expect(mar.premiumRn).toBeGreaterThan(0)
    expect(mar.rnCountAnomaly).toBe(false)
  })

  it("keeps February channel slices for both insurers", () => {
    const taipingOnline = feb.productGroups.find(
      (item) => item.insurer === "太平" && item.product === "等效先认" && item.group === "online",
    )
    expect(taipingOnline?.count).toBe(12)
    const piccOffline = feb.productGroups.find(
      (item) => item.insurer === "人保" && item.product === "一站式" && item.group === "offline",
    )
    expect(piccOffline?.count).toBe(43)
  })
})

describe("supplement and social", () => {
  it("reads motor, renewal base and SEM", () => {
    const parsed = parseSupplement(bufferOf(supplement))
    expect(parsed.months["2026-02"].motor).toBe(460)
    expect(parsed.months["2026-02"].due_onestop).toBe(91)
    expect(parsed.months["2026-02"].renewed_onestop).toBe(47)
    expect(parsed.months["2026-02"].sem_cost).toBe(3475)
    expect(parsed.months["2026-02"].fb_clicks).toBe(296)
    expect(parsed.months["2026-09"].motor).toBeUndefined()
  })

  it("reads Xiaohongshu and WeChat blocks", () => {
    const parsed = parseSocial(bufferOf(social))
    const official = parsed.blocks.find((block) => block.title.includes("官方"))
    const wechat = parsed.blocks.find((block) => block.title.includes("微信"))
    expect(official?.series["发送篇数"]["2026-02"]).toBe(2)
    expect(wechat?.series["发送篇数"]["2026-02"]).toBe(2)
    expect(wechat?.series["阅读量"]["2026-02"]).toBe(775)
  })
})

function row(partial: Partial<RawRow>): RawRow {
  return {
    slot: "nb_picc",
    sourceFile: "t",
    plate: "AB1234",
    insurer: "人保",
    serial: "S",
    orderId: "O",
    product: "一站式",
    packageName: "一般計劃",
    coverageText: "交强险，商业险¥150万，座位¥3万",
    jqLimit: 200000,
    syLimit: 1500000,
    zwLimit: 30000,
    effectiveMonth: "2026-03",
    jqPremiumCny: 700,
    syPremiumCny: 1000,
    totalCny: 1700,
    totalHkd: 1873,
    status: "已申请",
    month: "2026-03",
    createdAt: "2026-03-02T00:00:00.000Z",
    channel: "天水围",
    entry: "首页",
    device: "PC_WEB",
    biz: "nb",
    ...partial,
  }
}

describe("case counting", () => {
  it("counts one journey when payment and upload share a plate", () => {
    const built = buildCases(
      [
        row({ status: "支付成功", orderId: "1", totalHkd: 1800, createdAt: "2026-03-02T00:00:00.000Z" }),
        row({ status: "已上传证明", orderId: "2", totalHkd: 1800, createdAt: "2026-03-03T00:00:00.000Z" }),
        row({ status: "已申请", orderId: "3", plate: "CD5678" }),
      ],
      DEFAULT_RULES,
    )
    expect(built.cases).toHaveLength(2)
    expect(built.cases.filter((item) => item.isDeal)).toHaveLength(1)
    expect(built.cases.find((item) => item.isDeal)?.status).toBe("支付成功")
    expect(built.cases.find((item) => item.isDeal)?.hkd).toBe(1800)
  })

  it("counts two payments and collapses two uploads", () => {
    const twoPays = buildCases(
      [
        row({ status: "支付成功", orderId: "1", plate: "AA1", totalHkd: 100 }),
        row({ status: "支付成功", orderId: "2", plate: "AA1", totalHkd: 200, createdAt: "2026-03-04T00:00:00.000Z" }),
      ],
      DEFAULT_RULES,
    )
    expect(twoPays.cases.filter((item) => item.isDeal)).toHaveLength(2)
    expect(twoPays.cases.reduce((sum, item) => sum + item.hkd, 0)).toBe(300)

    const twoUploads = buildCases(
      [
        row({ status: "已上传证明", orderId: "1", plate: "BB1", totalHkd: 100, createdAt: "2026-03-01T00:00:00.000Z" }),
        row({ status: "已上传证明", orderId: "2", plate: "BB1", totalHkd: 100, createdAt: "2026-03-08T00:00:00.000Z" }),
      ],
      DEFAULT_RULES,
    )
    expect(twoUploads.cases).toHaveLength(1)
    expect(twoUploads.cases[0].isDeal).toBe(true)
  })

  it("treats blank commercial premium as zero and flags coverage text mismatches", () => {
    expect(coverageFromAmounts(0, 0).label).toBe("交强险")
    expect(coverageFromText("交强险，商业险¥200万，座位¥5万")?.key).toBe(coverageFromAmounts(2000000, 50000).key)
    const built = buildCases(
      [
        row({
          biz: "rn",
          insurer: "太平",
          product: "一站式",
          status: "支付成功",
          coverageText: "交强险，商业险¥200万，座位¥5万",
          syLimit: 1500000,
          zwLimit: 30000,
          syPremiumCny: null,
          jqPremiumCny: 950,
          totalCny: null,
          totalHkd: 1054.5,
          channel: "官网",
        }),
      ],
      DEFAULT_RULES,
    )
    expect(built.mismatchCount).toBe(1)
    expect(built.cases[0].cny).toBe(950)
    expect(built.cases[0].channelGroup).toBe("online")
    expect(built.cases[0].commission).toBeCloseTo(1054.5 * DEFAULT_RULES.taipingRate, 4)
  })

  it("uses the demo rates for PICC equivalent plans", () => {
    const built = buildCases(
      [
        row({
          product: "等效先认",
          status: "支付成功",
          channel: "官网",
          totalCny: 1000,
          totalHkd: 1100,
          plate: "ON1",
        }),
        row({
          product: "等效先认",
          status: "支付成功",
          channel: "天水围",
          totalCny: 1000,
          totalHkd: 1100,
          plate: "OFF1",
        }),
      ],
      DEFAULT_RULES,
    )
    const online = built.cases.find((item) => item.plate === "ON1")
    const offline = built.cases.find((item) => item.plate === "OFF1")
    expect(online?.commission).toBeCloseTo(1100 * DEFAULT_RULES.equivalentOnlineRate, 4)
    expect(offline?.commission).toBeCloseTo(1100 * DEFAULT_RULES.equivalentOfflineRate, 4)
    expect(online?.commissionAssumed).toBe(false)
    expect(offline?.commissionAssumed).toBe(false)
  })

  it("moves 新田 online from November 2025", () => {
    const built = buildCases(
      [
        row({ channel: "新田", month: "2025-10", status: "支付成功", plate: "OLD", createdAt: "2025-10-02T00:00:00.000Z" }),
        row({ channel: "新田", month: "2025-11", status: "支付成功", plate: "NEW", createdAt: "2025-11-02T00:00:00.000Z" }),
      ],
      DEFAULT_RULES,
    )
    expect(built.cases.find((item) => item.plate === "OLD")?.channelGroup).toBe("offline")
    expect(built.cases.find((item) => item.plate === "NEW")?.channelGroup).toBe("online")
  })

  it("builds next-year renewal cohorts from effective dates", () => {
    const cases = buildCases(
      [
        row({
          biz: "nb",
          plate: "KEEP",
          status: "支付成功",
          product: "一站式",
          effectiveMonth: "2025-05",
          month: "2025-04",
          createdAt: "2025-04-02T00:00:00.000Z",
        }),
        row({
          biz: "nb",
          plate: "LOST",
          status: "支付成功",
          product: "一站式",
          effectiveMonth: "2025-05",
          month: "2025-04",
          createdAt: "2025-04-03T00:00:00.000Z",
        }),
        row({
          biz: "rn",
          slot: "rn_picc",
          plate: "KEEP",
          status: "支付成功",
          product: "一站式",
          effectiveMonth: "2026-05",
          month: "2026-04",
          createdAt: "2026-04-02T00:00:00.000Z",
        }),
      ],
      DEFAULT_RULES,
    ).cases
    const cohort = renewalFromCases(cases, "2026-05")
    expect(cohort.find((item) => item.product === "一站式")).toMatchObject({ due: 2, renewed: 1, open: 1 })
    expect(cohort.find((item) => item.product === "等效先认")?.due).toBe(0)
  })

  it("counts one due plate when the same vehicle pays twice", () => {
    const cases = buildCases(
      [
        row({
          plate: "AA1",
          status: "支付成功",
          effectiveMonth: "2025-05",
          month: "2025-05",
          createdAt: "2025-05-02T00:00:00.000Z",
          orderId: "1",
        }),
        row({
          plate: "AA1",
          status: "支付成功",
          effectiveMonth: "2025-05",
          month: "2025-05",
          createdAt: "2025-05-18T00:00:00.000Z",
          orderId: "2",
        }),
      ],
      DEFAULT_RULES,
    ).cases
    expect(renewalFromCases(cases, "2026-05").find((item) => item.product === "一站式")).toMatchObject({
      due: 1,
      renewed: 0,
      open: 1,
    })
  })

  it("treats a later inception as renewed in the original product, then shifts next year", () => {
    const cases = buildCases(
      [
        row({
          biz: "nb",
          plate: "SHIFT",
          status: "支付成功",
          product: "一站式",
          insurer: "人保",
          effectiveMonth: "2025-05",
          month: "2025-04",
          createdAt: "2025-04-02T00:00:00.000Z",
        }),
        row({
          biz: "rn",
          slot: "rn_taiping",
          plate: "shift",
          status: "已上传证明",
          product: "等效先认",
          insurer: "太平",
          effectiveMonth: "2026-06",
          month: "2026-05",
          createdAt: "2026-05-02T00:00:00.000Z",
        }),
      ],
      DEFAULT_RULES,
    ).cases
    const may = renewalFromCases(cases, "2026-05")
    expect(may.find((item) => item.product === "一站式")).toMatchObject({ due: 1, renewed: 1, open: 0 })
    expect(may.find((item) => item.product === "等效先认")).toMatchObject({ due: 0, renewed: 0 })
    expect(renewalFromCases(cases, "2027-06").find((item) => item.product === "等效先认")).toMatchObject({
      due: 1,
      renewed: 0,
    })
  })
})

function card(view: ReturnType<typeof buildView>, id: string) {
  return view.sections.flatMap((section) => section.items).find((item) => item.id === id)
}

describe("dashboard view", () => {
  it("uses the sales report and supplement for February 2026", () => {
    const report = parseSalesReport(bufferOf(sales))
    const extra = parseSupplement(bufferOf(supplement))
    const view = buildView(
      { rows: [], report: report.months, supplement: extra.months, social: [], files: [], warnings: [] },
      DEFAULT_RULES,
      "2026-02",
    )
    expect(card(view, "deals")?.value).toBe(91)
    expect(card(view, "apps")?.value).toBe(91)
    expect(card(view, "motor")?.source).toBe("补充表")
    expect(card(view, "hkd")?.value).toBe(198610)
    expect(card(view, "nbOnline")?.value).toBe(14)
    expect(card(view, "nbOffline")?.value).toBe(46)
    expect(view.sections.map((section) => section.title)).toEqual(["整体", "新增", "续保"])
  })

  it("opens the latest month that already has sales", () => {
    const report = parseSalesReport(bufferOf(sales))
    const extra = parseSupplement(bufferOf(supplement))
    const view = buildView(
      { rows: [], report: report.months, supplement: extra.months, social: [], files: [], warnings: [] },
      DEFAULT_RULES,
      null,
    )
    expect(view.month).toBe("2026-07")
    expect(card(view, "deals")?.value).toBe(134)
    expect(card(view, "sa")?.value).toBeCloseTo(87 / 101, 4)
    expect(card(view, "sm")?.value).not.toBeNull()
    expect(card(view, "rnsa")?.value).not.toBeNull()
    expect(card(view, "commission")?.value).toBeGreaterThan(0)
    expect(card(view, "nbCommission")?.value).toBeGreaterThan(0)
    expect(card(view, "rnCommission")?.value).toBeGreaterThan(0)
    expect(card(view, "rn")?.value).toBe(47)
    expect(card(view, "nbDaily")?.value).toBeCloseTo(87 / 31, 4)
    expect(card(view, "rnDaily")?.value).toBeCloseTo(47 / 31, 4)
    expect(card(view, "rnHkd")?.value).toBeGreaterThan(0)
    expect(report.months["2026-07"].oneStopDue).toBe(80)
    expect(report.months["2026-07"].oneStopRenewed).toBe(39)
    expect(report.months["2026-07"].oneStopOpen).toBe(41)
    expect(report.months["2026-07"].oneStopRate).toBeCloseTo(0.4875, 4)
    expect(card(view, "m0-due")?.label).toBe("本月应续保量")
    expect(card(view, "m0-due")?.value).toBe(80)
    expect(card(view, "m0-renewed")?.value).toBe(39)
    expect(card(view, "m0-open")?.value).toBe(41)
    expect(view.renewal.rows.find((row) => row.month === "2026-07" && row.product === "一站式")).toMatchObject({
      due: 80,
      renewed: 39,
      open: 41,
      rate: 0.4875,
      source: "销售报表",
    })
    expect(view.narratives.renewal).toContain("一站式应续保 80，已续保 39，未续保 41，续保率 48.8%")
    expect(card(view, "m1-due")?.label).toBe("26年8月应续保量")
    expect(card(view, "m1-due")?.value).toBe(84)
    expect(card(view, "m2-open")?.label).toBe("26年9月应续保未续保量")
    expect(card(view, "m2-open")?.value).toBe(75)
    expect(view.renewal.hasLists).toBe(false)
    expect(view.renewal.rows.find((row) => row.month === "2026-09" && row.product === "一站式")).toMatchObject({
      due: 76,
      renewed: 1,
      open: 75,
      mark: "随后",
    })
    expect(view.renewal.rows.find((row) => row.month === "2026-07" && row.product === "等效先认")?.due).toBe(0)
    expect(view.renewal.rows.find((row) => row.month === "2026-07" && row.product === "等效先认")?.source).toBe("表内未单列，记 0")
    expect(view.narratives.renewal).toContain("等效先认应续保 0，已续保 0，未续保 0")
    expect(view.narratives.renewal).not.toContain("1 月底")
    expect(view.narratives.channels).not.toContain("整体仍然是线下贡献更多成交")
    expect(view.plans.fromLists).toBe(false)
    expect(view.plans.sections.some((section) => section.scope === "新增")).toBe(false)
    expect(view.plans.sections.find((section) => section.scope === "整体")?.rows.some((row) => row.value > 0)).toBe(true)
    expect(view.narratives.overview).toContain("7月")
    expect(view.narratives.standout.length).toBeGreaterThan(8)
    expect(view.media[0].metrics.some((metric) => metric.label === "曝光")).toBe(true)
    expect(view.media[0].metrics.some((metric) => metric.label === "每次点击成本（CPC）")).toBe(true)
  })
})

describe("list parser", () => {
  it("rejects a workbook that is not a policy list", () => {
    const parsed = parseListBuffer(bufferOf(supplement), "nb_picc", "nb", "supplement.xlsx")
    expect(parsed.rows).toHaveLength(0)
    expect(parsed.warnings[0]).toContain("不是申请/续保名单")
  })
})
