import type { Biz } from "./parseList"

export const SLOTS = [
  { id: "nb", label: "太平&人保新增", hint: "申请列表，按保司区分", kind: "list" as const, biz: "nb" as Biz, accept: ".xlsx,.xls" },
  { id: "rn", label: "太平&人保续保", hint: "续保列表，按保司区分", kind: "list" as const, biz: "rn" as Biz, accept: ".xlsx,.xls" },
  { id: "supplement", label: "其他数据补充", hint: "验车、咨询、投放", kind: "supplement" as const, accept: ".xlsx,.xls" },
  { id: "sales", label: "Sales Report", hint: "补历史月份", kind: "sales" as const, accept: ".xlsx,.xls" },
  { id: "social", label: "小红书及微信", hint: "内容月报", kind: "social" as const, accept: ".xlsx,.xls" },
  { id: "actions", label: "本月行动", hint: "Word 或 PowerPoint", kind: "actions" as const, accept: ".docx,.pptx" },
]
