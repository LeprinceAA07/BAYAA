# BAYAA — Seller Billing

## Business model

- Buyer and seller deal directly. BAYAA does not collect the buyer's purchase price.
- Seller `Free`: 0 MRU/month and 5% commission on declared eligible sales.
- Seller `Pro`: 500 MRU/month and 3% commission.
- Seller `Business`: 1,500 MRU/month and 2% commission.
- Seller plan payments use the configured card provider only (Visa/Mastercard and compatible prepaid cards when accepted by the provider).

## Provider architecture

Seller billing is provider-agnostic at the application boundary. The current implementation uses Paddle checkout configuration, while keeping provider credentials in environment variables rather than GitHub.

Required production variables:

- `PADDLE_CLIENT_TOKEN`
- `PADDLE_PRO_PRICE_ID`
- `PADDLE_BUSINESS_PRICE_ID`
- `PADDLE_WEBHOOK_SECRET`
- `PADDLE_ENVIRONMENT=live`

Optional test environment:

- `PADDLE_ENVIRONMENT=sandbox`

## Webhook

Configure the provider webhook to call:

`POST /api/webhooks/paddle`

BAYAA verifies the webhook signature before changing seller billing state. `sellerId` and `plan` are passed as checkout custom data, and the webhook stores the provider customer/subscription references in `seller_billing`.

## Important separation

Do not add buyer purchase amounts to seller subscription payments. Buyer-to-seller sales remain a direct contact flow. Seller billing is only for BAYAA fees.

Never store card numbers, CVV, or other raw payment credentials in BAYAA.
