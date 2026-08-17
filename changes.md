# Frontend task: Support individual and group ClickPesa receipt allocation

Update the existing **Allocate to loan** cashbook workflow so it supports both individual customers and groups.

## Important behavior

The frontend must not decide that a receipt is a group payment only because the ClickPesa payer name resembles a group name.

The payer name is only a search hint. The operator must confirm the allocation type and exact destination.

## Entry button

Rename:

`Allocate to loan`

to:

`Allocate repayment`

When clicked, open the existing allocation modal with an allocation type selector:

- Individual loan
- Group loans

If an active Falco group exactly matches the normalized ClickPesa payer name, preselect **Group loans** and show:

> Suggested group match — verify before allocating.

The operator must still confirm it.

## Receipt information

Always display immutable receipt information:

- amount;
- ClickPesa reference;
- payment date;
- payment channel/provider;
- payer/account name;
- payer phone number where available.

Do not display the payer/group name as the payment provider. For example:

- Provider: `AIRTEL BILLPAY`
- Payer: `UAMINIFU GROUP`

## Individual loan mode

Keep the existing workflow:

1. Select branch.
2. Search customer.
3. Select the customer’s active/in-arrears loan.
4. Enter verification notes.
5. Review and confirm.
6. Call:

POST `/financial-entries/{entryId}/allocate-to-loan`

```json
{
  "branch_id": "branch-dom01",
  "customer_id": 33,
  "loan_id": 81,
  "notes": "Verified against the ClickPesa merchant receipt"
}