import { HfInference } from '@huggingface/inference'
import { BusinessType, ExpenseCategory, EXPENSE_CATEGORIES } from './expenses'

// Initialize Hugging Face client (using free inference API)
const hf = new HfInference(import.meta.env.VITE_HF_TOKEN || undefined)

interface ExpenseCategorization {
  category: ExpenseCategory | null
  confidence: number
  reasoning: string
}

interface TaxInsight {
  type: 'warning' | 'suggestion' | 'info'
  title: string
  message: string
  impact: string
}

interface QuarterlyProjection {
  quarter: number
  projectedExpenses: number
  projectedIncome: number
  confidenceLevel: number
  recommendations: string[]
}

// AI-powered expense categorization
export async function categorizeExpense(
  description: string, 
  amount: number, 
  businessType: BusinessType
): Promise<ExpenseCategorization> {
  try {
    // Get available categories for the business type
    const availableCategories = Object.values(EXPENSE_CATEGORIES[businessType] || {})
      .flatMap(group => Object.entries(group.categories))
      .map(([key, label]) => `${key}: ${label}`)
      .join('\n')

    const prompt = `As a tax expert, categorize this business expense for a ${businessType} business:

Description: "${description}"
Amount: $${amount}

Available categories:
${availableCategories}

Respond with ONLY a JSON object in this exact format:
{
  "category": "category_key_here",
  "confidence": 0.85,
  "reasoning": "Brief explanation why this category fits"
}

Choose the most appropriate category key from the list above.`

    const response = await hf.textGeneration({
      model: 'microsoft/DialoGPT-medium',
      inputs: prompt,
      parameters: {
        max_new_tokens: 150,
        temperature: 0.3,
        return_full_text: false
      }
    })

    // Parse AI response
    const text = response.generated_text?.trim() || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        category: parsed.category || null,
        confidence: Math.min(Math.max(parsed.confidence || 0.5, 0), 1),
        reasoning: parsed.reasoning || 'AI analysis'
      }
    }
  } catch (error) {
    console.warn('AI categorization failed:', error)
  }

  // Fallback to rule-based categorization
  return ruleBased_categorizeExpense(description, amount, businessType)
}

// Rule-based fallback categorization
function ruleBased_categorizeExpense(
  description: string, 
  amount: number, 
  businessType: BusinessType
): ExpenseCategorization {
  const desc = description.toLowerCase()
  
  // Common patterns for each business type
  const patterns: Record<BusinessType, Array<{ keywords: string[], category: string }>> = {
    ecommerce: [
      { keywords: ['inventory', 'stock', 'product', 'wholesale'], category: 'cogs_inventory' },
      { keywords: ['shipping', 'postage', 'fedex', 'ups', 'usps'], category: 'shipping_postage' },
      { keywords: ['amazon', 'ebay', 'etsy', 'marketplace'], category: 'fees_marketplace' },
      { keywords: ['stripe', 'paypal', 'payment'], category: 'fees_payment' },
      { keywords: ['ads', 'advertising', 'facebook', 'google'], category: 'marketing_ads' },
      { keywords: ['quickbooks', 'accounting', 'software'], category: 'software_accounting' }
    ],
    rideshare: [
      { keywords: ['gas', 'gasoline', 'fuel'], category: 'vehicle_gas' },
      { keywords: ['uber', 'lyft', 'doordash', 'commission'], category: 'rideshare_commissions' },
      { keywords: ['phone', 'cellular', 'mobile'], category: 'rideshare_phone' },
      { keywords: ['toll', 'parking', 'car wash'], category: 'rideshare_tolls' },
      { keywords: ['charger', 'mount', 'dash cam'], category: 'rideshare_supplies' }
    ],
    consultant: [
      { keywords: ['website', 'hosting', 'domain'], category: 'consultant_advertising' },
      { keywords: ['flight', 'hotel', 'travel', 'mileage'], category: 'consultant_travel' },
      { keywords: ['meal', 'lunch', 'dinner', 'restaurant'], category: 'consultant_meals' },
      { keywords: ['laptop', 'computer', 'monitor'], category: 'consultant_equipment' },
      { keywords: ['office', 'supplies', 'stationery'], category: 'consultant_office' }
    ]
  }

  const businessPatterns = patterns[businessType] || []
  
  for (const pattern of businessPatterns) {
    if (pattern.keywords.some(keyword => desc.includes(keyword))) {
      return {
        category: pattern.category as ExpenseCategory,
        confidence: 0.7,
        reasoning: `Matched keyword pattern for ${businessType} business`
      }
    }
  }

  return {
    category: null,
    confidence: 0.3,
    reasoning: 'No clear category match found'
  }
}

// AI-powered tax insights
export async function generateTaxInsights(
  totalIncome: number,
  totalExpenses: number,
  quarterlyPayments: number[],
  businessType: BusinessType
): Promise<TaxInsight[]> {
  try {
    const prompt = `As a tax advisor, analyze this ${businessType} business financial data:

Total Income: $${totalIncome.toLocaleString()}
Total Expenses: $${totalExpenses.toLocaleString()}
Quarterly Payments: ${quarterlyPayments.map(q => `$${q.toLocaleString()}`).join(', ')}

Provide 3-5 specific tax insights as JSON array with this format:
[
  {
    "type": "warning|suggestion|info",
    "title": "Brief title",
    "message": "Detailed advice",
    "impact": "Financial impact description"
  }
]

Focus on quarterly tax planning, deduction optimization, and business-specific advice.`

    const response = await hf.textGeneration({
      model: 'microsoft/DialoGPT-medium',
      inputs: prompt,
      parameters: {
        max_new_tokens: 400,
        temperature: 0.4,
        return_full_text: false
      }
    })

    const text = response.generated_text?.trim() || ''
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (error) {
    console.warn('AI insights failed:', error)
  }

  // Fallback insights
  return generateFallbackInsights(totalIncome, totalExpenses, quarterlyPayments, businessType)
}

function generateFallbackInsights(
  totalIncome: number,
  totalExpenses: number,
  quarterlyPayments: number[],
  businessType: BusinessType
): TaxInsight[] {
  const insights: TaxInsight[] = []
  const netIncome = totalIncome - totalExpenses
  const totalQuarterlyPayments = quarterlyPayments.reduce((sum, payment) => sum + payment, 0)

  // Income vs expenses analysis
  if (totalExpenses / totalIncome > 0.7) {
    insights.push({
      type: 'warning',
      title: 'High Expense Ratio',
      message: `Your expenses are ${Math.round((totalExpenses / totalIncome) * 100)}% of income. Consider reviewing for potential audit flags.`,
      impact: 'May trigger IRS scrutiny if ratio seems unreasonable for your business type.'
    })
  }

  // Quarterly payment analysis
  if (totalQuarterlyPayments < netIncome * 0.25) {
    insights.push({
      type: 'warning',
      title: 'Underpayment Risk',
      message: 'Your quarterly payments may be too low. Consider increasing payments to avoid penalties.',
      impact: `Potential underpayment penalty of $${Math.round((netIncome * 0.25 - totalQuarterlyPayments) * 0.05)}.`
    })
  }

  // Business-specific insights
  if (businessType === 'rideshare' && totalExpenses < totalIncome * 0.3) {
    insights.push({
      type: 'suggestion',
      title: 'Track Vehicle Expenses',
      message: 'Rideshare drivers typically have 30-50% deductible expenses. Ensure you\'re tracking all vehicle costs.',
      impact: 'Could potentially deduct an additional $' + Math.round((totalIncome * 0.4) - totalExpenses).toLocaleString()
    })
  }

  if (businessType === 'ecommerce' && totalExpenses < totalIncome * 0.4) {
    insights.push({
      type: 'suggestion',
      title: 'Review COGS and Fees',
      message: 'E-commerce businesses often have 40-60% in cost of goods sold and platform fees.',
      impact: 'Review inventory costs, shipping, and marketplace fees for missed deductions.'
    })
  }

  return insights
}

// Smart expense suggestions
export async function suggestExpenses(businessType: BusinessType): Promise<string[]> {
  const suggestions: Record<BusinessType, string[]> = {
    ecommerce: [
      'Amazon seller fees',
      'PayPal transaction fees',
      'Inventory purchase',
      'Shipping supplies',
      'Facebook advertising',
      'QuickBooks subscription',
      'Product photography',
      'Warehouse storage fees'
    ],
    rideshare: [
      'Gasoline',
      'Uber/Lyft commission',
      'Car maintenance',
      'Phone mount',
      'Car insurance (business portion)',
      'Toll fees',
      'Car wash',
      'Dash cam'
    ],
    consultant: [
      'Client lunch meeting',
      'Conference registration',
      'LinkedIn Premium',
      'Business cards',
      'Home office internet',
      'Laptop purchase',
      'Professional liability insurance',
      'Coworking space membership'
    ]
  }

  return suggestions[businessType] || []
}

// Natural language expense parsing
export async function parseNaturalLanguageExpense(
  input: string,
  businessType: BusinessType
): Promise<{ description: string; amount: number; category: ExpenseCategory | null }> {
  try {
    const prompt = `Parse this natural language expense entry for a ${businessType} business:

"${input}"

Extract and respond with ONLY a JSON object in this exact format:
{
  "description": "Clean, professional description",
  "amount": 0.00,
  "category": "category_key_or_null"
}

Examples:
- "spent 50 bucks on gas" → {"description": "Gasoline", "amount": 50.00, "category": "vehicle_gas"}
- "bought office supplies for $25.99" → {"description": "Office supplies", "amount": 25.99, "category": "consultant_office"}`

    const response = await hf.textGeneration({
      model: 'microsoft/DialoGPT-medium',
      inputs: prompt,
      parameters: {
        max_new_tokens: 100,
        temperature: 0.2,
        return_full_text: false
      }
    })

    const text = response.generated_text?.trim() || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        description: parsed.description || input,
        amount: Math.max(0, parseFloat(parsed.amount) || 0),
        category: parsed.category || null
      }
    }
  } catch (error) {
    console.warn('Natural language parsing failed:', error)
  }

  // Fallback regex parsing
  const amountMatch = input.match(/\$?(\d+(?:\.\d{2})?)/);
  const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;
  
  return {
    description: input.replace(/\$?\d+(?:\.\d{2})?/, '').trim() || 'Expense',
    amount,
    category: null
  }
}

export default {
  categorizeExpense,
  generateTaxInsights,
  suggestExpenses,
  parseNaturalLanguageExpense
}