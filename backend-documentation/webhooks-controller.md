# Webhooks Controller

## Purpose

Webhooks receive payment gateway callbacks without staff bearer authentication. The endpoint validates gateway signatures, stores raw payloads in `webhook_events`, deduplicates processed references, dispatches queued processing, and returns `200` quickly for valid events.

## Endpoint

`POST /webhooks/payment?gateway=clickpesa`

No bearer token is accepted or required. The request body must include gateway checksum fields.

## Inputs

```json
{
  "event": "PAYMENT RECEIVED",
  "data": {
    "paymentReference": "PAY-REF-001",
    "orderReference": "CUS-001",
    "collectedAmount": "50000",
    "channel": "AIRTEL MONEY"
  },
  "checksum": "hmac-sha256",
  "checksumMethod": "HMAC-SHA256"
}
```

## Outputs

- Valid checksum: `200 OK` with empty JSON body.
- Invalid/missing checksum: `403`.
- Missing or unknown gateway: `422`.

## Processing

1. Resolve gateway driver from `gateway` query parameter.
2. Validate checksum through the driver.
3. Parse event into gateway-neutral fields.
4. Persist `webhook_events` row with raw payload and status `pending`.
5. If a processed event already exists for the same gateway/reference, log the new event as `duplicate` and do not dispatch.
6. Dispatch `ProcessWebhookEvent` queued job.

## ClickPesa Handlers

- `PAYMENT RECEIVED`: resolves `payment_references.reference` from `data.orderReference`, finds the customer’s payable loan, and posts payment through the same `PaymentService` used by `POST /payments`.
- `PAYMENT FAILED`: marks webhook processed with failure metadata only.
- `PAYOUT INITIATED`: updates `Disbursement.status` to `processing`; loan remains `pending_disbursement`.
- `PAYOUT SUCCESS` / `PAYOUT COMPLETED`: activates the loan, marks the application disbursed, and materializes the repayment schedule.
- `PAYOUT REVERSED` / `PAYOUT REFUNDED`: updates `Disbursement.status` to `reversed`; loan remains `pending_disbursement`.
- `DEPOSIT RECEIVED`: records the event as processed without loan action.

## Edge Cases

- Handler exceptions do not escape the job; the event is marked `failed` with `error_message`.
- Processed duplicate references are not reprocessed.
- Payout webhooks never activate loans; scheduled confirmation will handle activation later.

## Acceptance Criteria

- Invalid signatures are rejected before logging.
- Valid payloads are logged before dispatch.
- Payment webhooks reuse manual payment allocation logic.
- Initiated/reversed payout webhooks update state without activation; successful/completed payout webhooks activate the loan exactly once.
