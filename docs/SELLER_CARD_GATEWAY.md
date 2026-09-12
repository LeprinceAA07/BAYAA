# BAYAA — Seller card billing

BAYAA keeps buyer/seller commerce separate from platform billing.

- Buyers contact sellers directly; BAYAA does not collect the sale price.
- Sellers can use Free (5% commission), Pro (500 MRU/month + 3%), or Business (1,500 MRU/month + 2%).
- Seller platform fees are intended to be paid by Visa, Mastercard, or compatible prepaid cards through a hosted checkout supplied by the merchant's bank/GIMTEL or another compliant card gateway.
- Never store PAN/CVV/card details in BAYAA. The gateway must host the card-entry page.

## Railway variables

Set only after the bank/gateway issues merchant credentials:

- CARD_GATEWAY_BASE_URL
- CARD_GATEWAY_MERCHANT_ID
- CARD_GATEWAY_API_PASSWORD
- CARD_GATEWAY_API_VERSION
- CARD_GATEWAY_CURRENCY=MRU
- CARD_GATEWAY_MERCHANT_NAME=BAYAA
- CARD_GATEWAY_RETURN_URL
- CARD_GATEWAY_CHECKOUT_URL (optional template)
- PUBLIC_BASE_URL

Do not commit real credentials to GitHub.

## Prepaid cards

The checkout should accept Visa/Mastercard prepaid cards when the acquiring gateway permits them. A BAYAA UI label may mention "Visa / Mastercard / prepaid cards", but acceptance is ultimately determined by the gateway, issuer, risk rules, and merchant configuration.
