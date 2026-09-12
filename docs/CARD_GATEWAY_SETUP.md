# BAYAA — Visa / Mastercard seller billing

BAYAA separates buyer/seller contact from platform billing.

## Buyer flow
- Buyer contacts seller directly through the seller phone/WhatsApp shown on the listing.
- BAYAA does not collect the buyer's sale payment.

## Seller billing flow
- Free: 5% commission on eligible sales.
- Pro: 500 MRU/month, 3% commission.
- Business: 1,500 MRU/month, 2% commission.
- Platform-fee payment method: Visa / Mastercard only.

## Production gateway
The repository includes a gateway adapter under `server/card-gateway.mjs` and environment placeholders. The exact hosted-checkout/API endpoint must be supplied by the merchant's bank/GIMTEL agreement; do not invent or hard-code an endpoint.

Configure in Railway after receiving the merchant credentials:

- `CARD_GATEWAY_BASE_URL`
- `CARD_GATEWAY_MERCHANT_ID`
- `CARD_GATEWAY_API_PASSWORD`
- `CARD_GATEWAY_API_VERSION` (default `100`)
- `CARD_GATEWAY_CURRENCY` (`MRU`)
- `CARD_GATEWAY_MERCHANT_NAME` (`BAYAA`)
- `CARD_GATEWAY_RETURN_URL`
- `CARD_GATEWAY_CHECKOUT_URL` (only if the gateway supplies a custom checkout URL template)

Never commit gateway passwords, secret keys, certificates, or private credentials to GitHub.

## GIMTEL onboarding
GIMTEL's public affiliation page states that a merchant should have a commercial/service activity, a Mauritanian bank account, registration in the national commercial register, and a registered head office, and should submit the affiliation request through its bank. GIMTEL states that its network supports international card acceptance including Visa and Mastercard.
