
import dayjs from 'dayjs'

const USD_NO_CENTS = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const USD_WITH_CENTS = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export type FilingStatus = 'single'|'mfj'|'mfs'|'hoh'

export const STANDARD_DEDUCTION_2025: Record<FilingStatus, number> = {
  single: 15000,
  mfj: 30000,
  mfs: 15000,
  hoh: 22500,
}

export const BRACKETS_2025: Record<FilingStatus, {rate:number; upto:number|null}[]> = {
  single: [
    {rate: 0.10, upto: 11925},
    {rate: 0.12, upto: 48475},
    {rate: 0.22, upto: 103350},
    {rate: 0.24, upto: 197300},
    {rate: 0.32, upto: 250525},
    {rate: 0.35, upto: 626350},
    {rate: 0.37, upto: null},
  ],
  mfj: [
    {rate: 0.10, upto: 23850},
    {rate: 0.12, upto: 96950},
    {rate: 0.22, upto: 206700},
    {rate: 0.24, upto: 394600},
    {rate: 0.32, upto: 501050},
    {rate: 0.35, upto: 751600},
    {rate: 0.37, upto: null},
  ],
  mfs: [
    {rate: 0.10, upto: 11925},
    {rate: 0.12, upto: 48475},
    {rate: 0.22, upto: 103350},
    {rate: 0.24, upto: 197300},
    {rate: 0.32, upto: 250525},
    {rate: 0.35, upto: 375800},
    {rate: 0.37, upto: null},
  ],
  hoh: [
    {rate: 0.10, upto: 17075},
    {rate: 0.12, upto: 65550},
    {rate: 0.22, upto: 103350},
    {rate: 0.24, upto: 197300},
    {rate: 0.32, upto: 250525},
    {rate: 0.35, upto: 626350},
    {rate: 0.37, upto: null},
  ],
}

export const SSA_WAGE_BASE_2025 = 176_100
const OASDI_RATE = 0.124
const MEDICARE_RATE = 0.029
const ADDL_MEDICARE_RATE = 0.009

export const ADDL_MEDICARE_THRESHOLDS: Record<FilingStatus, number> = {
  single: 200_000,
  hoh: 200_000,
  mfs: 125_000,
  mfj: 250_000,
}

export function fmt(n:number){ return n.toLocaleString(undefined,{maximumFractionDigits:2}) }

export function federalIncomeTax2025(taxable:number, status:FilingStatus){
  if (taxable<=0) return 0
  const b = BRACKETS_2025[status]
  let remaining = taxable, tax=0, lower=0
  for (const {rate, upto} of b){
    const top = upto ?? Infinity
    const span = Math.max(0, Math.min(remaining, top - lower))
    if (span>0){
      tax += span * rate
      remaining -= span
      lower = top
    }
    if (remaining<=0) break
  }
  return Math.max(0, Math.round(tax))
}

export function seTax2025(netBusinessIncome:number, w2Wages:number, status:FilingStatus) {
  const seBase = Math.max(0, netBusinessIncome) * 0.9235

  const oasdiBaseLeft = Math.max(0, SSA_WAGE_BASE_2025 - Math.max(0, w2Wages))
  const oasdiTaxable = Math.min(seBase, oasdiBaseLeft)
  const oasdi = oasdiTaxable * OASDI_RATE

  const medicare = seBase * MEDICARE_RATE

  const combinedMedicareWages = Math.max(0, w2Wages) + seBase
  const threshold = ADDL_MEDICARE_THRESHOLDS[status]
  const overThreshold = Math.max(0, combinedMedicareWages - threshold)
  const addlMedicareBase = Math.min(overThreshold, seBase)
  const addlMedicare = addlMedicareBase * ADDL_MEDICARE_RATE

  const total = oasdi + medicare + addlMedicare
  const deduction = 0.5 * (oasdi + medicare)
  return { oasdi, medicare, addlMedicare, total, seBase, deduction }
}

export function standardDeduction2025(status:FilingStatus){
  return STANDARD_DEDUCTION_2025[status]
}

export function childCreditsEstimate(params: {
  filingStatus:FilingStatus
  earnedIncome:number
  numQualifyingChildren:number
  numOtherDependents:number
  perChildCTC?:number
  refundableCapPerChild?:number
}){
  const perChild = params.perChildCTC ?? 2000
  const refundableCap = params.refundableCapPerChild ?? 1700
  const nonrefChild = perChild * Math.max(0, params.numQualifyingChildren)
  const otherDep = 500 * Math.max(0, params.numOtherDependents)
  const earnedOver = Math.max(0, params.earnedIncome - 2500)
  const actcLimitByIncome = 0.15 * earnedOver
  const actcCap = refundableCap * Math.max(0, params.numQualifyingChildren)
  return { nonrefChild, otherDep, actcLimitByIncome, actcCap }
}

export function taxYear2025DueDates(){
  return [
    dayjs('2025-04-15'),
    dayjs('2025-06-16'),
    dayjs('2025-09-15'),
    dayjs('2026-01-15'),
  ]
}

export function asUSD(n:number){
  const cents = Math.abs(Math.round(n * 100) % 100)
  return (cents === 0 ? USD_NO_CENTS : USD_WITH_CENTS).format(n)
}

export function buildICS(summary:string, dateISO:string, url?:string){
  const dt = dayjs(dateISO)
  const dtstamp = dt.format('YYYYMMDD[T]HHmmss')
  const d = dt.format('YYYYMMDD')
  const uid = `${summary.replace(/\s+/g,'-').toLowerCase()}-${d}@quarterlypilot.pro`
  const lines = [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//QuarterlyPilot Pro//EN','CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${d}`,
    `DTEND;VALUE=DATE:${d}`,
    `SUMMARY:${summary}`,
    url ? `URL:${url}` : '',
    'END:VEVENT','END:VCALENDAR'
  ].filter(Boolean)
  return lines.join('\\r\\n')
}
