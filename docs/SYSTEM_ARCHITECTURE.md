# Falco Financial Services Ltd - Loan Management System
## Complete System Architecture & Design Document

---

## 1. Executive Summary

This document outlines the complete architecture for an internal loan management system designed for Falco Financial Services Ltd, a Tanzanian microfinance company. The system handles the full loan lifecycle from customer registration through repayment tracking, with robust role-based access control, risk classification, and comprehensive reporting.

**Key Characteristics:**
- Internal staff-only system (no borrower access)
- Multi-level approval workflow
- Tanzania-specific payment integration (M-Pesa, Airtel Money, local banks)
- Swahili/English bilingual support
- Offline-capable for field officers
- Mobile-responsive for field work

---

## 2. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                           │
├─────────────────────────────────────────────────────────────────────┤
│  Next.js 16 App Router │ React Server Components │ Tailwind CSS     │
│  shadcn/ui Components  │ React Hook Form         │ Recharts         │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER                            │
├─────────────────────────────────────────────────────────────────────┤
│  Server Actions │ API Routes │ Middleware (Auth/RBAC)               │
│  Business Logic │ Validation │ File Upload Handler                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          DATA LAYER                                 │
├─────────────────────────────────────────────────────────────────────┤
│  Supabase PostgreSQL │ Row Level Security │ Realtime Subscriptions  │
│  Supabase Auth       │ Supabase Storage   │ Database Functions      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      EXTERNAL SERVICES                              │
├─────────────────────────────────────────────────────────────────────┤
│  Vercel Blob (Documents) │ Email Service │ SMS Gateway (Future)     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

| Layer | Technology | Justification |
|-------|------------|---------------|
| Frontend | Next.js 16 + React 19 | Server components, excellent DX, Vercel deployment |
| Styling | Tailwind CSS + shadcn/ui | Consistent design system, accessibility built-in |
| State | SWR + React Context | Efficient caching, real-time updates |
| Database | Supabase (PostgreSQL) | RLS, Auth, Realtime, Tanzania-accessible |
| File Storage | Vercel Blob | Secure document storage with signed URLs |
| Auth | Supabase Auth | Built-in RBAC, session management |
| Reporting | Recharts + jsPDF | Interactive charts, PDF export |
| Forms | React Hook Form + Zod | Type-safe validation |

---

## 4. Database Schema Design

### 4.1 Entity Relationship Diagram

```
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│      users       │       │    customers     │       │   guarantors     │
├──────────────────┤       ├──────────────────┤       ├──────────────────┤
│ id (PK)          │       │ id (PK)          │       │ id (PK)          │
│ email            │◄──────│ created_by (FK)  │       │ customer_id (FK) │
│ full_name        │       │ loan_officer (FK)│       │ full_name        │
│ role             │       │ full_name        │       │ phone            │
│ phone            │       │ phone            │       │ relationship     │
│ branch_id (FK)   │       │ national_id      │       │ address          │
│ is_active        │       │ address          │       │ occupation       │
│ created_at       │       │ occupation       │       │ employer         │
└──────────────────┘       │ payment_ref      │       │ letter_url       │
         │                 │ risk_level       │       └──────────────────┘
         │                 │ status           │                │
         │                 └──────────────────┘                │
         │                          │                          │
         │                          │                          │
         ▼                          ▼                          │
┌──────────────────┐       ┌──────────────────┐               │
│    branches      │       │    documents     │               │
├──────────────────┤       ├──────────────────┤               │
│ id (PK)          │       │ id (PK)          │               │
│ name             │       │ customer_id (FK) │◄──────────────┘
│ location         │       │ type             │
│ manager_id (FK)  │       │ file_url         │
│ is_active        │       │ uploaded_by (FK) │
└──────────────────┘       │ verified         │
                           └──────────────────┘
         
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│      loans       │       │  loan_schedule   │       │    payments      │
├──────────────────┤       ├──────────────────┤       ├──────────────────┤
│ id (PK)          │       │ id (PK)          │       │ id (PK)          │
│ customer_id (FK) │──────►│ loan_id (FK)     │◄──────│ loan_id (FK)     │
│ loan_officer (FK)│       │ installment_no   │       │ schedule_id (FK) │
│ manager_id (FK)  │       │ due_date         │       │ customer_id (FK) │
│ admin_id (FK)    │       │ principal        │       │ amount           │
│ requested_amount │       │ interest         │       │ payment_type     │
│ approved_amount  │       │ total_due        │       │ channel          │
│ interest_rate    │       │ paid_amount      │       │ reference        │
│ frequency        │       │ status           │       │ recorded_by (FK) │
│ duration_months  │       │ penalty_amount   │       │ status           │
│ status           │       └──────────────────┘       │ payment_date     │
│ disbursed_at     │                                  └──────────────────┘
└──────────────────┘
         │
         │
         ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│  field_visits    │       │   penalties      │       │   audit_logs     │
├──────────────────┤       ├──────────────────┤       ├──────────────────┤
│ id (PK)          │       │ id (PK)          │       │ id (PK)          │
│ loan_id (FK)     │       │ loan_id (FK)     │       │ user_id (FK)     │
│ customer_id (FK) │       │ schedule_id (FK) │       │ action           │
│ officer_id (FK)  │       │ amount           │       │ entity_type      │
│ visit_date       │       │ reason           │       │ entity_id        │
│ location         │       │ days_overdue     │       │ old_values       │
│ business_type    │       │ status           │       │ new_values       │
│ findings         │       │ created_at       │       │ ip_address       │
│ recommendation   │       └──────────────────┘       │ created_at       │
│ photos           │                                  └──────────────────┘
└──────────────────┘

┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│  loan_products   │       │ payment_channels │       │   settings       │
├──────────────────┤       ├──────────────────┤       ├──────────────────┤
│ id (PK)          │       │ id (PK)          │       │ id (PK)          │
│ name             │       │ name             │       │ key              │
│ min_amount       │       │ type             │       │ value            │
│ max_amount       │       │ account_number   │       │ description      │
│ interest_rate    │       │ instructions_sw  │       │ updated_by (FK)  │
│ max_duration     │       │ instructions_en  │       │ updated_at       │
│ penalty_rate     │       │ is_active        │       └──────────────────┘
│ grace_period     │       └──────────────────┘
│ is_active        │
└──────────────────┘

┌──────────────────┐       ┌──────────────────┐
│ approval_history │       │  disbursements   │
├──────────────────┤       ├──────────────────┤
│ id (PK)          │       │ id (PK)          │
│ loan_id (FK)     │       │ loan_id (FK)     │
│ user_id (FK)     │       │ amount           │
│ action           │       │ method           │
│ from_status      │       │ account_details  │
│ to_status        │       │ reference        │
│ remarks          │       │ prepared_by (FK) │
│ created_at       │       │ approved_by (FK) │
└──────────────────┘       │ status           │
                           │ disbursed_at     │
                           └──────────────────┘
```

### 4.2 Complete Table Definitions

```sql
-- ENUMS
CREATE TYPE user_role AS ENUM ('top_admin', 'manager', 'loan_officer');
CREATE TYPE customer_status AS ENUM ('pending_registration_fee', 'active', 'inactive', 'blacklisted');
CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE loan_status AS ENUM ('draft', 'pending_review', 'pending_approval', 'approved', 'disbursed', 'active', 'completed', 'defaulted', 'rejected', 'cancelled');
CREATE TYPE payment_frequency AS ENUM ('weekly', 'monthly');
CREATE TYPE payment_status AS ENUM ('pending', 'confirmed', 'reversed');
CREATE TYPE payment_type AS ENUM ('registration_fee', 'repayment', 'penalty', 'partial', 'full_settlement');
CREATE TYPE payment_channel AS ENUM ('mpesa', 'airtel_money', 'yas', 'halopesa', 'crdb', 'nmb', 'cash', 'other');
CREATE TYPE document_type AS ENUM ('national_id', 'passport_photo', 'guarantor_letter', 'street_letter', 'employment_letter', 'business_license', 'cheque', 'other');
CREATE TYPE schedule_status AS ENUM ('pending', 'partial', 'paid', 'overdue');
CREATE TYPE disbursement_status AS ENUM ('pending_approval', 'approved', 'completed', 'rejected');

-- CORE TABLES
CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    location TEXT,
    phone VARCHAR(20),
    manager_id UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_id UUID UNIQUE REFERENCES auth.users(id),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role user_role NOT NULL,
    branch_id UUID REFERENCES branches(id),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Personal Info
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    alt_phone VARCHAR(20),
    email VARCHAR(255),
    -- Address
    physical_address TEXT NOT NULL,
    street VARCHAR(255),
    ward VARCHAR(255),
    district VARCHAR(255),
    region VARCHAR(255),
    -- Identification
    national_id VARCHAR(50) UNIQUE NOT NULL,
    id_type VARCHAR(50) DEFAULT 'NIDA',
    -- Employment/Business
    occupation VARCHAR(255),
    employer_name VARCHAR(255),
    employer_address TEXT,
    employer_phone VARCHAR(20),
    employment_start_date DATE,
    monthly_income DECIMAL(15,2),
    -- Business (if self-employed)
    business_name VARCHAR(255),
    business_type VARCHAR(255),
    business_address TEXT,
    business_registration_no VARCHAR(100),
    years_in_business INTEGER,
    -- Government Employee Specific
    cheque_number VARCHAR(100),
    -- System Fields
    payment_reference VARCHAR(50) UNIQUE NOT NULL,
    registration_fee_paid BOOLEAN DEFAULT false,
    registration_fee_amount DECIMAL(15,2),
    registration_fee_paid_at TIMESTAMPTZ,
    status customer_status DEFAULT 'pending_registration_fee',
    risk_level risk_level DEFAULT 'low',
    risk_score INTEGER DEFAULT 0,
    notes TEXT,
    -- Relationships
    loan_officer_id UUID REFERENCES users(id),
    branch_id UUID REFERENCES branches(id),
    created_by UUID REFERENCES users(id) NOT NULL,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE guarantors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    alt_phone VARCHAR(20),
    relationship VARCHAR(100) NOT NULL,
    national_id VARCHAR(50),
    physical_address TEXT,
    occupation VARCHAR(255),
    employer_name VARCHAR(255),
    employer_address TEXT,
    monthly_income DECIMAL(15,2),
    letter_url TEXT,
    is_verified BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
    loan_id UUID REFERENCES loans(id),
    type document_type NOT NULL,
    name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    is_verified BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMPTZ,
    uploaded_by UUID REFERENCES users(id) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE loan_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    min_amount DECIMAL(15,2) NOT NULL,
    max_amount DECIMAL(15,2) NOT NULL,
    interest_rate DECIMAL(5,2) NOT NULL, -- Monthly rate
    min_duration INTEGER NOT NULL, -- In months
    max_duration INTEGER NOT NULL,
    allowed_frequencies payment_frequency[] DEFAULT '{weekly,monthly}',
    penalty_rate DECIMAL(5,2) DEFAULT 5.00, -- Percentage
    penalty_grace_days INTEGER DEFAULT 3,
    requires_guarantor BOOLEAN DEFAULT true,
    requires_collateral BOOLEAN DEFAULT false,
    registration_fee DECIMAL(15,2) DEFAULT 0,
    processing_fee_rate DECIMAL(5,2) DEFAULT 0, -- Percentage of loan
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID REFERENCES customers(id) NOT NULL,
    product_id UUID REFERENCES loan_products(id),
    -- Amounts
    requested_amount DECIMAL(15,2) NOT NULL,
    approved_amount DECIMAL(15,2),
    disbursed_amount DECIMAL(15,2),
    -- Terms
    interest_rate DECIMAL(5,2) NOT NULL,
    frequency payment_frequency NOT NULL,
    duration_months INTEGER NOT NULL,
    total_installments INTEGER NOT NULL,
    installment_amount DECIMAL(15,2),
    -- Calculated Fields
    total_interest DECIMAL(15,2),
    total_repayable DECIMAL(15,2),
    total_paid DECIMAL(15,2) DEFAULT 0,
    total_penalties DECIMAL(15,2) DEFAULT 0,
    outstanding_balance DECIMAL(15,2),
    -- Fees
    processing_fee DECIMAL(15,2) DEFAULT 0,
    -- Status
    status loan_status DEFAULT 'draft',
    -- Personnel
    loan_officer_id UUID REFERENCES users(id) NOT NULL,
    manager_id UUID REFERENCES users(id),
    admin_id UUID REFERENCES users(id),
    -- Dates
    application_date DATE DEFAULT CURRENT_DATE,
    approval_date DATE,
    disbursement_date DATE,
    first_payment_date DATE,
    maturity_date DATE,
    closed_date DATE,
    -- Notes
    purpose TEXT,
    officer_remarks TEXT,
    manager_remarks TEXT,
    admin_remarks TEXT,
    rejection_reason TEXT,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE field_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID REFERENCES loans(id),
    customer_id UUID REFERENCES customers(id) NOT NULL,
    officer_id UUID REFERENCES users(id) NOT NULL,
    visit_date DATE NOT NULL,
    visit_type VARCHAR(50) DEFAULT 'pre_disbursement', -- pre_disbursement, collection, verification
    -- Location Details
    location_visited TEXT NOT NULL,
    gps_coordinates VARCHAR(100),
    has_permanent_location BOOLEAN,
    -- Business Assessment
    business_type VARCHAR(255),
    business_condition VARCHAR(50), -- excellent, good, fair, poor
    estimated_daily_income DECIMAL(15,2),
    estimated_monthly_income DECIMAL(15,2),
    stock_value DECIMAL(15,2),
    -- Employment Verification
    employment_verified BOOLEAN,
    employment_letter_seen BOOLEAN,
    salary_verified BOOLEAN,
    -- Assessment
    repayment_ability VARCHAR(50), -- high, medium, low
    risk_assessment risk_level,
    -- Documentation
    photos TEXT[], -- Array of photo URLs
    -- Officer Input
    findings TEXT NOT NULL,
    recommendation VARCHAR(50), -- approve, reject, review
    recommendation_notes TEXT,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE loan_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID REFERENCES loans(id) ON DELETE CASCADE NOT NULL,
    installment_number INTEGER NOT NULL,
    due_date DATE NOT NULL,
    principal_amount DECIMAL(15,2) NOT NULL,
    interest_amount DECIMAL(15,2) NOT NULL,
    total_due DECIMAL(15,2) NOT NULL,
    paid_amount DECIMAL(15,2) DEFAULT 0,
    penalty_amount DECIMAL(15,2) DEFAULT 0,
    status schedule_status DEFAULT 'pending',
    paid_date DATE,
    days_overdue INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(loan_id, installment_number)
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) NOT NULL,
    loan_id UUID REFERENCES loans(id),
    schedule_id UUID REFERENCES loan_schedule(id),
    -- Payment Details
    payment_type payment_type NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    channel payment_channel NOT NULL,
    transaction_reference VARCHAR(255),
    payment_date DATE NOT NULL,
    -- Processing
    status payment_status DEFAULT 'pending',
    recorded_by UUID REFERENCES users(id) NOT NULL,
    confirmed_by UUID REFERENCES users(id),
    confirmed_at TIMESTAMPTZ,
    reversed_by UUID REFERENCES users(id),
    reversed_at TIMESTAMPTZ,
    reversal_reason TEXT,
    -- Notes
    notes TEXT,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE penalties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID REFERENCES loans(id) NOT NULL,
    schedule_id UUID REFERENCES loan_schedule(id),
    amount DECIMAL(15,2) NOT NULL,
    reason TEXT NOT NULL,
    days_overdue INTEGER NOT NULL,
    is_paid BOOLEAN DEFAULT false,
    paid_amount DECIMAL(15,2) DEFAULT 0,
    waived_amount DECIMAL(15,2) DEFAULT 0,
    waived_by UUID REFERENCES users(id),
    waived_at TIMESTAMPTZ,
    waiver_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE disbursements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID REFERENCES loans(id) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    method payment_channel NOT NULL,
    account_name VARCHAR(255),
    account_number VARCHAR(100),
    bank_name VARCHAR(255),
    transaction_reference VARCHAR(255),
    -- Workflow
    status disbursement_status DEFAULT 'pending_approval',
    prepared_by UUID REFERENCES users(id) NOT NULL,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    rejected_by UUID REFERENCES users(id),
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    disbursed_at TIMESTAMPTZ,
    -- Notes
    notes TEXT,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE approval_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID REFERENCES loans(id) NOT NULL,
    user_id UUID REFERENCES users(id) NOT NULL,
    action VARCHAR(50) NOT NULL, -- submitted, reviewed, approved, rejected, returned
    from_status loan_status,
    to_status loan_status,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payment_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL, -- mobile_money, bank, cash
    provider VARCHAR(100), -- mpesa, airtel, crdb, etc.
    account_number VARCHAR(100),
    account_name VARCHAR(255),
    paybill_number VARCHAR(50),
    instructions_sw TEXT, -- Swahili instructions
    instructions_en TEXT, -- English instructions
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    data_type VARCHAR(50) DEFAULT 'string', -- string, number, boolean, json
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    user_email VARCHAR(255),
    user_role user_role,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX idx_customers_payment_ref ON customers(payment_reference);
CREATE INDEX idx_customers_national_id ON customers(national_id);
CREATE INDEX idx_customers_loan_officer ON customers(loan_officer_id);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_customers_risk_level ON customers(risk_level);

CREATE INDEX idx_loans_customer ON loans(customer_id);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_loans_loan_officer ON loans(loan_officer_id);
CREATE INDEX idx_loans_number ON loans(loan_number);

CREATE INDEX idx_schedule_loan ON loan_schedule(loan_id);
CREATE INDEX idx_schedule_due_date ON loan_schedule(due_date);
CREATE INDEX idx_schedule_status ON loan_schedule(status);

CREATE INDEX idx_payments_customer ON payments(customer_id);
CREATE INDEX idx_payments_loan ON payments(loan_id);
CREATE INDEX idx_payments_date ON payments(payment_date);
CREATE INDEX idx_payments_status ON payments(status);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

-- FUNCTIONS
CREATE OR REPLACE FUNCTION generate_payment_reference()
RETURNS TEXT AS $$
BEGIN
    RETURN 'FFS' || TO_CHAR(NOW(), 'YYMM') || LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_loan_number()
RETURNS TEXT AS $$
BEGIN
    RETURN 'LN' || TO_CHAR(NOW(), 'YYYYMM') || LPAD(NEXTVAL('loan_number_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE loan_number_seq START 1;

-- TRIGGER: Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customers_timestamp BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_loans_timestamp BEFORE UPDATE ON loans FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_payments_timestamp BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_schedule_timestamp BEFORE UPDATE ON loan_schedule FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- TRIGGER: Calculate risk score
CREATE OR REPLACE FUNCTION calculate_customer_risk()
RETURNS TRIGGER AS $$
DECLARE
    late_payments INTEGER;
    total_overdue DECIMAL;
    missed_installments INTEGER;
    new_risk_score INTEGER;
    new_risk_level risk_level;
BEGIN
    -- Count late payments
    SELECT COUNT(*) INTO late_payments
    FROM payments p
    JOIN loan_schedule ls ON p.schedule_id = ls.id
    WHERE p.customer_id = NEW.customer_id
    AND p.payment_date > ls.due_date;
    
    -- Calculate total overdue
    SELECT COALESCE(SUM(total_due - paid_amount), 0) INTO total_overdue
    FROM loan_schedule ls
    JOIN loans l ON ls.loan_id = l.id
    WHERE l.customer_id = NEW.customer_id
    AND ls.status = 'overdue';
    
    -- Calculate risk score (0-100)
    new_risk_score := LEAST(100, (late_payments * 10) + (total_overdue / 10000));
    
    -- Determine risk level
    IF new_risk_score >= 70 THEN
        new_risk_level := 'critical';
    ELSIF new_risk_score >= 50 THEN
        new_risk_level := 'high';
    ELSIF new_risk_score >= 25 THEN
        new_risk_level := 'medium';
    ELSE
        new_risk_level := 'low';
    END IF;
    
    -- Update customer risk
    UPDATE customers
    SET risk_score = new_risk_score, risk_level = new_risk_level
    WHERE id = NEW.customer_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 5. Roles & Permissions Matrix

### 5.1 Permission Definitions

| Permission Code | Description |
|-----------------|-------------|
| `customers.view_own` | View customers assigned to self |
| `customers.view_all` | View all customers |
| `customers.create` | Register new customers |
| `customers.edit` | Edit customer information |
| `customers.delete` | Delete/archive customers |
| `documents.upload` | Upload customer documents |
| `documents.verify` | Verify/approve documents |
| `loans.view_own` | View loans assigned to self |
| `loans.view_all` | View all loans |
| `loans.create` | Create loan applications |
| `loans.review` | Review loan applications |
| `loans.approve` | Final approval authority |
| `loans.reject` | Reject loan applications |
| `disbursements.prepare` | Prepare disbursement records |
| `disbursements.approve` | Approve disbursements |
| `payments.record` | Record incoming payments |
| `payments.confirm` | Confirm pending payments |
| `payments.reverse` | Reverse confirmed payments |
| `penalties.apply` | Apply late payment penalties |
| `penalties.waive` | Waive penalties |
| `reports.view_own` | View reports for own portfolio |
| `reports.view_all` | View all reports |
| `reports.export` | Export reports to PDF/Excel |
| `settings.view` | View system settings |
| `settings.edit` | Modify system settings |
| `users.manage` | Create/edit/deactivate users |
| `audit.view` | View audit logs |

### 5.2 Role-Permission Matrix

| Permission | Top Admin | Manager | Loan Officer |
|------------|:---------:|:-------:|:------------:|
| `customers.view_own` | ✓ | ✓ | ✓ |
| `customers.view_all` | ✓ | ✓ | ✗ |
| `customers.create` | ✓ | ✓ | ✓ |
| `customers.edit` | ✓ | ✓ | ✓* |
| `customers.delete` | ✓ | ✗ | ✗ |
| `documents.upload` | ✓ | ✓ | ✓ |
| `documents.verify` | ✓ | ✓ | ✗ |
| `loans.view_own` | ✓ | ✓ | ✓ |
| `loans.view_all` | ✓ | ✓ | ✗ |
| `loans.create` | ✓ | ✓ | ✓ |
| `loans.review` | ✓ | ✓ | ✗ |
| `loans.approve` | ✓ | ✗ | ✗ |
| `loans.reject` | ✓ | ✓ | ✗ |
| `disbursements.prepare` | ✓ | ✓ | ✓ |
| `disbursements.approve` | ✓ | ✗ | ✗ |
| `payments.record` | ✓ | ✓ | ✓ |
| `payments.confirm` | ✓ | ✓ | ✗ |
| `payments.reverse` | ✓ | ✗ | ✗ |
| `penalties.apply` | ✓ | ✓ | ✗ |
| `penalties.waive` | ✓ | ✗ | ✗ |
| `reports.view_own` | ✓ | ✓ | ✓ |
| `reports.view_all` | ✓ | ✓ | ✗ |
| `reports.export` | ✓ | ✓ | ✓ |
| `settings.view` | ✓ | ✓ | ✗ |
| `settings.edit` | ✓ | ✗ | ✗ |
| `users.manage` | ✓ | ✗ | ✗ |
| `audit.view` | ✓ | ✓ | ✗ |

*Loan Officer can only edit customers assigned to them

---

## 6. Workflow Definitions

### 6.1 Customer Registration Workflow

```
┌─────────────────┐
│  Loan Officer   │
│  Registers      │
│  Customer       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Upload         │────►│  Generate       │
│  Documents      │     │  Payment Ref    │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│  Status:        │
│  PENDING_REG_FEE│
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Customer Pays  │────►│  Staff Records  │
│  Registration   │     │  Payment        │
│  Fee Externally │     │                 │
└─────────────────┘     └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │  Manager/Admin  │
                        │  Confirms       │
                        │  Payment        │
                        └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │  Status:        │
                        │  ACTIVE         │
                        └─────────────────┘
```

### 6.2 Loan Application & Approval Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        LOAN LIFECYCLE                                │
└─────────────────────────────────────────────────────────────────────┘

┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
│  DRAFT  │──►│ PENDING │──►│ PENDING │──►│APPROVED │──►│DISBURSED│
│         │   │ REVIEW  │   │ APPROVAL│   │         │   │         │
└─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘
     │             │              │             │             │
     │             │              │             │             ▼
     │             │              │             │       ┌─────────┐
     │             │              │             │       │  ACTIVE │
     │             │              │             │       └─────────┘
     │             │              │             │             │
     │             ▼              ▼             │             ▼
     │       ┌─────────┐   ┌─────────┐         │       ┌─────────┐
     │       │REJECTED │   │REJECTED │         │       │COMPLETED│
     │       │(Manager)│   │ (Admin) │         │       │         │
     │       └─────────┘   └─────────┘         │       └─────────┘
     │                                         │             │
     └────────────────────────────────────────►│             │
              (Can be cancelled anytime)       │             ▼
                                               │       ┌─────────┐
                                               │       │DEFAULTED│
                                               │       │         │
                                               │       └─────────┘
                                               │
                                               ▼
                                         ┌─────────┐
                                         │CANCELLED│
                                         └─────────┘

WORKFLOW STEPS:
───────────────
1. LOAN OFFICER creates loan application (DRAFT)
2. LOAN OFFICER conducts field visit
3. LOAN OFFICER submits for review (PENDING_REVIEW)
4. MANAGER reviews application and field report
   - If OK → Forwards to Admin (PENDING_APPROVAL)
   - If NOT OK → Returns to Officer or Rejects
5. TOP ADMIN reviews and makes final decision
   - If APPROVED → Loan moves to APPROVED status
   - If REJECTED → Loan is rejected with reason
6. LOAN OFFICER/MANAGER prepares disbursement
7. TOP ADMIN approves disbursement
8. Loan is DISBURSED and becomes ACTIVE
9. Repayment schedule is generated
10. Customer makes payments until COMPLETED or DEFAULTED
```

### 6.3 Payment Processing Workflow

```
┌─────────────────┐
│  Customer Pays  │
│  via Mobile/    │
│  Bank/Cash      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Staff Records  │
│  Payment in     │
│  System         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Payment Status │
│  = PENDING      │
└────────┬────────┘
         │
         ├─────────────────────────────────────┐
         ▼                                     ▼
┌─────────────────┐                   ┌─────────────────┐
│  Manager/Admin  │                   │  If 72 hours    │
│  CONFIRMS       │                   │  without action │
│  Payment        │                   │  → Auto-escalate│
└────────┬────────┘                   └─────────────────┘
         │
         ▼
┌─────────────────┐
│  Payment Status │
│  = CONFIRMED    │
└────────┬────────┘
         │
         ├─────────────────────────────────────┐
         ▼                                     ▼
┌─────────────────┐                   ┌─────────────────┐
│  Auto-allocate  │                   │  Update Loan    │
│  to Schedule    │                   │  Outstanding    │
│  Installments   │                   │  Balance        │
└─────────────────┘                   └─────────────────┘
```

### 6.4 Penalty Calculation Workflow

```
┌─────────────────┐
│  Daily Cron Job │
│  (Midnight EAT) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Check All      │
│  Unpaid         │
│  Installments   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  For each installment where:                            │
│  - due_date < TODAY                                     │
│  - status != 'paid'                                     │
│  - days_overdue > grace_period                          │
└────────┬────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  Calculate:     │
│  penalty =      │
│  (unpaid_amount │
│  × penalty_rate │
│  × days_overdue)│
│  / 30           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Create Penalty │
│  Record         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Update         │
│  schedule.status│
│  = OVERDUE      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Update         │
│  Customer Risk  │
│  Score          │
└─────────────────┘
```

---

## 7. Risk Classification Algorithm

### 7.1 Risk Score Calculation

```javascript
function calculateRiskScore(customer) {
  let score = 0;
  
  // 1. Payment History (40% weight)
  const paymentHistory = getPaymentHistory(customer.id);
  const latePaymentRatio = paymentHistory.late / paymentHistory.total;
  score += latePaymentRatio * 40;
  
  // 2. Current Overdue Amount (25% weight)
  const overdueAmount = getCurrentOverdue(customer.id);
  const overdueRatio = overdueAmount / customer.totalLoaned;
  score += Math.min(overdueRatio * 100, 25);
  
  // 3. Days Overdue (20% weight)
  const maxDaysOverdue = getMaxDaysOverdue(customer.id);
  if (maxDaysOverdue > 90) score += 20;
  else if (maxDaysOverdue > 60) score += 15;
  else if (maxDaysOverdue > 30) score += 10;
  else if (maxDaysOverdue > 14) score += 5;
  
  // 4. Missed Installments (10% weight)
  const missedInstallments = getMissedInstallments(customer.id);
  score += Math.min(missedInstallments * 2, 10);
  
  // 5. Loan Restructuring History (5% weight)
  if (hasRestructuredLoans(customer.id)) score += 5;
  
  return Math.min(100, Math.round(score));
}

function classifyRisk(score) {
  if (score >= 70) return 'critical';  // Immediate action required
  if (score >= 50) return 'high';       // Close monitoring
  if (score >= 25) return 'medium';     // Standard monitoring
  return 'low';                          // Good standing
}
```

### 7.2 Risk Level Definitions

| Level | Score Range | Action Required |
|-------|-------------|-----------------|
| **Low** | 0-24 | Standard loan terms, eligible for limit increases |
| **Medium** | 25-49 | Enhanced monitoring, restrict new loans until improvement |
| **High** | 50-69 | Intensive collection efforts, no new loans, manager review |
| **Critical** | 70-100 | Escalate to legal/recovery, blacklist consideration |

---

## 8. Module Breakdown

### 8.1 Core Modules

| Module | Description | Key Features |
|--------|-------------|--------------|
| **Authentication** | User login & session management | Supabase Auth, RBAC, session tokens |
| **User Management** | Staff account management | Create/edit users, assign roles, activate/deactivate |
| **Branch Management** | Multi-branch support | Branch CRUD, manager assignment |
| **Customer Registration** | Complete customer onboarding | Form wizard, document upload, guarantor management |
| **Document Management** | Secure document storage | Upload, preview, verify, categorize |
| **Loan Products** | Loan product configuration | Terms, rates, fees, requirements |
| **Loan Applications** | Loan request processing | Application form, assessment, workflow |
| **Field Verification** | Physical assessment module | Visit forms, photos, GPS, recommendations |
| **Approval Workflow** | Multi-level approval system | Review queue, approve/reject, audit trail |
| **Disbursement** | Loan fund release | Preparation, approval, tracking |
| **Repayment Schedule** | Installment generation | Auto-calculation, calendar view |
| **Payment Tracking** | Payment recording & allocation | Multi-channel, auto-allocation, reconciliation |
| **Penalty Management** | Late fee handling | Auto-calculation, waiver management |
| **Risk Analysis** | Customer risk assessment | Scoring, classification, alerts |
| **Reporting** | Business intelligence | Standard reports, custom queries, exports |
| **Dashboard** | Executive overview | KPIs, charts, alerts, quick actions |
| **Settings** | System configuration | Payment channels, templates, rates |
| **Audit Trail** | Activity logging | Full traceability, compliance |

### 8.2 Page Structure

```
/app
├── (auth)
│   ├── login
│   └── forgot-password
├── (dashboard)
│   ├── layout.tsx (sidebar, header)
│   ├── page.tsx (main dashboard)
│   ├── customers
│   │   ├── page.tsx (list)
│   │   ├── new/page.tsx (registration wizard)
│   │   ├── [id]/page.tsx (profile)
│   │   ├── [id]/documents/page.tsx
│   │   ├── [id]/payment-instructions/page.tsx
│   │   └── [id]/loans/page.tsx
│   ├── loans
│   │   ├── page.tsx (list with filters)
│   │   ├── new/page.tsx (application form)
│   │   ├── [id]/page.tsx (details)
│   │   ├── [id]/schedule/page.tsx
│   │   ├── [id]/payments/page.tsx
│   │   ├── pending-review/page.tsx
│   │   └── pending-approval/page.tsx
│   ├── payments
│   │   ├── page.tsx (list)
│   │   ├── new/page.tsx (record payment)
│   │   └── pending/page.tsx (confirmation queue)
│   ├── disbursements
│   │   ├── page.tsx (list)
│   │   └── pending/page.tsx (approval queue)
│   ├── field-visits
│   │   ├── page.tsx (list)
│   │   └── new/page.tsx (record visit)
│   ├── reports
│   │   ├── page.tsx (report hub)
│   │   ├── daily-collections/page.tsx
│   │   ├── loan-portfolio/page.tsx
│   │   ├── defaulters/page.tsx
│   │   ├── officer-performance/page.tsx
│   │   └── customer-report/[id]/page.tsx
│   ├── risk-analysis
│   │   └── page.tsx (risk dashboard)
│   ├── users
│   │   ├── page.tsx (list)
│   │   └── [id]/page.tsx (edit)
│   ├── settings
│   │   ├── page.tsx (general)
│   │   ├── loan-products/page.tsx
│   │   ├── payment-channels/page.tsx
│   │   └── penalties/page.tsx
│   └── audit-log
│       └── page.tsx
└── api
    └── [...] (API routes)
```

---

## 9. Dashboard Logic

### 9.1 Key Performance Indicators (KPIs)

```typescript
interface DashboardKPIs {
  // Customer Metrics
  totalCustomers: number;
  activeCustomers: number;
  pendingRegistrationFee: number;
  newCustomersThisMonth: number;
  
  // Loan Portfolio Metrics
  totalActiveLoans: number;
  totalDisbursedAmount: number;
  totalOutstandingBalance: number;
  portfolioAtRisk: number; // PAR > 30 days
  
  // Collection Metrics
  totalCollectedToday: number;
  totalCollectedThisWeek: number;
  totalCollectedThisMonth: number;
  collectionRate: number; // Expected vs Collected
  
  // Overdue Metrics
  totalOverdueAmount: number;
  totalOverdueLoans: number;
  overdueByAging: {
    '1-30': number;
    '31-60': number;
    '61-90': number;
    '90+': number;
  };
  
  // Penalty Metrics
  totalPenaltiesAccrued: number;
  totalPenaltiesCollected: number;
  
  // Workflow Metrics
  loansPendingReview: number;
  loansPendingApproval: number;
  paymentsPendingConfirmation: number;
  disbursementsPendingApproval: number;
  
  // Risk Distribution
  customersByRisk: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}
```

### 9.2 Dashboard Components by Role

**Top Admin Dashboard:**
- Full KPI overview
- All branches performance comparison
- Approval queues (loans, disbursements)
- Revenue trends chart
- Risk distribution pie chart
- Top defaulters list
- Officer performance leaderboard

**Manager Dashboard:**
- Branch-specific KPIs
- Team performance metrics
- Review queue
- Pending confirmations
- Collection targets vs actual
- Upcoming due payments

**Loan Officer Dashboard:**
- Personal portfolio summary
- My customers list
- My pending tasks
- Today's collections target
- Overdue customers (my portfolio)
- Quick actions (record payment, new customer)

---

## 10. Reports Specification

### 10.1 Standard Reports

| Report | Description | Filters | Export |
|--------|-------------|---------|--------|
| **Daily Collections** | Payments received today | Date, Officer, Channel | PDF, Excel |
| **Weekly Collections** | Week summary with daily breakdown | Week, Officer, Branch | PDF, Excel |
| **Monthly Collections** | Monthly analysis with trends | Month, Officer, Branch | PDF, Excel |
| **Loan Disbursement** | Loans disbursed in period | Date range, Officer, Product | PDF, Excel |
| **Loan Portfolio** | Active loans summary | Status, Officer, Risk level | PDF, Excel |
| **Defaulters Report** | Overdue loans analysis | Days overdue, Amount range | PDF, Excel |
| **Registration Fees** | Fee collection status | Date range, Status | PDF, Excel |
| **Penalty Report** | Penalties applied/collected | Date range, Waived/Paid | PDF, Excel |
| **Customer Risk** | Risk classification summary | Risk level, Officer | PDF, Excel |
| **Loan Aging** | Portfolio aging analysis | Age brackets | PDF, Excel |
| **Officer Performance** | Loan officer metrics | Date range, Officer | PDF, Excel |
| **Individual Customer** | Complete customer profile | Customer ID | PDF |

### 10.2 Individual Customer Report Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│                 FALCO FINANCIAL SERVICES LTD                        │
│                    CUSTOMER PROFILE REPORT                          │
│                   Generated: [Date/Time]                            │
└─────────────────────────────────────────────────────────────────────┘

1. PERSONAL INFORMATION
   ─────────────────────
   Full Name: [name]
   Phone: [phone] | Alt: [alt_phone]
   National ID: [national_id] ([id_type])
   Address: [full_address]
   Payment Reference: [payment_ref]
   Risk Level: [risk_level] (Score: [score])
   Registration Date: [date]
   Assigned Officer: [officer_name]

2. EMPLOYMENT/BUSINESS DETAILS
   ───────────────────────────
   Occupation: [occupation]
   Employer: [employer_name]
   Business: [business_name] ([business_type])
   Monthly Income: TZS [income]

3. GUARANTOR INFORMATION
   ──────────────────────
   Name: [guarantor_name]
   Phone: [guarantor_phone]
   Relationship: [relationship]
   Verified: [Yes/No]

4. DOCUMENTS
   ──────────
   ☑ National ID Copy
   ☑ Street Letter
   ☑ Guarantor Letter
   ☐ Employment Letter

5. LOAN HISTORY
   ─────────────
   ┌──────────────┬────────────┬────────────┬──────────┬───────────┐
   │ Loan Number  │ Amount     │ Disbursed  │ Status   │ Paid      │
   ├──────────────┼────────────┼────────────┼──────────┼───────────┤
   │ LN202401001  │ 500,000    │ 2024-01-15 │ Completed│ 100%      │
   │ LN202406002  │ 1,000,000  │ 2024-06-01 │ Active   │ 40%       │
   └──────────────┴────────────┴────────────┴──────────┴───────────┘

6. CURRENT LOAN DETAILS
   ─────────────────────
   Loan Number: LN202406002
   Principal: TZS 1,000,000
   Interest Rate: 10% monthly
   Total Repayable: TZS 1,300,000
   Disbursed: 2024-06-01
   Maturity: 2024-09-01
   
   Amount Paid: TZS 520,000
   Outstanding: TZS 780,000
   Penalties: TZS 15,000
   
   Next Payment Due: [date] - TZS [amount]

7. REPAYMENT SCHEDULE
   ───────────────────
   ┌────┬────────────┬───────────┬───────────┬──────────┬─────────┐
   │ #  │ Due Date   │ Amount    │ Paid      │ Status   │ Penalty │
   ├────┼────────────┼───────────┼───────────┼──────────┼─────────┤
   │ 1  │ 2024-06-15 │ 325,000   │ 325,000   │ Paid     │ -       │
   │ 2  │ 2024-07-01 │ 325,000   │ 195,000   │ Partial  │ 5,000   │
   │ 3  │ 2024-07-15 │ 325,000   │ 0         │ Overdue  │ 10,000  │
   │ 4  │ 2024-08-01 │ 325,000   │ -         │ Pending  │ -       │
   └────┴────────────┴───────────┴───────────┴──────────┴─────────┘

8. PAYMENT HISTORY
   ────────────────
   ┌────────────┬───────────┬─────────┬───────────────┬──────────┐
   │ Date       │ Amount    │ Channel │ Reference     │ Status   │
   ├────────────┼───────────┼─────────┼───────────────┼──────────┤
   │ 2024-06-14 │ 325,000   │ M-Pesa  │ QH7K9X2M4P   │ Confirmed│
   │ 2024-06-30 │ 195,000   │ Cash    │ CASH-001     │ Confirmed│
   └────────────┴───────────┴─────────┴───────────────┴──────────┘

9. FIELD VISIT SUMMARY
   ────────────────────
   Last Visit: 2024-05-28
   Location: Kariakoo Market, Dar es Salaam
   Business Type: Retail Shop
   Recommendation: Approved
   Officer Notes: Customer has stable business with good foot traffic...

10. PAYMENT INSTRUCTIONS
    ─────────────────────
    Customer Reference: FFS2406-12345
    
    M-Pesa: *150*00# → Lipa Kwa M-Pesa → [Business Number]
    Airtel Money: *150*01# → Lipia Bill → [Account]
```

---

## 11. UI/UX Recommendations

### 11.1 Design Principles

1. **Clarity First**: Every element should have a clear purpose
2. **Minimal Clicks**: Common tasks within 3 clicks
3. **Contextual Actions**: Show relevant actions based on state
4. **Progressive Disclosure**: Don't overwhelm with information
5. **Mobile-Ready**: Field officers use tablets/phones

### 11.2 Navigation Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│ ☰  FALCO LMS                                    🔔  👤 John Doe ▼  │
├──────────────┬──────────────────────────────────────────────────────┤
│              │                                                      │
│ 📊 Dashboard │  [Main Content Area]                                 │
│              │                                                      │
│ 👥 Customers │  Breadcrumb: Dashboard > Customers > John Doe       │
│   └ All      │                                                      │
│   └ New      │  ┌─────────────────────────────────────────────────┐│
│              │  │                                                 ││
│ 📋 Loans     │  │  Customer Profile / Loan Details / etc.        ││
│   └ All      │  │                                                 ││
│   └ New      │  │                                                 ││
│   └ Pending  │  │                                                 ││
│              │  │                                                 ││
│ 💰 Payments  │  └─────────────────────────────────────────────────┘│
│   └ All      │                                                      │
│   └ Record   │                                                      │
│   └ Pending  │                                                      │
│              │                                                      │
│ 📤 Disburse  │                                                      │
│              │                                                      │
│ 📊 Reports   │                                                      │
│              │                                                      │
│ ⚠️ Risk      │                                                      │
│              │                                                      │
│ ─────────── │                                                      │
│ 👤 Users     │  (Admin only)                                       │
│ ⚙️ Settings  │  (Admin only)                                       │
│ 📜 Audit Log │  (Admin/Manager)                                    │
│              │                                                      │
└──────────────┴──────────────────────────────────────────────────────┘
```

### 11.3 Component Patterns

**Status Badges:**
```
[Pending] - Yellow/Amber
[Active] - Green
[Overdue] - Red
[Completed] - Blue
[Rejected] - Gray with strikethrough
```

**Action Buttons:**
- Primary: Blue (main actions)
- Success: Green (approve, confirm)
- Danger: Red (reject, delete)
- Ghost: Secondary actions

**Data Tables:**
- Sortable columns
- Quick search
- Column filters
- Bulk actions
- Pagination (25/50/100)
- Export button

**Forms:**
- Multi-step wizards for complex flows
- Inline validation
- Auto-save drafts
- Clear error messages in Swahili/English

### 11.4 Mobile Considerations

- Collapsible sidebar
- Touch-friendly buttons (min 44px)
- Swipe actions on lists
- Offline form caching
- Camera integration for documents

---

## 12. API Structure

### 12.1 Server Actions (Recommended)

```typescript
// Customer Actions
'use server'
export async function createCustomer(data: CustomerInput)
export async function updateCustomer(id: string, data: Partial<CustomerInput>)
export async function getCustomer(id: string)
export async function getCustomers(filters: CustomerFilters)
export async function uploadDocument(customerId: string, file: File, type: DocumentType)

// Loan Actions
export async function createLoanApplication(data: LoanApplicationInput)
export async function submitForReview(loanId: string)
export async function reviewLoan(loanId: string, action: 'approve' | 'reject', remarks: string)
export async function approveLoan(loanId: string, remarks: string)
export async function rejectLoan(loanId: string, reason: string)

// Payment Actions
export async function recordPayment(data: PaymentInput)
export async function confirmPayment(paymentId: string)
export async function reversePayment(paymentId: string, reason: string)

// Disbursement Actions
export async function prepareDisbursement(loanId: string, data: DisbursementInput)
export async function approveDisbursement(disbursementId: string)
export async function rejectDisbursement(disbursementId: string, reason: string)

// Report Actions
export async function generateReport(type: ReportType, filters: ReportFilters)
export async function exportToPdf(reportData: any)
export async function exportToExcel(reportData: any)
```

### 12.2 API Routes (For External Integrations)

```
POST   /api/webhooks/payment      - Payment notification webhook
GET    /api/reports/[type]        - Generate report
POST   /api/cron/penalties        - Daily penalty calculation
POST   /api/cron/risk-update      - Risk score recalculation
```

---

## 13. Security Considerations

### 13.1 Authentication & Authorization

- Supabase Auth with email/password
- Session management with secure HTTP-only cookies
- Row Level Security (RLS) policies on all tables
- Role-based middleware protection
- Activity timeout (30 min inactivity)

### 13.2 Data Protection

- All document URLs are signed with expiration
- Sensitive fields encrypted at rest
- Audit logging for all data changes
- HTTPS only
- Input sanitization and validation

### 13.3 RLS Policy Examples

```sql
-- Users can only see customers assigned to them (unless manager/admin)
CREATE POLICY "customers_view_policy" ON customers
FOR SELECT USING (
  loan_officer_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('manager', 'top_admin')
  )
);

-- Only admins can approve disbursements
CREATE POLICY "disbursements_approve_policy" ON disbursements
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'top_admin'
  )
);
```

---

## 14. Scalability Recommendations

### 14.1 Performance Optimizations

- Database indexes on frequently queried columns
- Pagination for all list views
- Lazy loading for documents
- SWR caching for dashboard data
- Background jobs for heavy calculations

### 14.2 Future Enhancements

1. **SMS Notifications**: Payment reminders, due date alerts
2. **Mobile App**: Dedicated app for field officers
3. **M-Pesa Integration**: Real-time payment notifications
4. **Document OCR**: Auto-extract data from IDs
5. **Credit Scoring**: ML-based credit assessment
6. **Multi-tenancy**: Support multiple branches/companies
7. **Offline Mode**: Full offline capability for field work

---

## 15. Implementation Phases

### Phase 1: Core Foundation (Weeks 1-2)
- Authentication & RBAC
- User Management
- Customer Registration
- Document Upload

### Phase 2: Loan Management (Weeks 3-4)
- Loan Products
- Loan Applications
- Approval Workflow
- Disbursement

### Phase 3: Financial Tracking (Weeks 5-6)
- Repayment Schedules
- Payment Recording
- Penalty Management
- Payment Channels

### Phase 4: Analytics & Reporting (Weeks 7-8)
- Dashboard
- Standard Reports
- Risk Analysis
- Export Functionality

### Phase 5: Polish & Launch (Weeks 9-10)
- Testing & Bug Fixes
- Performance Optimization
- User Training
- Go-Live

---

*Document Version: 1.0*
*Last Updated: April 2026*
*Prepared for: Falco Financial Services Ltd, Tanzania*
