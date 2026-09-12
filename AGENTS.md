# BAYAA agent instructions

## Paddle integration

- Use the official remote Paddle MCP servers when working on Paddle resources.
- Use `paddle-sandbox` for development and testing by default: `https://sandbox-mcp.paddle.com/mcp`.
- Use `paddle-live` only when the user explicitly requests live/production work: `https://mcp.paddle.com/mcp`.
- Never place Paddle API keys, client tokens, webhook secrets, card data, CVV, or other credentials in source files or commits. Keep them in environment variables or the provider's secret store.
- For Paddle webhooks, always verify the `Paddle-Signature` before changing seller billing state.
- Keep buyer-to-seller communication independent from BAYAA seller billing. BAYAA billing is only for seller subscriptions/fees.
- Seller billing supports Visa/Mastercard and compatible prepaid cards through the configured payment provider; do not hard-code or imply support for a specific card issuer.
- Prefer hosted checkout so BAYAA does not handle raw card details.
- Before destructive Paddle actions such as changing prices, archiving products, or canceling subscriptions, require explicit user confirmation.
- When creating or editing Paddle catalog resources in sandbox, use the Paddle MCP to inspect current API capabilities and identifiers rather than guessing endpoints or IDs.
- Verify the resulting integration and deployment after code changes.
