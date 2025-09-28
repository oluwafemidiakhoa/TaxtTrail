import React from 'react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { taxYear2025DueDates, SSA_WAGE_BASE_2025 } from '../lib/tax'

const PERSONAL_SUBSCRIBE_URL = import.meta.env.VITE_SUBSCRIBE_PERSONAL_URL
  || import.meta.env.VITE_SUBSCRIBE_URL
  || '#'
const FREELANCER_SUBSCRIBE_URL = import.meta.env.VITE_SUBSCRIBE_FREELANCER_URL
  || import.meta.env.VITE_SUBSCRIBE_URL
  || '#'
const CONSULT_URL = import.meta.env.VITE_CONSULT_URL || '#'
const PORTAL_URL = import.meta.env.VITE_PORTAL_URL || '#'

export default function HomePage() {
  const dueDates = taxYear2025DueDates()
  const now = dayjs()
  const nextDue = dueDates.find(d => d.isAfter(now)) || (dueDates.length ? dueDates[dueDates.length-1] : now)
  const daysLeft = nextDue.diff(now, 'day')
  const firstDeadlineLabel = dueDates.length
    ? (dueDates[0].isAfter(now) ? dueDates[0].format('MMM D, YYYY') : nextDue.format('MMM D, YYYY'))
    : 'TBD'

  const ctaLinks = [
    { url: PERSONAL_SUBSCRIBE_URL, label: 'Personal Plan' },
    { url: FREELANCER_SUBSCRIBE_URL, label: 'Professional Plan' },
    { url: CONSULT_URL, label: 'Tax Consultation' },
    { url: PORTAL_URL, label: 'Billing Portal' },
  ].filter(link => link.url && link.url !== '#' && !link.url.includes('...'))

  const businessTypes = [
    {
      path: '/ecommerce',
      title: 'E-commerce Seller',
      emoji: '🛒',
      description: 'Etsy, Amazon, eBay, and online store owners',
      features: [
        'Advanced inventory tracking',
        'COGS management',
        'Platform fee categorization',
        'Shipping & fulfillment expenses'
      ]
    },
    {
      path: '/consultant',
      title: 'Solo Consultant',
      emoji: '💼',
      description: 'Freelancers, consultants, and service providers',
      features: [
        'Professional expense tracking',
        'Client entertainment deductions',
        'Travel & equipment expenses',
        'Quarterly tax consultations'
      ]
    },
    {
      path: '/gig-worker',
      title: 'Gig Worker / Rideshare',
      emoji: '🚗',
      description: 'Uber, Lyft, DoorDash, and delivery drivers',
      features: [
        'Mileage tracking',
        'Vehicle expense management',
        'Platform commission tracking',
        'Quarterly reminders'
      ]
    }
  ]

  return (
    <div className="container">
      <div className="grid grid-2" style={{alignItems:'center'}}>
        <div>
          <h1>TaxTrail</h1>
          <div className="row" style={{gap:8,flexWrap:'wrap'}}>
            <span className="badge">Next deadline: <b>{firstDeadlineLabel}</b></span>
            <span className={`badge ${daysLeft <= 30 ? 'warn' : ''}`}>Countdown: <b>{Math.max(0, daysLeft)}</b> days</span>
            <span className="badge">SSA wage base 2025: <b>${SSA_WAGE_BASE_2025.toLocaleString()}</b></span>
          </div>
          <p style={{margin:'16px 0', fontSize:'16px', lineHeight:'1.5'}}>
            Professional quarterly tax planning and business expense tracking for self-employed individuals. 
            Choose your business type below to get started with specialized features designed for your industry.
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

      <div className="card" style={{marginTop:32}}>
        <h2 style={{textAlign:'center', marginBottom:24}}>Choose Your Business Type</h2>
        <div className="grid grid-3" style={{gap:24}}>
          {businessTypes.map(businessType => (
            <Link 
              key={businessType.path} 
              to={businessType.path} 
              style={{textDecoration:'none', color:'inherit'}}
            >
              <div className="card business-type-card" style={{
                height:'100%',
                padding:24,
                borderRadius:12,
                cursor:'pointer'
              }}>
                <div style={{textAlign:'center', marginBottom:16}}>
                  <div style={{fontSize:48, marginBottom:8}}>{businessType.emoji}</div>
                  <h3 style={{margin:0, fontSize:20, fontWeight:600}}>{businessType.title}</h3>
                  <p style={{margin:'8px 0 0', fontSize:14, opacity:0.8}}>{businessType.description}</p>
                </div>
                
                <div style={{marginTop:16}}>
                  <h4 style={{fontSize:14, fontWeight:600, marginBottom:8, color:'var(--accent)'}}>Key Features:</h4>
                  <ul style={{margin:0, paddingLeft:16, fontSize:14, lineHeight:'1.6'}}>
                    {businessType.features.map((feature, idx) => (
                      <li key={idx} style={{marginBottom:4}}>{feature}</li>
                    ))}
                  </ul>
                </div>
                
                <div style={{
                  marginTop:20,
                  padding:'12px 16px',
                  background:'var(--accent)',
                  borderRadius:8,
                  textAlign:'center',
                  color:'white',
                  fontWeight:600
                }}>
                  Get Started →
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-2" style={{marginTop:32, gap:24}}>
        <div className="card">
          <h3>🤖 AI-Powered Features</h3>
          <ul style={{margin:'16px 0', paddingLeft:20, lineHeight:'1.6'}}>
            <li>Smart expense categorization with confidence scores</li>
            <li>Natural language expense entry ("bought gas for $45")</li>
            <li>Automated tax insights and recommendations</li>
            <li>Business-specific deduction suggestions</li>
            <li>Risk assessment for potential audit flags</li>
          </ul>
        </div>
        
        <div className="card">
          <h3>📊 Tax Planning Tools</h3>
          <ul style={{margin:'16px 0', paddingLeft:20, lineHeight:'1.6'}}>
            <li>2025 IRS tax brackets and standard deductions</li>
            <li>Self-employment tax calculations (OASDI & Medicare)</li>
            <li>Safe harbor planning (90%, 100%, 110% modes)</li>
            <li>Child Tax Credit & ACTC calculations</li>
            <li>PDF/CSV export with expense details</li>
          </ul>
        </div>
      </div>

      <div className="footer small" style={{marginTop:32}}>
        <div>2025 Tax Information: Form 1099-K reporting threshold is $5,000. Social Security wage base is ${SSA_WAGE_BASE_2025.toLocaleString()}.</div>
        <div><strong>Important:</strong> TaxTrail is a planning tool, not tax advice. Results are estimates only. Always consult a qualified tax professional for your specific situation.</div>
      </div>
    </div>
  )
}