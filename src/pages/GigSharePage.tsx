import React, { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { z } from 'zod'
import { FilingStatus, federalIncomeTax2025, seTax2025, standardDeduction2025, taxYear2025DueDates, buildICS, childCreditsEstimate, asUSD, SSA_WAGE_BASE_2025 } from '../lib/tax'
import { BusinessType, ExpenseData, ExpenseEntry, EXPENSE_CATEGORIES, loadStoredExpenses, saveExpenses, generateExpenseId, getTotalExpenses, getCategoryLabel } from '../lib/expenses'
import { categorizeExpense, generateTaxInsights, suggestExpenses, parseNaturalLanguageExpense } from '../lib/ai'
import { jsPDF } from 'jspdf'
import Papa from 'papaparse'
import { toNumber } from '../lib/parse'
import { Link } from 'react-router-dom'

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
  expenseAmount: 'qp-expense-amount',
  expenseDescription: 'qp-expense-description',
  expenseCategory: 'qp-expense-category',
} as const

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

type StoredLead = { email: string; unlocked: boolean }

function loadStoredLead(): StoredLead {
  if (typeof window === 'undefined') return { email: '', unlocked: false }
  try {
    const raw = window.localStorage.getItem(LEAD_STORAGE_KEY)
    if (!raw) return { email: '', unlocked: false }
    const parsed = JSON.parse(raw)
    if (typeof parsed?.email === 'string' && typeof parsed?.unlocked === 'boolean'){
      return { email: parsed.email, unlocked: parsed.unlocked }
    }
    return { email: '', unlocked: false }
  } catch {
    return { email: '', unlocked: false }
  }
}

export default function GigSharePage(){
  const leadDefaults = useMemo(loadStoredLead, [])
  const [i, setI] = useState<Inputs>(loadStoredInputs)
  const [annualize, setAnnualize] = useState(false)
  const [leadEmail, setLeadEmail] = useState(leadDefaults.email)
  const [premiumUnlocked, setPremiumUnlocked] = useState(leadDefaults.unlocked)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [pendingDownload, setPendingDownload] = useState<'csv'|'pdf'|null>(null)
  const [emailError, setEmailError] = useState('')
  
  // Expense tracking state - force rideshare business type
  const [expenseData, setExpenseData] = useState<ExpenseData>({
    ...loadStoredExpenses(),
    businessType: 'rideshare'
  })
  const [showExpenses, setShowExpenses] = useState(false)
  const [newExpense, setNewExpense] = useState({ amount: '', description: '', category: '' })
  
  // AI features state
  const [aiInsights, setAiInsights] = useState<any[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [naturalLanguageInput, setNaturalLanguageInput] = useState('')
  const [suggestedExpenses, setSuggestedExpenses] = useState<string[]>([])
  const [showAiFeatures, setShowAiFeatures] = useState(false)

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
      window.localStorage.setItem(LEAD_STORAGE_KEY, JSON.stringify({ email: leadEmail, unlocked: premiumUnlocked }))
    } catch {
      /* ignore storage issues */
    }
  }, [leadEmail, premiumUnlocked])

  useEffect(()=>{
    saveExpenses(expenseData)
  }, [expenseData])

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

  function addExpense() {
    const amount = toNumber(newExpense.amount)
    const description = newExpense.description.trim()
    
    if (amount <= 0) {
      alert('Please enter a valid expense amount greater than $0.')
      return
    }
    
    if (!description) {
      alert('Please enter a description for this expense.')
      return
    }
    
    if (!newExpense.category) {
      alert('Please select an expense category.')
      return
    }
    
    const expense: ExpenseEntry = {
      id: generateExpenseId(),
      date: new Date().toISOString().split('T')[0],
      category: newExpense.category as any,
      description,
      amount,
      businessType: 'rideshare'
    }
    
    setExpenseData(prev => ({
      ...prev,
      entries: [...prev.entries, expense]
    }))
    
    setNewExpense({ amount: '', description: '', category: '' })
  }

  function removeExpense(id: string) {
    setExpenseData(prev => ({
      ...prev,
      entries: prev.entries.filter(e => e.id !== id)
    }))
  }

  async function addExpenseWithAI() {
    const amount = toNumber(newExpense.amount)
    const description = newExpense.description.trim()
    
    if (amount <= 0) {
      alert('Please enter a valid expense amount greater than $0.')
      return
    }
    
    if (!description) {
      alert('Please enter a description for this expense.')
      return
    }

    setIsAnalyzing(true)
    
    try {
      let category = newExpense.category
      if (!category) {
        const aiResult = await categorizeExpense(description, amount, 'rideshare')
        category = aiResult.category || ''
        
        if (aiResult.category && aiResult.confidence > 0.6) {
          const confirmed = confirm(`AI suggests category: "${getCategoryLabel(aiResult.category, 'rideshare')}" (${Math.round(aiResult.confidence * 100)}% confidence)\n\nReason: ${aiResult.reasoning}\n\nUse this category?`)
          if (!confirmed) {
            category = ''
          }
        }
      }
      
      if (!category) {
        alert('Please select an expense category.')
        setIsAnalyzing(false)
        return
      }
      
      const expense: ExpenseEntry = {
        id: generateExpenseId(),
        date: new Date().toISOString().split('T')[0],
        category: category as any,
        description,
        amount,
        businessType: 'rideshare'
      }
      
      setExpenseData(prev => ({
        ...prev,
        entries: [...prev.entries, expense]
      }))
      
      setNewExpense({ amount: '', description: '', category: '' })
      
    } catch (error) {
      console.error('AI categorization failed:', error)
      addExpense()
    } finally {
      setIsAnalyzing(false)
    }
  }

  async function addNaturalLanguageExpense() {
    if (!naturalLanguageInput.trim()) {
      alert('Please enter an expense description.')
      return
    }

    setIsAnalyzing(true)
    
    try {
      const parsed = await parseNaturalLanguageExpense(naturalLanguageInput, 'rideshare')
      
      if (parsed.amount <= 0) {
        alert('Could not detect a valid amount. Please try again with a clearer description.')
        setIsAnalyzing(false)
        return
      }
      
      const expense: ExpenseEntry = {
        id: generateExpenseId(),
        date: new Date().toISOString().split('T')[0],
        category: parsed.category || 'other' as any,
        description: parsed.description,
        amount: parsed.amount,
        businessType: 'rideshare'
      }
      
      setExpenseData(prev => ({
        ...prev,
        entries: [...prev.entries, expense]
      }))
      
      setNaturalLanguageInput('')
      
    } catch (error) {
      console.error('Natural language parsing failed:', error)
      alert('Could not parse the expense. Please try again or use the manual entry form.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  async function generateAIInsights() {
    setIsAnalyzing(true)
    
    try {
      const insights = await generateTaxInsights(
        totals.totalIncome,
        totals.totalExpenses,
        totals.quarters,
        'rideshare'
      )
      setAiInsights(insights)
    } catch (error) {
      console.error('AI insights failed:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  useEffect(() => {
    suggestExpenses('rideshare').then(setSuggestedExpenses)
  }, [])

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
    const totalExpenses = getTotalExpenses(expenseData.entries)
    const netBusinessIncomeAfterExpenses = i.netBusinessIncome - totalExpenses
    const totalIncome = i.w2Wages + netBusinessIncomeAfterExpenses + i.otherIncome
    const earnedIncome = i.w2Wages + Math.max(0, netBusinessIncomeAfterExpenses)
    const se = seTax2025(netBusinessIncomeAfterExpenses, i.w2Wages, i.filingStatus)
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
      totalExpenses,
      netBusinessIncomeAfterExpenses,
    }
  }, [i, annualize, dueDates, expenseData])

  const firstDeadlineLabel = dueDates.length
    ? (dueDates[0].isAfter(now) ? dueDates[0].format('MMM D, YYYY') : nextDue.format('MMM D, YYYY'))
    : 'TBD'

  const ctaLinks = useMemo(() => (
    [
      { url: PERSONAL_SUBSCRIBE_URL, label: 'Personal Plan' },
      { url: FREELANCER_SUBSCRIBE_URL, label: 'Professional Plan' },
      { url: CONSULT_URL, label: 'Tax Consultation' },
      { url: PORTAL_URL, label: 'Billing Portal' },
    ].filter(link => link.url && link.url !== '#' && !link.url.includes('...'))
  ), [])

  const pendingLabel = pendingDownload === 'pdf' ? 'PDF plan' : 'CSV export'

  function downloadCSVFile(){
    const rows = [
      ['Metric','Amount'],
      ['Filing status', i.filingStatus],
      ['W‑2 wages', i.w2Wages],
      ['W‑2 withheld', i.w2Withheld],
      ['Gross gig income', i.netBusinessIncome],
      ['Total vehicle/business expenses', totals.totalExpenses],
      ['Net business income (after expenses)', totals.netBusinessIncomeAfterExpenses],
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
    
    if (expenseData.entries.length > 0) {
      rows.push(['', ''])
      rows.push(['GIG WORKER EXPENSES', ''])
      expenseData.entries.forEach(expense => {
        rows.push([`${expense.description} (${getCategoryLabel(expense.category, expense.businessType)})`, expense.amount])
      })
    }
    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'})
    const url = URL.createObjectURL(blob)
    try {
      const a = document.createElement('a')
      a.href = url
      a.download = 'taxtrail-gig-worker-plan.csv'
      a.click()
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  function downloadPDFFile(){
    const doc = new jsPDF()
    doc.setFontSize(18); doc.text('TaxTrail - Gig Worker Tax Plan 2025', 14, 16)
    doc.setFontSize(12)
    doc.text(`Filing status: ${i.filingStatus.toUpperCase()}`, 14, 26)
    doc.text(`Gross gig income: ${asUSD(i.netBusinessIncome)}`, 14, 34)
    doc.text(`Vehicle/business expenses: ${asUSD(totals.totalExpenses)}`, 14, 42)
    doc.text(`Net business income: ${asUSD(totals.netBusinessIncomeAfterExpenses)}`, 14, 50)
    doc.text(`Total income: ${asUSD(totals.totalIncome)}`, 14, 58)
    doc.text(`Standard deduction: ${asUSD(totals.stdDed)}`, 14, 66)
    doc.text(`Half SE tax deduction: ${asUSD(totals.agiAdjustments)}`, 14, 74)
    doc.text(`Taxable income: ${asUSD(totals.taxableIncomeBase)}`, 14, 82)
    doc.text(`Income tax (before credits): ${asUSD(totals.incomeTax)}`, 14, 90)
    doc.text(`Nonrefundable credits used: ${asUSD(totals.nonrefUsed)}`, 14, 98)
    doc.text(`Refundable ACTC: ${asUSD(totals.actc)}`, 14, 106)
    doc.text(`Self-employment tax: ${asUSD(totals.se.total)}`, 14, 114)
    doc.text(`Total estimated tax: ${asUSD(totals.totalTaxLiability)}`, 14, 122)
    doc.text(`Safe harbor plan: ${i.safeHarborMode} → ${asUSD(totals.requiredForSafeHarbor)}`, 14, 130)
    doc.text(`After withholding: ${asUSD(totals.estTaxAfterWithholding)}`, 14, 138)
    doc.text('Installments:', 14, 146)
    const y0 = 154
    dueDates.forEach((d,idx)=>{
      doc.text(`${idx+1}. ${d.format('MMM D, YYYY')} — ${asUSD(totals.quarters[idx])}`, 18, y0 + idx*8)
    })
    
    if (expenseData.entries.length > 0) {
      doc.addPage()
      doc.setFontSize(18); doc.text('Gig Worker Expenses', 14, 16)
      doc.setFontSize(10)
      let yPos = 30
      expenseData.entries.forEach(expense => {
        if (yPos > 280) {
          doc.addPage()
          yPos = 20
        }
        doc.text(`${expense.description}`, 14, yPos)
        doc.text(`${getCategoryLabel(expense.category, expense.businessType)}`, 14, yPos + 8)
        doc.text(`${asUSD(expense.amount)}`, 160, yPos, { align: 'right' })
        yPos += 16
      })
    }
    
    doc.save('taxtrail-gig-worker-plan.pdf')
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
          <h1>TaxTrail - Gig Worker / Rideshare</h1>
          <div className="row" style={{gap:8,flexWrap:'wrap'}}>
            <Link to="/" style={{textDecoration:'none'}}><button type="button" style={{background:'var(--accent)'}}>← Back to Home</button></Link>
            <span className="badge">Next deadline: <b>{firstDeadlineLabel}</b></span>
            <span className={`badge ${daysLeft <= 30 ? 'warn' : ''}`}>Countdown: <b>{Math.max(0, daysLeft)}</b> days</span>
          </div>
          <p style={{margin:'8px 0', fontSize:'14px', opacity:0.8}}>
            Tax planning for Uber, Lyft, DoorDash, and delivery drivers with mileage tracking, vehicle expense management, and quarterly reminders.
          </p>
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
              <label htmlFor={FIELD_IDS.netBusinessIncome}>Gross gig income (before expenses)</label>
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

      <div className="card" style={{marginTop:16}}>
        <div className="row" style={{alignItems:'center', justifyContent:'space-between', flexWrap:'wrap'}}>
          <h2>Vehicle & Business Expenses 🚗</h2>
          <div className="row" style={{gap:8}}>
            <button type="button" onClick={()=>setShowAiFeatures(!showAiFeatures)}>
              {showAiFeatures ? 'Hide' : 'Show'} AI Features
            </button>
            <button type="button" onClick={()=>setShowExpenses(!showExpenses)}>
              {showExpenses ? 'Hide' : 'Show'} Expenses
            </button>
          </div>
        </div>
        <div className="row" style={{gap:8, flexWrap:'wrap'}}>
          <span className="badge">Total expenses: <b>{asUSD(totals.totalExpenses)}</b></span>
          <span className={`badge ${totals.netBusinessIncomeAfterExpenses < 0 ? 'danger' : ''}`}>Net business income: <b>{asUSD(totals.netBusinessIncomeAfterExpenses)}</b></span>
        </div>
        
        {showAiFeatures && (
          <>
            <hr/>
            <div style={{marginTop:12}}>
              <h3 style={{fontSize:'16px', margin:'0 0 8px'}}>🧠 AI Assistant</h3>
              
              <div style={{marginBottom:16}}>
                <label>Quick Add (Natural Language)</label>
                <div className="row" style={{gap:8}}>
                  <input 
                    type="text" 
                    value={naturalLanguageInput}
                    onChange={e=>setNaturalLanguageInput(e.target.value)}
                    placeholder="e.g., 'gas fill up $45' or 'car wash $25'"
                    style={{flex:1}}
                  />
                  <button 
                    type="button" 
                    onClick={addNaturalLanguageExpense}
                    disabled={isAnalyzing || !naturalLanguageInput.trim()}
                  >
                    {isAnalyzing ? '🔄 AI Processing...' : '✨ Add with AI'}
                  </button>
                </div>
              </div>

              <div style={{marginBottom:16}}>
                <div className="row" style={{alignItems:'center', gap:8}}>
                  <button 
                    type="button" 
                    onClick={generateAIInsights}
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? '🔄 Analyzing...' : '📊 Get AI Tax Insights'}
                  </button>
                  {aiInsights.length > 0 && (
                    <span className="badge">{aiInsights.length} insights</span>
                  )}
                </div>
                
                {aiInsights.length > 0 && (
                  <div style={{marginTop:8}}>
                    {aiInsights.map((insight, idx) => (
                      <div key={idx} className={`card ${insight.type === 'warning' ? 'warn' : ''}`} style={{padding:12, marginBottom:8, fontSize:14}}>
                        <div style={{fontWeight:600, marginBottom:4}}>
                          {insight.type === 'warning' ? '⚠️' : insight.type === 'suggestion' ? '💡' : 'ℹ️'} {insight.title}
                        </div>
                        <div style={{marginBottom:4}}>{insight.message}</div>
                        <div style={{fontSize:12, opacity:0.8}}>Impact: {insight.impact}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {suggestedExpenses.length > 0 && (
                <div style={{marginBottom:16}}>
                  <label>💡 Common gig worker expenses:</label>
                  <div style={{display:'flex', flexWrap:'wrap', gap:6, marginTop:6}}>
                    {suggestedExpenses.slice(0, 6).map((suggestion, idx) => (
                      <button 
                        key={idx}
                        type="button" 
                        onClick={() => setNewExpense(prev => ({...prev, description: suggestion}))}
                        style={{padding:'4px 8px', fontSize:12, background:'var(--accent)', opacity:0.8}}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {showExpenses && (
          <>
            <hr/>
            <div className="grid grid-3" style={{marginTop:12}}>
              <div>
                <label htmlFor={FIELD_IDS.expenseAmount}>Amount</label>
                <input 
                  id={FIELD_IDS.expenseAmount}
                  type="number" 
                  value={newExpense.amount} 
                  onChange={e=>setNewExpense(prev => ({...prev, amount: e.target.value}))}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label htmlFor={FIELD_IDS.expenseDescription}>Description</label>
                <input 
                  id={FIELD_IDS.expenseDescription}
                  type="text" 
                  value={newExpense.description} 
                  onChange={e=>setNewExpense(prev => ({...prev, description: e.target.value}))}
                  placeholder="Expense description"
                />
              </div>
              <div>
                <label htmlFor={FIELD_IDS.expenseCategory}>Category</label>
                <select 
                  id={FIELD_IDS.expenseCategory}
                  value={newExpense.category} 
                  onChange={e=>setNewExpense(prev => ({...prev, category: e.target.value}))}
                >
                  <option value="">Select category (or use AI)</option>
                  {Object.entries(EXPENSE_CATEGORIES.rideshare || {}).map(([groupKey, group]) => (
                    <optgroup key={groupKey} label={group.label}>
                      {Object.entries(group.categories).map(([catKey, catLabel]) => (
                        <option key={catKey} value={catKey}>{catLabel}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
            <div className="row" style={{marginTop:12, gap:8}}>
              <button 
                type="button" 
                onClick={addExpense}
                disabled={!newExpense.amount || !newExpense.description.trim() || !newExpense.category}
                style={{opacity: (!newExpense.amount || !newExpense.description.trim() || !newExpense.category) ? 0.5 : 1}}
              >
                Add Expense
              </button>
              <button 
                type="button" 
                onClick={addExpenseWithAI}
                disabled={isAnalyzing || !newExpense.amount || !newExpense.description.trim()}
                style={{background: 'var(--accent)', opacity: (isAnalyzing || !newExpense.amount || !newExpense.description.trim()) ? 0.5 : 1}}
              >
                {isAnalyzing ? '🔄 AI Processing...' : '✨ Add with AI'}
              </button>
            </div>
            
            {expenseData.entries.length > 0 && (
              <>
                <hr/>
                <div style={{marginTop:12}}>
                  <h3 style={{fontSize:'16px', margin:'0 0 8px'}}>Recent Expenses</h3>
                  <div style={{maxHeight:'200px', overflowY:'auto'}}>
                    <table className="table">
                      <thead>
                        <tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th><th></th></tr>
                      </thead>
                      <tbody>
                        {expenseData.entries.slice(-10).reverse().map(expense => (
                          <tr key={expense.id}>
                            <td style={{fontSize:'12px'}}>{new Date(expense.date).toLocaleDateString()}</td>
                            <td style={{fontSize:'12px'}}>{expense.description}</td>
                            <td style={{fontSize:'12px'}}>{getCategoryLabel(expense.category, expense.businessType)}</td>
                            <td style={{fontSize:'12px'}}>{asUSD(expense.amount)}</td>
                            <td>
                              <button 
                                type="button" 
                                onClick={()=>removeExpense(expense.id)}
                                style={{padding:'4px 8px', fontSize:'12px', background:'var(--danger)', border:'none'}}
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}
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
        <div>2025 Tax Information: Form 1099-K reporting threshold is $5,000. Social Security wage base is ${SSA_WAGE_BASE_2025.toLocaleString()}.</div>
        <div><strong>Important:</strong> TaxTrail is a planning tool, not tax advice. Results are estimates only. Always consult a qualified tax professional for your specific situation.</div>
      </div>
      </div>

      {showUpgradeModal && (
        <div className="modal-backdrop" role="presentation" onClick={closeUpgradeModal}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="premium-modal-title" onClick={e=>e.stopPropagation()}>
            <button type="button" className="modal-close" onClick={closeUpgradeModal} aria-label="Close upgrade modal">×</button>
            <h3 id="premium-modal-title">Unlock premium features</h3>
            <p>
              Enter your email to unlock {pendingLabel} plus quarterly tax reminders and expert insights.
            </p>
            <div className="modal-upsell">Track mileage, vehicle expenses, and quarterly reminders for gig workers.</div>
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
              {FREELANCER_SUBSCRIBE_URL !== '#' && !FREELANCER_SUBSCRIBE_URL.includes('...') && (
                <a href={FREELANCER_SUBSCRIBE_URL} target="_blank" rel="noreferrer"><button type="button">Professional Plan</button></a>
              )}
              {PERSONAL_SUBSCRIBE_URL !== '#' && !PERSONAL_SUBSCRIBE_URL.includes('...') && (
                <a href={PERSONAL_SUBSCRIBE_URL} target="_blank" rel="noreferrer"><button type="button">Personal Plan</button></a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}