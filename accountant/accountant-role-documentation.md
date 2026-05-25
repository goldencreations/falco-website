# Accountant Role — Frontend Documentation

## Purpose

This document defines how the Falco LMS frontend should implement the **Accountant** role (`accountant`): navigation, permissions, API usage, and boundaries versus Loan Officer, Manager, and Admin.

Use it together with the [Frontend Implementation Guide](../fronted-documentation/frontend-implementation-guide.md) and `/api/me` as the runtime permission source of truth.

---

## Role Summary

| Attribute | Value |
| --- | --- |
| Role key | `accountant` |
| Branch scope | Yes — accountants work within their assigned `branch_id` unless the user is a global administrator |
| Primary focus | Financial operations: collections, disbursements, reporting, reconciliation |
| Not responsible for | Customer onboarding, Vikundi group setup, staff administration, system settings |

---

## Core Responsibilities

The Accountant role owns these workflows end to end (within branch scope):

| Area | Frontend module | Typical API surface |
| --- | --- | --- |
| **Loan collection** | Collections queue, payment recording, collection activity log | `GET /collections/queue`, `POST /collections/activities`, `POST /payments`, `GET /payments` |
| **Loan disbursement** | Disbursement console, loan disburse actions | `GET /disbursements`, `POST /disbursements`, `PATCH /disbursements/{id}`, `POST /loans/{loan}/disburse` |
| **Report creation** | Reports hub, CSV export | `GET /reports/portfolio-summary`, `GET /reports/aging`, `GET /reports/disbursements`, `GET /reports/collections`, `GET /reports/disbursements/export` |
| **Reconciliation** | Payments reconciliation view | `GET /payments/reconciliation-summary` |

Accountants may **view** customers and loans to support these flows but must not initiate onboarding or Vikundi setup.

---

## Features Transferred from Loan Officer

The following capabilities move from **Loan Officer** to **Accountant** in the UI. Loan Officer screens for these actions must be hidden or disabled.

| Capability | Former owner | New owner | UI notes |
| --- | --- | --- | --- |
| Record loan payments | Loan Officer | Accountant | `POST /payments` — primary cashier workflow |
| Reverse payments | Loan Officer (if shown) | Accountant | `POST /payments/{payment}/reverse` — requires `payments.reverse` |
| Collections queue & activity logging | Loan Officer | Accountant | `GET /collections/queue`, `POST /collections/activities` |
| Disbursement console (approve/complete) | Loan Officer / Manager overlap | Accountant | Disbursement console routes; coordinate with Manager approval rules where product requires dual control |
| Financial reports & export | Loan Officer (if exposed) | Accountant | `GET /reports/*`, CSV export |
| Reconciliation summary | Loan Officer (if exposed) | Accountant | `GET /payments/reconciliation-summary` |

Loan Officer retains **origination** work: leads, applications (individual), product calculator, application submit/assign — but **not** the finance operations in the table above.

---

## Allowed Permissions (Expected)

Gate menus and buttons using `user.permissions` from `GET /api/me`. Expected permission keys for accountants:

| Permission | UI capability |
| --- | --- |
| `dashboard.view` | Dashboard metrics (branch-scoped) |
| `customers.view` | Read-only customer/loan context for payments and collections |
| `loans.view` | Loan detail, schedule, disbursement history |
| `payments.view` | Payment lists and detail |
| `payments.create` | Record payments |
| `payments.reverse` | Reverse verified payments (with confirmation + audit reason) |
| `collections.view` | Collections queue and activity history |
| `collections.create` | Log collection activities |
| `reports.view` | View standard reports |
| `reports.export` | Download CSV exports |
| `branches.view` | Branch context in filters (read-only) |

> **Backend alignment:** Ensure `config/permissions.php` grants `collections.*` and `loans.disburse` (or equivalent) to `accountant` if those routes return `403` today. The frontend should still hide finance actions for Loan Officer per this spec even before backend catches up.

---

## Exclusions (Must Not Access)

Hide routes, nav items, and primary actions when the signed-in user has role `accountant`:

| Excluded capability | Routes / modules to hide | Reason |
| --- | --- | --- |
| Create customers | `POST /customers`, customer “New” CTA | Onboarding is not a finance function |
| Create Vikundi groups | `POST /groups`, group “Create” CTA | Group formation is origination |
| Manage users/staff | `POST /users`, `PATCH /users/{id}`, report-access matrix | Admin-only |
| Admin-only settings | `PATCH /settings/organization`, integrations, backups, payment-channel secrets | `settings.manage` / backup permissions |
| Staff provisioning (direct) | `POST /users` | Use Manager **request** flow only if ever needed; accountants never provision |
| Leads create/convert | `POST /leads`, `POST /leads/{id}/convert` | Origination |
| Group applications (group-mode) | `POST /groups/{group}/applications` | Replaced by per-member applications (see Vikundi section) |
| Credit analysis write | Analysis assign/submit endpoints | Credit Analyst / Manager domain |
| User administration | `/users` write operations | Admin only |

Accountants **may** open customer and loan **read** screens when linked from a payment, collection, or disbursement task.

---

## Suggested Navigation

```
Dashboard
├── Metrics (branch-scoped)
Payments
├── Record payment
├── Payment detail / reverse
├── Reconciliation summary
Collections
├── Queue
├── Log activity
Disbursements
├── Console list
├── Approve / complete (per policy)
Reports
├── Portfolio summary
├── Aging
├── Disbursements report
├── Collections report
├── Export (CSV)
Loans (read-only list/detail/schedule — no “New customer” or “New group”)
```

Do not show: **Customers → Create**, **Vikundi → Create group**, **Settings → Organization**, **Users → Create**, **Backups**.

---

## API Integration Checklist

1. After login, call `GET /api/me` and cache `user.role` and `user.permissions`.
2. Build a permission map: `can(permission) => user.permissions.includes(permission)`.
3. For branch-scoped accountants, never send `branch_id` query params outside `user.branch_id` (API returns `403`).
4. On `403`, show a standard access-denied state; do not retry with elevated scope.
5. Payment reverse and disbursement approve actions should require confirmation modals and optional reason/notes fields for audit alignment.

### Example: gate payment creation

```typescript
const canRecordPayment = permissions.includes('payments.create');
const isAccountant = role === 'accountant';

// Show "Record payment" when accountant (or other roles with payments.create)
if (canRecordPayment && (isAccountant || permissions.includes('payments.create'))) {
  showRecordPaymentButton();
}
```

### Example: hide customer create

```typescript
const canCreateCustomer = permissions.includes('customers.create');
// Loan officer and manager may still create; accountant must not
if (role === 'accountant') {
  hideCustomerCreate();
} else if (canCreateCustomer) {
  showCustomerCreate();
}
```

---

## Interaction with Other Roles

| Role | How Accountant differs |
| --- | --- |
| **Loan Officer** | Officer originates (leads, individual applications); Accountant executes money movement and reporting. |
| **Manager** | Manager reviews applications and may approve disbursements per policy; Manager does **not** create staff directly — only submits provisioning requests. |
| **Admin** | Admin creates staff, manages settings, backups, and global configuration. |
| **Collections Officer** | May overlap on collections queue; product owner should clarify split if both exist in one branch. Prefer Accountant for payment + reconciliation ownership. |

---

## Vikundi (Groups) — Accountant View

- Accountants may **view** group and member lists when needed to trace a loan (`GET /groups`, `GET /groups/{id}`) if `groups.view` is granted.
- Accountants must **not** create groups or group-level applications.
- Loan applications for Vikundi members use the **individual application** flow (`POST /applications` with `customer_id` = member, optional `group_id` for linkage only) — see [Groups Controller](../fronted-documentation/groups-controller.md).

---

## Acceptance Criteria

- [ ] Accountant users land on a finance-oriented dashboard (collections, disbursements, payments, reports).
- [ ] Payment record, reverse, collections queue, disbursement console, reports, and reconciliation are available to Accountant.
- [ ] Customer create, Vikundi group create, user create, and admin settings are not visible to Accountant.
- [ ] Loan Officer UI no longer shows finance operations listed under “Features Transferred from Loan Officer”.
- [ ] All gated actions respect `403` from the API even if UI state is wrong.
- [ ] Branch filters are fixed to the user’s branch for non-global accountants.
- [ ] Vikundi member loans are created via individual `POST /applications`, not `POST /groups/{group}/applications`.

---

## Related Documentation

- [Frontend Implementation Guide](../fronted-documentation/frontend-implementation-guide.md) — global roles, staff rules, Vikundi changes
- [Payments Controller](../fronted-documentation/payments-controller.md)
- [Disbursements Controller](../fronted-documentation/disbursements-controller.md)
- [Collections Controller](../fronted-documentation/collections-controller.md)
- [Reports Controller](../fronted-documentation/reports-controller.md)
- [Reconciliation Controller](../fronted-documentation/reconciliation-controller.md)
- [Users Controller](../fronted-documentation/users-controller.md)
- [Staff Workflow Controller](../fronted-documentation/staff-workflow-controller.md)
