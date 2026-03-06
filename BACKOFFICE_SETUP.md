# Sakura Backoffice — Setup Guide

This project is a copy of `Sakura-frontend` repurposed as the Admin Backoffice.

---

## 1. First-time Setup

```bash
# Remove build cache and installed packages from the original project
rm -rf .next node_modules

# Install dependencies fresh
npm install
```

---

## 2. Update package.json

Change the project name so it's easy to identify:

```json
{
  "name": "sakura-backoffice"
}
```

---

## 3. Environment Variables (.env)

The `.env` file can stay the same as the frontend — both projects point to the same backend API.

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:4000
JWT_SECRET=SakuraDevJWTscret
```

> If the backoffice runs on a different machine or environment, update `NEXT_PUBLIC_API_URL` to match the backend server address.

---

## 4. Change the Running Port (Optional)

By default Next.js runs on port 3000. If running both frontend and backoffice on the same machine, run backoffice on a different port:

```bash
npm run dev -- -p 3001
```

Or update `package.json` scripts:

```json
"dev": "next dev -p 3001"
```

---

## 5. Clean Up Frontend-Only Pages

Remove pages that are not needed in the backoffice:

| Path | Action |
|---|---|
| `src/app/page.tsx` | Replace with backoffice dashboard |
| `src/app/(auth)/register/` | Remove (admins don't self-register) |
| `src/components/search-link/` | Remove |

---

## 6. Pages to Build for Backoffice

These are the core pages the backoffice needs:

### Dashboard — `/`
- Order summary counts (pending, processing, shipped, completed)
- Revenue summary
- Recent activity feed

### Orders — `/orders`
- Table: all orders with filters (status, date, customer)
- Click into order → detail view
- Update order status

### Customers — `/customers`
- List all users
- View customer profile + order history

### Products — `/products`
- List, create, edit, delete products
- Upload product images

### Auction Management — `/auctions`
- View all active/closed auctions
- Manage bids submitted by customers via the `search_link` tab on the frontend

### Settings — `/settings`
- Manage admin accounts
- Site configuration

---

## 7. Role Guard

The backoffice should only be accessible to users with `role === 'admin'`.

In `src/context/auth-context.tsx`, the `user.role` field is already available after login.

Add a route guard in your layout or middleware:

```ts
// src/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('sakura_token')?.value
  if (!token) return NextResponse.redirect(new URL('/login', request.url))

  const payload = verifyToken(token)
  if (!payload || payload.role !== 'admin') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!login|_next|favicon.ico).*)'],
}
```

---

## 8. Start Development

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) (or port 3000 if not changed).

Login with the admin test account:
- **Email:** `admin@sakura.com`
- **Password:** `password123`
