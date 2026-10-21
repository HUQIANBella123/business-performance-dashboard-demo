import JSZip from "jszip"

function officeText(xml: string): string {
  return xml
    .replace(/<a:p\b[^>]*>/g, "\n")
    .replace(/<w:p\b[^>]*>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim()
}

export function summarizeAction(text: string): string {
  const parts = text
    .split(/[\n。；;！？]/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 4)
  if (!parts.length) return ""
  const focused = parts.filter((item) =>
    /行动|完成|上线|投放|优化|推广|活动|续保|发布|调整|沟通|培训|物料|直播|合作|验车|成交/.test(item),
  )
  let sentence = (focused.length ? focused : parts).slice(0, 2).join("，")
  if (sentence.length > 90) sentence = `${sentence.slice(0, 88)}…`
  return `本月行动：${sentence}。`
}

function slideNumber(path: string): number {
  const match = path.match(/slide(\d+)\.xml$/)
  return match ? Number(match[1]) : 0
}

export async function actionLineFromOffice(
  buffer: ArrayBuffer,
  name: string,
): Promise<{ line: string; preview: string; warning?: string }> {
  const lower = name.toLowerCase()
  if (!lower.endsWith(".docx") && !lower.endsWith(".pptx")) {
    return { line: "", preview: "", warning: "本月行动只读取 .docx 和 .pptx" }
  }
  try {
    const zip = await JSZip.loadAsync(buffer)
    let text = ""
    if (lower.endsWith(".docx")) {
      const xml = await zip.file("word/document.xml")?.async("string")
      text = xml ? officeText(xml) : ""
    } else {
      const slides = Object.keys(zip.files)
        .filter((item) => /ppt\/slides\/slide\d+\.xml$/.test(item))
        .sort((a, b) => slideNumber(a) - slideNumber(b))
      const chunks: string[] = []
      for (const slide of slides) {
        const xml = await zip.file(slide)?.async("string")
        if (xml) chunks.push(officeText(xml))
      }
      text = chunks.join(" ")
    }
    const line = summarizeAction(text)
    return {
      line,
      preview: text.slice(0, 180) || "没有读到文字",
      warning: line ? undefined : `${name} 里没有读到可用的文字`,
    }
  } catch {
    return { line: "", preview: "", warning: `${name} 无法读取，请另存为 .docx 或 .pptx` }
  }
}
