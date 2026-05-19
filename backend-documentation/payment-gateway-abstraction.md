# Payment Gateway Abstraction

## Purpose

Payment gateway abstraction keeps ClickPesa-specific behavior behind a driver so collections, disbursements, and future webhooks can support additional gateways without changing loan or payment workflows.

## Components

| Component | Purpose |
| --- | --- |
| `PaymentGatewayInterface` | Common collection, payout, query, and webhook methods |
| `PaymentGatewayManagerInterface` | Resolves configured gateway drivers |
| `PaymentGatewayManager` | Config-driven driver resolver |
| `ClickPesaDriver` | ClickPesa implementation and checksum validation |
| `payment.php` config | Gateway driver registration and safe channel instructions |
| `payment_references` | Portable customer references by gateway |

## Config Shape

```php
[
  'default_gateway' => 'clickpesa',
  'gateways' => [
    'clickpesa' => [
      'driver' => ClickPesaDriver::class,
      'client_id' => env('CLICKPESA_CLIENT_ID'),
      'api_key' => env('CLICKPESA_API_KEY'),
      'checksum_secret' => env('CLICKPESA_CHECKSUM_SECRET'),
      'http_enabled' => false,
    ],
  ],
]
```

Secrets are never exposed through API responses.

## Safe Frontend Endpoint

`GET /settings/payment-channels`

Returns display-only channel instructions:

```json
{
  "channels": [
    {
      "gateway": "clickpesa",
      "type": "mobile_money",
      "name": "Airtel Money",
      "ussd_code": "*150*60#",
      "company_id": "47",
      "instructions": "Dial *150*60# > Lipia Bili > Chagua Kampuni > 47 > enter kumbukumbu namba",
      "metadata": {}
    }
  ]
}
```

## Behaviour

- Customer creation creates a portable `payment_references` row for the default gateway.
- Non-cash disbursements call the default gateway driver and store the gateway response under `disbursement.metadata.gateway_response`.
- ClickPesa webhook checksum validation removes `checksum` and `checksumMethod`, recursively sorts payload keys, serializes compact JSON, and compares HMAC-SHA256.
- Outbound ClickPesa methods currently return stub-safe responses unless `CLICKPESA_HTTP_ENABLED=true`; live HTTP calls can be added inside the driver without changing callers.

## Edge Cases

- Unknown gateway names throw configuration errors.
- Drivers must implement `PaymentGatewayInterface`.
- Branch-scoped users receive their own branch id in payment channel metadata.
- Existing loan/disbursement services do not reference ClickPesa directly.

## Acceptance Criteria

- Gateway code is resolved by interface/manager.
- Customer references are gateway portable.
- Disbursement code uses the gateway interface.
- Frontend receives channel instructions without secrets.
