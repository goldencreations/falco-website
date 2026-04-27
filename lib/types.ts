// =============================================================================
// FALCO FINANCIAL SERVICES - TYPE DEFINITIONS
// Internal Loan Management System
// =============================================================================

// -----------------------------------------------------------------------------
// USER & ROLE TYPES
// -----------------------------------------------------------------------------
export type UserRole = 
  | 'super_admin'
  | 'branch_manager'
  | 'loan_officer'
  | 'credit_analyst'
  | 'collections_officer'
  | 'accountant'
  | 'customer_service';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  branch_id: string;
  phone: string;
  employee_id: string;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  region: string;
  address: string;
  phone: string;
  manager_id: string;
  is_active: boolean;
}

// -----------------------------------------------------------------------------
// CUSTOMER TYPES
// -----------------------------------------------------------------------------
export type CustomerType = 'individual' | 'business';
export type EmploymentType = 'employed' | 'self_employed' | 'business_owner' | 'retired' | 'unemployed';
export type RiskGrade = 'A' | 'B' | 'C' | 'D' | 'E';

export interface Customer {
  id: string;
  customer_number: string;
  customer_type: CustomerType;
  
  // Personal Information
  first_name: string;
  middle_name?: string;
  last_name: string;
  date_of_birth: string;
  gender: 'male' | 'female';
  national_id: string;
  passport_number?: string;
  
  // Contact Information
  phone_primary: string;
  phone_secondary?: string;
  email?: string;
  
  // Address
  physical_address: string;
  region: string;
  district: string;
  ward: string;
  
  // Employment & Income
  employment_type: EmploymentType;
  employer_name?: string;
  employer_address?: string;
  job_title?: string;
  monthly_income: number;
  other_income?: number;
  income_verified: boolean;
  
  // Business Information (for business customers)
  business_name?: string;
  business_registration_number?: string;
  business_type?: string;
  business_address?: string;
  years_in_business?: number;
  
  // Next of Kin
  next_of_kin_name: string;
  next_of_kin_relationship: string;
  next_of_kin_phone: string;
  next_of_kin_address: string;
  
  // Risk & Credit
  risk_grade: RiskGrade;
  credit_score?: number;
  is_blacklisted: boolean;
  blacklist_reason?: string;
  
  // System
  branch_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

// -----------------------------------------------------------------------------
// LOAN PRODUCT TYPES
// -----------------------------------------------------------------------------
export type InterestType = 'flat' | 'reducing_balance';
export type RepaymentFrequency = 'daily' | 'weekly' | 'bi_weekly' | 'monthly';

export interface LoanProduct {
  id: string;
  name: string;
  code: string;
  description: string;
  
  // Loan Parameters
  min_amount: number;
  max_amount: number;
  min_term_days: number;
  max_term_days: number;
  
  // Interest
  interest_rate: number; // Annual percentage
  interest_type: InterestType;
  
  // Fees
  processing_fee_percent: number;
  insurance_fee_percent: number;
  late_payment_fee_percent: number;
  
  // Requirements
  min_credit_score?: number;
  required_documents: string[];
  allowed_risk_grades: RiskGrade[];
  
  // Repayment
  repayment_frequency: RepaymentFrequency;
  grace_period_days: number;
  
  is_active: boolean;
  created_at: string;
}

// -----------------------------------------------------------------------------
// LOAN APPLICATION & LOAN TYPES
// -----------------------------------------------------------------------------
export type LoanApplicationStatus = 
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'disbursed'
  | 'cancelled';

export type LoanStatus = 
  | 'pending_disbursement'
  | 'active'
  | 'in_arrears'
  | 'defaulted'
  | 'written_off'
  | 'paid_off'
  | 'restructured';

export interface LoanApplication {
  id: string;
  application_number: string;
  customer_id: string;
  product_id: string;
  branch_id: string;
  
  // Loan Details
  requested_amount: number;
  approved_amount?: number;
  term_days: number;
  purpose: string;
  
  // Calculated Fields
  interest_amount?: number;
  total_fees?: number;
  total_repayment?: number;
  installment_amount?: number;
  
  // Collateral
  collateral_type?: string;
  collateral_description?: string;
  collateral_value?: number;
  
  // Guarantor
  guarantor_name?: string;
  guarantor_national_id?: string;
  guarantor_phone?: string;
  guarantor_address?: string;
  guarantor_relationship?: string;
  
  // Documents
  documents: LoanDocument[];
  
  // Workflow
  status: LoanApplicationStatus;
  submitted_at?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  
  // System
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface LoanDocument {
  id: string;
  name: string;
  type: string;
  url: string;
  uploaded_at: string;
  verified: boolean;
  verified_by?: string;
}

export interface Loan {
  id: string;
  loan_number: string;
  application_id: string;
  customer_id: string;
  product_id: string;
  branch_id: string;
  
  // Amounts
  principal_amount: number;
  interest_amount: number;
  total_fees: number;
  total_amount: number;
  
  // Outstanding
  principal_outstanding: number;
  interest_outstanding: number;
  fees_outstanding: number;
  total_outstanding: number;
  
  // Paid
  principal_paid: number;
  interest_paid: number;
  fees_paid: number;
  total_paid: number;
  
  // Terms
  term_days: number;
  interest_rate: number;
  installment_amount: number;
  repayment_frequency: RepaymentFrequency;
  
  // Dates
  disbursement_date: string;
  first_payment_date: string;
  maturity_date: string;
  last_payment_date?: string;
  
  // Status
  status: LoanStatus;
  days_in_arrears: number;
  risk_classification: RiskClassification;
  
  // System
  disbursed_by: string;
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------------------------------------
// REPAYMENT TYPES
// -----------------------------------------------------------------------------
export type PaymentMethod = 'cash' | 'mobile_money' | 'bank_transfer' | 'cheque';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'reversed';

export interface RepaymentSchedule {
  id: string;
  loan_id: string;
  installment_number: number;
  due_date: string;
  
  principal_due: number;
  interest_due: number;
  fees_due: number;
  total_due: number;
  
  principal_paid: number;
  interest_paid: number;
  fees_paid: number;
  total_paid: number;
  
  balance: number;
  is_paid: boolean;
  paid_date?: string;
  days_overdue: number;
}

export interface Payment {
  id: string;
  payment_number: string;
  loan_id: string;
  customer_id: string;
  
  amount: number;
  payment_method: PaymentMethod;
  reference_number: string;
  
  // Allocation
  principal_allocated: number;
  interest_allocated: number;
  fees_allocated: number;
  penalty_allocated: number;
  
  status: PaymentStatus;
  payment_date: string;
  
  // Mobile Money Details
  mobile_money_provider?: string;
  mobile_money_number?: string;
  
  notes?: string;
  received_by: string;
  created_at: string;
}

// -----------------------------------------------------------------------------
// RISK CLASSIFICATION (Bank of Tanzania Guidelines)
// -----------------------------------------------------------------------------
export type RiskClassification = 
  | 'current'           // 0 days overdue
  | 'especially_mentioned' // 1-30 days
  | 'substandard'       // 31-90 days
  | 'doubtful'          // 91-180 days
  | 'loss';             // >180 days

export interface ProvisionRate {
  classification: RiskClassification;
  min_days: number;
  max_days: number;
  provision_rate: number;
}

// -----------------------------------------------------------------------------
// COLLECTION TYPES
// -----------------------------------------------------------------------------
export type CollectionAction = 
  | 'sms_reminder'
  | 'phone_call'
  | 'field_visit'
  | 'demand_letter'
  | 'legal_notice'
  | 'restructuring_offer'
  | 'write_off_recommendation';

export interface CollectionActivity {
  id: string;
  loan_id: string;
  customer_id: string;
  
  action: CollectionAction;
  notes: string;
  outcome?: string;
  follow_up_date?: string;
  
  performed_by: string;
  performed_at: string;
}

// -----------------------------------------------------------------------------
// REPORTING TYPES
// -----------------------------------------------------------------------------
export interface DashboardMetrics {
  // Portfolio Summary
  total_portfolio: number;
  total_loans: number;
  active_loans: number;
  total_customers: number;
  
  // Disbursement
  disbursements_today: number;
  disbursements_this_month: number;
  disbursements_count_today: number;
  
  // Collections
  collections_today: number;
  collections_this_month: number;
  expected_collections_today: number;
  collection_rate: number;
  
  // Risk
  par_1_30: number; // Portfolio at Risk 1-30 days
  par_31_90: number;
  par_over_90: number;
  total_par: number;
  npl_ratio: number; // Non-Performing Loans ratio
  
  // Applications
  pending_applications: number;
  approved_today: number;
  rejected_today: number;
}

export interface PortfolioByProduct {
  product_id: string;
  product_name: string;
  loan_count: number;
  outstanding_amount: number;
  par_amount: number;
}

export interface PortfolioByBranch {
  branch_id: string;
  branch_name: string;
  loan_count: number;
  outstanding_amount: number;
  collection_rate: number;
}

export interface AgingReport {
  classification: RiskClassification;
  loan_count: number;
  outstanding_amount: number;
  provision_amount: number;
  percentage: number;
}

// -----------------------------------------------------------------------------
// AUDIT & ACTIVITY TYPES
// -----------------------------------------------------------------------------
export interface AuditLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  changes: Record<string, { old: unknown; new: unknown }>;
  performed_by: string;
  performed_at: string;
  ip_address?: string;
}

// -----------------------------------------------------------------------------
// PERMISSION MATRIX
// -----------------------------------------------------------------------------
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  super_admin: [
    'all'
  ],
  branch_manager: [
    'dashboard.view',
    'customers.view', 'customers.create', 'customers.edit',
    'loans.view', 'loans.create', 'loans.approve',
    'payments.view', 'payments.create',
    'collections.view', 'collections.create',
    'reports.view', 'reports.export',
    'users.view'
  ],
  loan_officer: [
    'dashboard.view',
    'customers.view', 'customers.create', 'customers.edit',
    'loans.view', 'loans.create',
    'payments.view', 'payments.create',
    'collections.view',
    'reports.view'
  ],
  credit_analyst: [
    'dashboard.view',
    'customers.view',
    'loans.view', 'loans.review', 'loans.approve',
    'reports.view', 'reports.export'
  ],
  collections_officer: [
    'dashboard.view',
    'customers.view',
    'loans.view',
    'payments.view', 'payments.create',
    'collections.view', 'collections.create',
    'reports.view'
  ],
  accountant: [
    'dashboard.view',
    'loans.view',
    'payments.view', 'payments.create', 'payments.reverse',
    'reports.view', 'reports.export'
  ],
  customer_service: [
    'dashboard.view',
    'customers.view', 'customers.create',
    'loans.view',
    'payments.view'
  ]
};
