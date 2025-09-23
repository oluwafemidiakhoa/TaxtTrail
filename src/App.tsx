
import React, { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { z } from 'zod'
import { FilingStatus, federalIncomeTax2025, seTax2025, standardDeduction2025, taxYear2025DueDates, buildICS, childCreditsEstimate, asUSD, SSA_WAGE_BASE_2025 } from './lib/tax'
import { jsPDF } from 'jspdf'
import Papa from 'papaparse'
import { toNumber } from './lib/parse'

const PERSONAL_SUBSCRIBE_URL = import.meta.env.VITE_SUBSCRIBE_PERSONAL_URL
  || import.meta.env.VITE_SUBSCRIBE_URL
  || '#'
const FREELANCER_SUBSCRIBE_URL = import.meta.env.VITE_SUBSCRIBE_FREELANCER_URL
  || import.meta.env.VITE_SUBSCRIBE_URL
  || '#'
const CONSULT_URL = import.meta.env.VITE_CONSULT_URL || '#'
const PORTAL_URL = import.meta.env.VITE_PORTAL_URL || '#'

const STORAGE_KEY = 'qp.inputs.v2'
const LEAD_STORAGE_KEY = 'qp.lead.v1'

type PresetKey = 'blank' | 'rideshare' | 'etsySeller' | 'consultant'

// Stable control IDs keep labels accessible without relying on React-generated IDs
const FIELD_IDS = {
  filingStatus: 'qp-filing-status',
  dependentsUnder17: 'qp-dependents-under17',
  otherDependents: 'qp-other-dependents',
  use2200PerChild: 'qp-use2200-per-child',
  w2Wages: 'qp-w2-wages',
  w2Withheld: 'qp-w2-withheld',
  netBusinessIncome: 'qp-net-business-income',
  otherIncome: 'qp-other-income',
  safeHarborMode: 'qp-safe-harbor-mode',
  priorYearTotalTax: 'qp-prior-year-total-tax',
  installmentStyle: 'qp-installment-style',
} as const

// Runtime schema guards persisted state and form updates before they reach calculations
const InputsSchema = z.object({
  filingStatus: z.enum(['single', 'mfj', 'mfs', 'hoh']),
  w2Wages: z.number().min(0),
  w2Withheld: z.number().min(0),
  netBusinessIncome: z.number(),
  otherIncome: z.number().min(0),
  dependentsUnder17: z.number().min(0),
  otherDependents: z.number().min(0),
  use2200PerChild: z.boolean(),
  safeHarborMode: z.enum(['current', 'prior100', 'prior110']),
  priorYearTotalTax: z.number().min(0),
})

type Inputs = z.infer<typeof InputsSchema>

const defaultInputs: Inputs = InputsSchema.parse({
  filingStatus: 'single',
  w2Wages: 0,
  w2Withheld: 0,
  netBusinessIncome: 0,
  otherIncome: 0,
  dependentsUnder17: 0,
  otherDependents: 0,
  use2200PerChild: false,
  safeHarborMode: 'current',
  priorYearTotalTax: 0,
})

function loadStoredInputs(): Inputs {
  if (typeof window === 'undefined') return defaultInputs
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultInputs
    const parsed = JSON.parse(raw)
    const result = InputsSchema.safeParse(parsed)
    return result.success ? result.data : defaultInputs
  } catch {
    return defaultInputs
  }
}

const asNonNegativeCurrency = (value: string | number) => Math.max(0, toNumber(value))
const asNetBusinessIncome = (value: string | number) => toNumber(value)
const asNonNegativeInt = (value: string | number) => Math.max(0, Math.floor(toNumber(value)))

type StoredLead = { email: string; unlocked: boolean; preset?: PresetKey }

function loadStoredLead(): StoredLead {
  if (typeof window === 'undefined') return { email: '', unlocked: false }
  try {
    const raw = window.localStorage.getItem(LEAD_STORAGE_KEY)
    if (!raw) return { email: '', unlocked: false, preset: 'blank' }
    const parsed = JSON.parse(raw)
    if (typeof parsed?.email === 'string' && typeof parsed?.unlocked === 'boolean'){
      const presetCandidate = parsed?.preset
      const isPreset = presetCandidate === 'blank' || presetCandidate === 'rideshare' || presetCandidate === 'etsySeller' || presetCandidate === 'consultant'
      return {
        email: parsed.email,
        unlocked: parsed.unlocked,
        preset: isPreset ? (presetCandidate as PresetKey) : 'blank',
      }
    }
    return { email: '', unlocked: false, preset: 'blank' }
  } catch {
    return { email: '', unlocked: false, preset: 'blank' }
  }
}

const PRESET_DETAILS: Record<PresetKey, { label: string; description: string; seed: Partial<Inputs>; upsell?: string }> = {
  blank: {
    label: 'Custom setup',
    description: 'Start from scratch and enter all figures manually.',
    seed: {},
  },
  rideshare: {
    label: 'Gig driver / rideshare',
    description: 'High mileage 1099 income with light W‑2 earnings.',
    seed: {
      filingStatus: 'single',
      netBusinessIncome: 42000,
      otherIncome: 1500,
      w2Wages: 8000,
      w2Withheld: 600,
      dependentsUnder17: 0,
      otherDependents: 0,
      use2200PerChild: false,
      safeHarborMode: 'current',
      priorYearTotalTax: 0,
    },
    upsell: 'Unlock mileage tracking & reminders with Freelancer $9.99/mo.',
  },
  etsySeller: {
    label: 'Etsy / e-commerce seller',
    description: 'Seasonal profits with spouse withholding coverage.',
    seed: {
      filingStatus: 'mfj',
      netBusinessIncome: 58000,
      otherIncome: 6500,
      w2Wages: 38000,
      w2Withheld: 3200,
      dependentsUnder17: 1,
      otherDependents: 0,
      use2200PerChild: false,
      safeHarborMode: 'prior110',
      priorYearTotalTax: 9200,
    },
    upsell: 'Surface inventory tools & product cost tracking in Freelancer $9.99/mo.',
  },
  consultant: {
    label: 'Solo consultant',
    description: 'High 1099 income, no withholding, safe-harbor planning.',
    seed: {
      filingStatus: 'single',
      netBusinessIncome: 125000,
      otherIncome: 4000,
      w2Wages: 0,
      w2Withheld: 0,
      dependentsUnder17: 0,
      otherDependents: 0,
      use2200PerChild: false,
      safeHarborMode: 'prior100',
      priorYearTotalTax: 24000,
    },
    upsell: 'Promote the 30-min review for quarterly tune-ups ($99).',
  },
}

export default function App(){
  const leadDefaults = useMemo(loadStoredLead, [])
  const [i, setI] = useState<Inputs>(loadStoredInputs)
  const [annualize, setAnnualize] = useState(false)
  const [activePreset, setActivePreset] = useState<PresetKey>(leadDefaults.preset ?? 'blank')
  const [leadEmail, setLeadEmail] = useState(leadDefaults.email)
  const [premiumUnlocked, setPremiumUnlocked] = useState(leadDefaults.unlocked)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [pendingDownload, setPendingDownload] = useState<'csv'|'pdf'|null>(null)
  const [emailError, setEmailError] = useState('')

  useEffect(()=>{
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(i))
    } catch {
      /* ignore storage issues */
    }
  }, [i])

  useEffect(()=>{
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(LEAD_STORAGE_KEY, JSON.stringify({ email: leadEmail, unlocked: premiumUnlocked, preset: activePreset }))
    } catch {
      /* ignore storage issues */
    }
  }, [leadEmail, premiumUnlocked, activePreset])

  const dueDates = useMemo(()=>taxYear2025DueDates(), [])
  const now = dayjs()
  const nextDue = dueDates.find(d => d.isAfter(now)) || (dueDates.length ? dueDates[dueDates.length-1] : now)
  const daysLeft = nextDue.diff(now, 'day')

  function applyInputs(patch: Partial<Inputs>){
    const next = { ...i, ...patch }
    const parsed = InputsSchema.safeParse(next)
    if (parsed.success){
      setI(parsed.data)
    }
  }

  function applyPreset(key: PresetKey){
    const preset = PRESET_DETAILS[key]
    if (!preset) return
    setActivePreset(key)
    if (key === 'blank') {
      applyInputs(defaultInputs)
      return
    }
    if (Object.keys(preset.seed).length === 0) return
    applyInputs(preset.seed)
  }

  // Allocate installments in cents to keep the rounded schedule equal to the target total
  function splitIntoQuarters(total:number, useAnnualized:boolean){
    if (dueDates.length === 0) return []
    const totalCents = Math.max(0, Math.round(total * 100))
    if (totalCents === 0) return dueDates.map(() => 0)
    const weights = useAnnualized && dueDates.length === 4
      ? [30, 30, 20, 20]
      : Array(dueDates.length).fill(1)
    const weightSum = weights.reduce((acc, w) => acc + w, 0)
    const allocations = weights.map(w => Math.floor((totalCents * w) / weightSum))
    let remainder = totalCents - allocations.reduce((acc, cents) => acc + cents, 0)
    let idx = allocations.length - 1
    while (remainder > 0){
      allocations[idx] += 1
      remainder -= 1
      idx = idx === 0 ? allocations.length - 1 : idx - 1
    }
    return allocations.map(cents => cents / 100)
  }

  const totals = useMemo(()=>{
    const totalIncome = i.w2Wages + i.netBusinessIncome + i.otherIncome
    const earnedIncome = i.w2Wages + Math.max(0, i.netBusinessIncome)
    const se = seTax2025(i.netBusinessIncome, i.w2Wages, i.filingStatus)
    const stdDed = standardDeduction2025(i.filingStatus)
    const agiAdjustments = se.deduction
    const taxableIncomeBase = Math.max(0, totalIncome - stdDed - agiAdjustments)
    const incomeTax = federalIncomeTax2025(taxableIncomeBase, i.filingStatus)

    const perChild = i.use2200PerChild ? 2200 : 2000
    const credits = childCreditsEstimate({
      filingStatus: i.filingStatus,
      earnedIncome,
      numQualifyingChildren: i.dependentsUnder17,
      numOtherDependents: i.otherDependents,
      perChildCTC: perChild,
      refundableCapPerChild: 1700,
    })

    const nonrefAvail = credits.nonrefChild + credits.otherDep
    const nonrefUsed = Math.min(incomeTax, nonrefAvail)
    const incomeTaxAfterNonref = Math.max(0, incomeTax - nonrefUsed)

    const childRemaining = Math.max(0, credits.nonrefChild - Math.min(incomeTax, credits.nonrefChild))
    const actc = Math.min(credits.actcLimitByIncome, credits.actcCap, childRemaining)

    const totalTaxLiability = incomeTaxAfterNonref + se.total - actc

    const safeHarbor100 = i.priorYearTotalTax
    const safeHarbor110 = Math.round(i.priorYearTotalTax * 1.10)

    const requiredForSafeHarbor = i.safeHarborMode === 'prior100' ? safeHarbor100
      : i.safeHarborMode === 'prior110' ? safeHarbor110
      : totalTaxLiability

    const estTaxAfterWithholding = Math.max(0, requiredForSafeHarbor - i.w2Withheld)

    const quarters = splitIntoQuarters(estTaxAfterWithholding, annualize)

    return {
      totalIncome,
      earnedIncome,
      stdDed,
      agiAdjustments,
      taxableIncomeBase,
      incomeTax,
      se,
      nonrefUsed,
      incomeTaxAfterNonref,
      actc,
      totalTaxLiability,
      safeHarbor100,
      safeHarbor110,
      requiredForSafeHarbor,
      estTaxAfterWithholding,
      quarters,
    }
  }, [i, annualize, dueDates])

  const firstDeadlineLabel = dueDates.length
    ? (dueDates[0].isAfter(now) ? dueDates[0].format('MMM D, YYYY') : nextDue.format('MMM D, YYYY'))
    : 'TBD'

  const ctaLinks = useMemo(() => (
    [
      { url: PERSONAL_SUBSCRIBE_URL, label: 'Personal $4.99/mo' },
      { url: FREELANCER_SUBSCRIBE_URL, label: 'Freelancer $9.99/mo' },
      { url: CONSULT_URL, label: '30‑min Review $99' },
      { url: PORTAL_URL, label: 'Manage billing' },
    ].filter(link => link.url && link.url !== '#')
  ), [])

  const activeUpsell = PRESET_DETAILS[activePreset]?.upsell ?? null
  const pendingLabel = pendingDownload === 'pdf' ? 'PDF plan' : 'CSV export'

  function downloadCSVFile(){
    const rows = [
      ['Metric','Amount'],
      ['Filing status', i.filingStatus],
      ['W‑2 wages', i.w2Wages],
      ['W‑2 withheld', i.w2Withheld],
      ['Net business income', i.netBusinessIncome],
      ['Other income', i.otherIncome],
      ['Total income', totals.totalIncome],
      ['Standard deduction', totals.stdDed],
      ['Half SE tax deduction', totals.agiAdjustments],
      ['Taxable income', totals.taxableIncomeBase],
      ['Income tax (before credits)', totals.incomeTax],
      ['Nonrefundable credits used', totals.nonrefUsed],
      ['Refundable ACTC', totals.actc],
      ['Self-employment tax', totals.se.total],
      ['Total estimated tax', totals.totalTaxLiability],
      ['Safe harbor selection', i.safeHarborMode],
      ['Required for plan', totals.requiredForSafeHarbor],
      ['Withholding', i.w2Withheld],
      ['Estimated tax due after withholding', totals.estTaxAfterWithholding],
    ]
    dueDates.forEach((d,idx)=>rows.push([`Installment ${idx+1} (${d.format('YYYY-MM-DD')})`, totals.quarters[idx]]))
    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'})
    const url = URL.createObjectURL(blob)
    try {
      const a = document.createElement('a')
      a.href = url
      a.download = 'quarterly-plan.csv'
      a.click()
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  function downloadPDFFile(){
    const doc = new jsPDF()
    doc.setFontSize(18); doc.text('QuarterlyPilot Pro - 2025 Plan', 14, 16)
    doc.setFontSize(12)
    doc.text(`Filing status: ${i.filingStatus.toUpperCase()}`, 14, 26)
    doc.text(`Total income: ${asUSD(totals.totalIncome)}`, 14, 34)
    doc.text(`Standard deduction: ${asUSD(totals.stdDed)}`, 14, 42)
    doc.text(`Half SE tax deduction: ${asUSD(totals.agiAdjustments)}`, 14, 50)
    doc.text(`Taxable income: ${asUSD(totals.taxableIncomeBase)}`, 14, 58)
    doc.text(`Income tax (before credits): ${asUSD(totals.incomeTax)}`, 14, 66)
    doc.text(`Nonrefundable credits used: ${asUSD(totals.nonrefUsed)}`, 14, 74)
    doc.text(`Refundable ACTC: ${asUSD(totals.actc)}`, 14, 82)
    doc.text(`Self-employment tax: ${asUSD(totals.se.total)}`, 14, 90)
    doc.text(`Total estimated tax: ${asUSD(totals.totalTaxLiability)}`, 14, 98)
    doc.text(`Safe harbor plan: ${i.safeHarborMode} → ${asUSD(totals.requiredForSafeHarbor)}`, 14, 106)
    doc.text(`After withholding: ${asUSD(totals.estTaxAfterWithholding)}`, 14, 114)
    doc.text('Installments:', 14, 116)
    const y0 = 124
    dueDates.forEach((d,idx)=>{
      doc.text(`${idx+1}. ${d.format('MMM D, YYYY')} — ${asUSD(totals.quarters[idx])}`, 18, y0 + idx*8)
    })
    doc.save('quarterly-plan.pdf')
  }

  function handleDownloadRequest(type: 'csv' | 'pdf'){
    if (!premiumUnlocked){
      setPendingDownload(type)
      setShowUpgradeModal(true)
      return
    }
    if (type === 'csv') downloadCSVFile()
    else downloadPDFFile()
  }

  function closeUpgradeModal(){
    setShowUpgradeModal(false)
    setPendingDownload(null)
    setEmailError('')
  }

  function unlockDownloads(event: React.FormEvent){
    event.preventDefault()
    const email = leadEmail.trim()
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailPattern.test(email)){
      setEmailError('Enter a valid email to unlock premium downloads.')
      return
    }
    setEmailError('')
    setPremiumUnlocked(true)
    setShowUpgradeModal(false)
    const nextAction = pendingDownload
    setPendingDownload(null)
    if (nextAction === 'csv') downloadCSVFile()
    else if (nextAction === 'pdf') downloadPDFFile()
  }

  function downloadICS(idx:number){
    const date = dueDates[idx]
    if (!date) return
    const ics = buildICS(`Estimated tax payment ${idx+1}/4`, date.format('YYYY-MM-DD'))
    const blob = new Blob([ics], {type:'text/calendar;charset=utf-8;'})
    const url = URL.createObjectURL(blob)
    try {
      const a = document.createElement('a')
      a.href = url
      a.download = `est-tax-${date.format('YYYYMMDD')}.ics`
      a.click()
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  return (
    <>
      <div className="container">
      <div className="grid grid-2" style={{alignItems:'center'}}>
        <div>
          <h1>QuarterlyPilot Pro</h1>
          <div className="row" style={{gap:8,flexWrap:'wrap'}}>
            <span className="badge">Next deadline: <b>{firstDeadlineLabel}</b></span>
            <span className="badge">Countdown: <b>{Math.max(0, daysLeft)}</b> days</span>
            <span className="badge">SSA wage base 2025: <b>${SSA_WAGE_BASE_2025.toLocaleString()}</b></span>
          </div>
        </div>
        {ctaLinks.length > 0 && (
          <div className="row" style={{justifyContent:'flex-end', gap:8}}>
            {ctaLinks.map(link => (
              <a key={link.label} href={link.url} target="_blank" rel="noreferrer"><button type="button">{link.label}</button></a>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-3" style={{marginTop:16}}>
        <div className="kpi"><span className="lbl">Total income</span><span className="val">{asUSD(totals.totalIncome)}</span></div>
        <div className="kpi"><span className="lbl">Est. total tax (after credits)</span><span className="val">{asUSD(totals.totalTaxLiability)}</span></div>
        <div className="kpi"><span className="lbl">After withholding</span><span className="val">{asUSD(totals.estTaxAfterWithholding)}</span></div>
      </div>

      <div className="card" style={{marginTop:16}}>
        <h2>Quick start presets</h2>
        <div className="preset-grid">
          {Object.entries(PRESET_DETAILS).map(([key, preset]) => (
            <button
              type="button"
              key={key}
              className={`preset ${activePreset === key ? 'preset-active' : ''}`}
              onClick={()=>applyPreset(key as PresetKey)}
            >
              <span className="preset-label">{preset.label}</span>
              <span className="preset-desc">{preset.description}</span>
              {preset.upsell && <span className="preset-upsell">{preset.upsell}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-2" style={{marginTop:16}}>
        <div className="card">
          <h2>Household</h2>
          <div className="grid grid-2">
            <div>
              <label htmlFor={FIELD_IDS.filingStatus}>Filing status</label>
              <select id={FIELD_IDS.filingStatus} value={i.filingStatus} onChange={e=>applyInputs({ filingStatus: e.target.value as FilingStatus })}>
                <option value="single">Single</option>
                <option value="mfj">Married filing jointly</option>
                <option value="mfs">Married filing separately</option>
                <option value="hoh">Head of household</option>
              </select>
            </div>
            <div>
              <label htmlFor={FIELD_IDS.dependentsUnder17}>Dependents under 17 (Child Tax Credit)</label>
              <input id={FIELD_IDS.dependentsUnder17} type="number" value={i.dependentsUnder17} onChange={e=>applyInputs({ dependentsUnder17: asNonNegativeInt(e.target.value) })} />
            </div>
            <div>
              <label htmlFor={FIELD_IDS.otherDependents}>Other dependents (age 17+, parents, etc.)</label>
              <input id={FIELD_IDS.otherDependents} type="number" value={i.otherDependents} onChange={e=>applyInputs({ otherDependents: asNonNegativeInt(e.target.value) })} />
            </div>
            <div>
              <label htmlFor={FIELD_IDS.use2200PerChild}>Use $2,200/child (toggle if law applies in your case)</label>
              <select id={FIELD_IDS.use2200PerChild} value={i.use2200PerChild ? 'yes':'no'} onChange={e=>applyInputs({ use2200PerChild: e.target.value==='yes' })}>
                <option value="no">No (use $2,000)</option>
                <option value="yes">Yes (use $2,200)</option>
              </select>
            </div>
          </div>
          <hr/>
          <div className="small">Note: Personal exemptions remain <b>0</b> for 2025 under current IRS guidance.</div>
        </div>

        <div className="card">
          <h2>Income & withholding</h2>
          <div className="grid grid-2">
            <div>
              <label htmlFor={FIELD_IDS.w2Wages}>W‑2 wages (annual)</label>
              <input id={FIELD_IDS.w2Wages} type="number" value={i.w2Wages} onChange={e=>applyInputs({ w2Wages: asNonNegativeCurrency(e.target.value) })} />
            </div>
            <div>
              <label htmlFor={FIELD_IDS.w2Withheld}>W‑2 federal tax withheld (YTD)</label>
              <input id={FIELD_IDS.w2Withheld} type="number" value={i.w2Withheld} onChange={e=>applyInputs({ w2Withheld: asNonNegativeCurrency(e.target.value) })} />
            </div>
            <div>
              <label htmlFor={FIELD_IDS.netBusinessIncome}>Net business income (Schedule C)</label>
              <input id={FIELD_IDS.netBusinessIncome} type="number" value={i.netBusinessIncome} onChange={e=>applyInputs({ netBusinessIncome: asNetBusinessIncome(e.target.value) })} />
            </div>
            <div>
              <label htmlFor={FIELD_IDS.otherIncome}>Other income (interest, etc.)</label>
              <input id={FIELD_IDS.otherIncome} type="number" value={i.otherIncome} onChange={e=>applyInputs({ otherIncome: asNonNegativeCurrency(e.target.value) })} />
            </div>
          </div>
          <div className="row" style={{marginTop:10}}>
            <span className="badge">Total income: <b>{asUSD(totals.totalIncome)}</b></span>
            <span className="badge">Std deduction: <b>{asUSD(totals.stdDed)}</b></span>
            <span className="badge">Half SE deduction: <b>{asUSD(totals.agiAdjustments)}</b></span>
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{marginTop:16}}>
        <div className="card">
          <h2>Plan settings</h2>
          <div className="grid grid-2">
            <div>
              <label htmlFor={FIELD_IDS.safeHarborMode}>Safe harbor mode</label>
              <select id={FIELD_IDS.safeHarborMode} value={i.safeHarborMode} onChange={e=>applyInputs({ safeHarborMode: e.target.value as Inputs['safeHarborMode'] })}>
                <option value="current">90% of current‑year (default)</option>
                <option value="prior100">100% of last year</option>
                <option value="prior110">110% of last year (AGI &gt; $150k)</option>
              </select>
            </div>
            <div>
              <label htmlFor={FIELD_IDS.priorYearTotalTax}>Last year's total tax (Form 1040, line 24)</label>
              <input id={FIELD_IDS.priorYearTotalTax} type="number" value={i.priorYearTotalTax} onChange={e=>applyInputs({ priorYearTotalTax: asNonNegativeCurrency(e.target.value) })} />
            </div>
            <div>
              <label htmlFor={FIELD_IDS.installmentStyle}>Installment style</label>
              <select id={FIELD_IDS.installmentStyle} value={annualize ? 'annualized':'equal'} onChange={e=>setAnnualize(e.target.value==='annualized')}>
                <option value="equal">Equal 4 payments</option>
                <option value="annualized">Annualized (30/30/20/20)</option>
              </select>
            </div>
          </div>
          <hr/>
          <div className="small">
            Using 2025 IRS brackets & standard deductions. SE tax uses the $176,100 Social Security wage base and 2.9% Medicare, with the 0.9% additional Medicare threshold by status.
          </div>
        </div>

        <div className="card">
          <h2>Outputs</h2>
          <div className="grid grid-3">
            <div className="kpi"><span className="lbl">Income tax after nonref</span><span className="val">{asUSD(totals.incomeTaxAfterNonref)}</span></div>
            <div className="kpi"><span className="lbl">Refundable ACTC</span><span className="val">{asUSD(totals.actc)}</span></div>
            <div className="kpi"><span className="lbl">SE tax</span><span className="val">{asUSD(totals.se.total)}</span></div>
          </div>
          <div className="row" style={{gap:8, marginTop:12}}>
            <button type="button" onClick={()=>handleDownloadRequest('csv')}>Download CSV</button>
            <button type="button" onClick={()=>handleDownloadRequest('pdf')}>Download PDF</button>
          </div>
        </div>
      </div>

      <div className="card" style={{marginTop:16}}>
        <h2>Quarterly schedule (2025)</h2>
        <table className="table">
          <thead><tr><th>Due date</th><th>Amount</th><th>Calendar</th></tr></thead>
        <tbody>
          {dueDates.map((d, idx)=>(
            <tr key={idx}>
              <td>{d.format('MMM D, YYYY')}</td>
              <td>{asUSD(totals.quarters[idx])}</td>
              <td><button type="button" onClick={()=>downloadICS(idx)}>Add .ics</button></td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>

      <div className="footer small">
        <div>Info: Form 1099‑K thresholds are $5,000 for 2024 and $2,500 for 2025 (reporting by payment apps/marketplaces).</div>
        <div>Disclaimer: This is a planning tool, not tax advice. Always review with a tax professional.</div>
      </div>
      </div>

      {showUpgradeModal && (
        <div className="modal-backdrop" role="presentation" onClick={closeUpgradeModal}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="premium-modal-title" onClick={e=>e.stopPropagation()}>
            <button type="button" className="modal-close" onClick={closeUpgradeModal} aria-label="Close upgrade modal">×</button>
            <h3 id="premium-modal-title">Unlock premium downloads</h3>
            <p>
              Enter your email to get the {pendingLabel} plus quarterly reminders and pro tips straight to your inbox.
            </p>
            {activeUpsell && <div className="modal-upsell">{activeUpsell}</div>}
            <form className="modal-form" onSubmit={unlockDownloads}>
              <label htmlFor="lead-email">Email address</label>
              <input
                id="lead-email"
                type="email"
                value={leadEmail}
                onChange={e=>setLeadEmail(e.target.value)}
                placeholder="you@example.com"
                autoFocus
              />
              {emailError && <div className="modal-error">{emailError}</div>}
              <button type="submit" className="modal-primary">Unlock &amp; download</button>
            </form>
            <div className="modal-cta">
              {FREELANCER_SUBSCRIBE_URL !== '#' && (
                <a href={FREELANCER_SUBSCRIBE_URL} target="_blank" rel="noreferrer"><button type="button">Upgrade to Freelancer</button></a>
              )}
              {PERSONAL_SUBSCRIBE_URL !== '#' && (
                <a href={PERSONAL_SUBSCRIBE_URL} target="_blank" rel="noreferrer"><button type="button">Personal plan $4.99/mo</button></a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
