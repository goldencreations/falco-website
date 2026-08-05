# Disbursement console — frontend controller notes

## Retry payout (ClickPesa)

When a gateway disbursement attempt is reversed/rejected and the backend sets `can_retry: true`, the console shows **Retry payout**.

### Operator flow

1. Confirm in ClickPesa that the original payout was **not** paid.
2. Open **Retry payout** and read the double-payment warning.
3. Check: “I confirmed this payout was not paid in ClickPesa.”
4. Submit. The UI sends one stable `Idempotency-Key` for that reviewed action (reused on network retries of the same submit; a new key only when the dialog is opened again for a new reviewed action).

### API

`POST /disbursements/{disbursementId}/retry`

Headers:

- `Authorization: Bearer <token>`
- `Accept: application/json`
- `Content-Type: application/json`
- `Idempotency-Key: <stable unique key>`

Body:

```json
{ "confirmed_not_paid": true }
```

### Responses

- **202** — accepted for processing. Body may include `created` (boolean), `order_reference`, and `disbursement`.
  - `created === true` → “Payout retry submitted.”
  - `created === false` → “This retry was already submitted.”
- **422** — validation errors (show field messages clearly).

### Safety rules

- Show **Retry payout** only when `can_retry === true`.
- Never mark a payout completed in frontend state; only display completed when the backend returns it after final ClickPesa confirmation.
- Keep the original reversed attempt visible for audit history.
- Disable the Retry button while the request is in flight.
