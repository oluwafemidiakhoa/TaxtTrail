import { z } from 'zod'

export type BusinessType = 'ecommerce' | 'rideshare' | 'consultant'

export type ExpenseCategory = 
  // Ecommerce categories
  | 'cogs_inventory' | 'cogs_returns' | 'cogs_shipping'
  | 'shipping_postage' | 'shipping_fulfillment' | 'shipping_storage' | 'shipping_restocking'
  | 'fees_marketplace' | 'fees_payment' | 'fees_subscription'
  | 'marketing_ads' | 'marketing_influencer' | 'marketing_seo' | 'marketing_content'
  | 'software_platform' | 'software_accounting' | 'software_analytics'
  | 'operations_licenses' | 'operations_professional' | 'operations_office' | 'operations_utilities'
  // Rideshare categories
  | 'vehicle_mileage' | 'vehicle_gas' | 'vehicle_maintenance' | 'vehicle_insurance' | 'vehicle_registration'
  | 'rideshare_commissions' | 'rideshare_supplies' | 'rideshare_phone' | 'rideshare_tolls'
  | 'rideshare_professional' | 'rideshare_other'
  // Consultant categories
  | 'consultant_advertising' | 'consultant_travel' | 'consultant_meals' | 'consultant_fees'
  | 'consultant_contractors' | 'consultant_equipment' | 'consultant_insurance'
  | 'consultant_professional' | 'consultant_office' | 'consultant_rent' | 'consultant_repairs'
  | 'consultant_supplies' | 'consultant_licenses' | 'consultant_utilities' | 'consultant_education'
  | 'consultant_other'

export interface ExpenseEntry {
  id: string
  date: string
  category: ExpenseCategory
  description: string
  amount: number
  businessType: BusinessType
}

export const ExpenseEntrySchema = z.object({
  id: z.string(),
  date: z.string(),
  category: z.string() as z.ZodSchema<ExpenseCategory>,
  description: z.string().min(1),
  amount: z.number().min(0),
  businessType: z.string() as z.ZodSchema<BusinessType>,
})

export const ExpenseDataSchema = z.object({
  entries: z.array(ExpenseEntrySchema),
  businessType: z.string() as z.ZodSchema<BusinessType>,
})

export type ExpenseData = z.infer<typeof ExpenseDataSchema>

export const EXPENSE_CATEGORIES: Record<BusinessType, Record<string, { label: string; categories: Partial<Record<ExpenseCategory, string>> }>> = {
  ecommerce: {
    'Cost of Goods Sold': {
      label: 'Cost of Goods Sold',
      categories: {
        cogs_inventory: 'Inventory',
        cogs_returns: 'Returns & refunds',
        cogs_shipping: 'Shipping cost of goods to you',
      }
    },
    'Shipping & Fulfillment': {
      label: 'Shipping & Fulfillment',
      categories: {
        shipping_postage: 'Postage and courier fees',
        shipping_fulfillment: 'Fulfillment fees',
        shipping_storage: 'Storage fees',
        shipping_restocking: 'Restocking costs',
      }
    },
    'Platform & Transaction Fees': {
      label: 'Platform & Transaction Fees',
      categories: {
        fees_marketplace: 'Marketplace fees',
        fees_payment: 'Payment processor fees',
        fees_subscription: 'Subscription fees',
      }
    },
    'Marketing & Advertising': {
      label: 'Marketing & Advertising',
      categories: {
        marketing_ads: 'Paid ads',
        marketing_influencer: 'Influencer partnerships',
        marketing_seo: 'SEO tools and keyword subscriptions',
        marketing_content: 'Content creation',
      }
    },
    'Software & Tools': {
      label: 'Software & Tools',
      categories: {
        software_platform: 'Ecommerce platform fees',
        software_accounting: 'Accounting software (QuickBooks)',
        software_analytics: 'Analytics dashboards',
      }
    },
    'Business Operations': {
      label: 'Business Operations',
      categories: {
        operations_licenses: 'Business licenses & permits',
        operations_professional: 'Professional services (legal, tax prep, consultants)',
        operations_office: 'Office supplies (printer, labels, paper)',
        operations_utilities: 'Internet, phone, utilities (if home office)',
      }
    }
  },
  rideshare: {
    'Car & Vehicle Expenses': {
      label: 'Car & Vehicle Expenses',
      categories: {
        vehicle_mileage: 'Mileage (standard rate or actual)',
        vehicle_gas: 'Gas, oil changes, repairs, tires',
        vehicle_maintenance: 'Lease payments or depreciation',
        vehicle_insurance: 'Insurance (business-use portion)',
        vehicle_registration: 'Registration, license plate fees',
      }
    },
    'Platform Fees & Commissions': {
      label: 'Platform Fees & Commissions',
      categories: {
        rideshare_commissions: 'Uber, Lyft, DoorDash service fees',
      }
    },
    'Supplies & Equipment': {
      label: 'Supplies & Equipment',
      categories: {
        rideshare_supplies: 'Phone mounts, chargers, delivery bags',
        rideshare_phone: 'Cell phone bill (business portion)',
      }
    },
    'Other Expenses': {
      label: 'Other Expenses',
      categories: {
        rideshare_tolls: 'Tolls, parking, car washes',
        rideshare_professional: 'Tax prep, legal advice',
        rideshare_other: 'Background checks, roadside assistance',
      }
    }
  },
  consultant: {
    'Advertising & Marketing': {
      label: 'Advertising & Marketing',
      categories: {
        consultant_advertising: 'Website hosting, business cards, LinkedIn ads',
      }
    },
    'Travel & Meals': {
      label: 'Travel & Meals',
      categories: {
        consultant_travel: 'Mileage, airfare, hotels for client visits',
        consultant_meals: 'Meals while traveling (50% deductible)',
      }
    },
    'Fees & Commissions': {
      label: 'Fees & Commissions',
      categories: {
        consultant_fees: 'Payment processor, marketplace fees',
      }
    },
    'Contract Labor & Equipment': {
      label: 'Contract Labor & Equipment',
      categories: {
        consultant_contractors: 'Subcontractors, virtual assistants',
        consultant_equipment: 'Laptops, monitors, office furniture',
      }
    },
    'Professional Services': {
      label: 'Professional Services',
      categories: {
        consultant_insurance: 'Professional liability insurance',
        consultant_professional: 'Tax prep, legal consulting',
      }
    },
    'Office & Operations': {
      label: 'Office & Operations',
      categories: {
        consultant_office: 'Office supplies, software tools',
        consultant_rent: 'Coworking spaces, office rental',
        consultant_repairs: 'Computer servicing, equipment repairs',
        consultant_supplies: 'Books, reference materials, client deliverables',
        consultant_licenses: 'Business licenses, permits',
        consultant_utilities: 'Internet, phone, cloud storage',
      }
    },
    'Education & Development': {
      label: 'Education & Development',
      categories: {
        consultant_education: 'Courses, certifications, memberships',
        consultant_other: 'Networking events, trade journals',
      }
    }
  }
}

export function getTotalExpenses(entries: ExpenseEntry[]): number {
  return entries.reduce((total, entry) => total + entry.amount, 0)
}

export function getExpensesByCategory(entries: ExpenseEntry[], businessType: BusinessType): Record<string, ExpenseEntry[]> {
  const categorizedExpenses: Record<string, ExpenseEntry[]> = {}
  
  entries.filter(entry => entry.businessType === businessType).forEach(entry => {
    if (!categorizedExpenses[entry.category]) {
      categorizedExpenses[entry.category] = []
    }
    categorizedExpenses[entry.category].push(entry)
  })
  
  return categorizedExpenses
}

export function getCategoryLabel(category: ExpenseCategory, businessType: BusinessType): string {
  const businessCategories = EXPENSE_CATEGORIES[businessType]
  for (const group of Object.values(businessCategories)) {
    if (category in group.categories) {
      return group.categories[category] || category
    }
  }
  return category
}

export function generateExpenseId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

export function calculateMileageDeduction(miles: number, useStandardRate: boolean = true): number {
  const STANDARD_MILEAGE_RATE_2025 = 0.67 // 67 cents per mile
  return useStandardRate ? miles * STANDARD_MILEAGE_RATE_2025 : 0
}

export const defaultExpenseData: ExpenseData = {
  entries: [],
  businessType: 'consultant'
}

export function loadStoredExpenses(): ExpenseData {
  if (typeof window === 'undefined') return defaultExpenseData
  try {
    const raw = window.localStorage.getItem('qp.expenses.v1')
    if (!raw) return defaultExpenseData
    const parsed = JSON.parse(raw)
    const result = ExpenseDataSchema.safeParse(parsed)
    return result.success ? result.data : defaultExpenseData
  } catch {
    return defaultExpenseData
  }
}

export function saveExpenses(data: ExpenseData): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem('qp.expenses.v1', JSON.stringify(data))
  } catch {
    // ignore storage issues
  }
}