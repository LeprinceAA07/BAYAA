# Security notes

- Never commit `.env` files, database passwords, JWT secrets, or payment provider keys.
- Use a long random `JWT_SECRET` in production.
- Keep PostgreSQL private when deployed and restrict CORS with `CLIENT_ORIGIN`.
- Payment credentials must be stored only as deployment secrets.
- This repository is an MVP foundation; before production launch, add rate limiting, request validation, audit logging, image upload validation, and HTTPS enforcement.
