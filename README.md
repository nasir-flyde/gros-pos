# Chota Bazaar POS

POS frontend for the GROS backend.

## Scripts

- `npm run dev` starts the local Vite app.
- `npm run build` creates a production build.
- `npm run lint` runs ESLint.
- `npm run test` runs lightweight Node-based frontend helper tests.

## Environment

- `VITE_API_URL` points to the GROS backend base path. Default: `http://localhost:5002/api/v1`
- Clerk authentication must be configured in the app environment used by `auth-provider.tsx`.

## API Expectations

- Authenticated requests rely on Clerk session tokens attached by [`src/lib/api.ts`](/Users/laptopbazaar/Desktop/Nasir/chota-bazaar-pos/src/lib/api.ts).
- POS checkout uses `POST /pos/checkout`.
- Order history and receipt flows use `/orders` endpoints.
- Store operations screens read from `/store-inventory`, `/movements`, `/refunds`, and `/stores`.

## Notes

- The app assumes the signed-in user has a store scope for store-specific screens.
- Some operational screens are live read-only until dedicated POS write workflows exist in the backend.
