# Lot API — Backoffice

Base path: `/api/backoffice`  
Auth: Bearer token (ADMIN หรือ STAFF)

---

## 1. GET /api/backoffice/lots

รายการ lots (pagination)

**Request:** ไม่มี body

**Query params (optional):**

| Param  | Type   | Default | Description              |
|--------|--------|---------|--------------------------|
| page   | number | 1       | หน้า                     |
| limit  | number | 20      | จำนวนต่อหน้า (max 100)   |

**Response 200:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "lot_code": "LOT-2026-01",
      "start_lot_at": "2026-03-01T00:00:00.000Z",
      "end_lot_at": "2026-03-15T23:59:59.000Z",
      "arrive_at": "2026-03-25T00:00:00.000Z",
      "auction_count": 5,
      "createdAt": "2026-03-10T10:00:00.000Z",
      "updatedAt": "2026-03-10T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 10,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

## 2. POST /api/backoffice/lots

สร้าง lot

**Request body (JSON):**

| Field        | Type            | Required | Description                  |
|--------------|-----------------|----------|------------------------------|
| lot_code     | string          | ใช่      | รหัส lot (1–50 ตัว, unique) |
| start_lot_at | string (ISO date) | ใช่    | วันเริ่ม lot                 |
| end_lot_at   | string (ISO date) | ใช่    | วันตัดรอบ lot                |
| arrive_at    | string \| null  | ไม่      | วันถึงไทยโดยประมาณ          |

**Example:**
```json
{
  "lot_code": "LOT-2026-01",
  "start_lot_at": "2026-03-01T00:00:00.000Z",
  "end_lot_at": "2026-03-15T23:59:59.000Z",
  "arrive_at": "2026-03-25T00:00:00.000Z"
}
```

**Response 201:**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "lot_code": "LOT-2026-01",
    "start_lot_at": "2026-03-01T00:00:00.000Z",
    "end_lot_at": "2026-03-15T23:59:59.000Z",
    "arrive_at": "2026-03-25T00:00:00.000Z",
    "createdAt": "2026-03-10T10:00:00.000Z",
    "updatedAt": "2026-03-10T10:00:00.000Z"
  },
  "message": "Lot \"LOT-2026-01\" created"
}
```

**Error:**
- 400 — validation error
- 409 — lot_code ซ้ำ (LOT_CODE_EXISTS)

---

## 3. PATCH /api/backoffice/lots/:id

อัปเดต lot

**Path params:** `id` — lot id

**Request body (JSON):** ทุก field เป็น optional

| Field        | Type            | Description          |
|--------------|-----------------|----------------------|
| lot_code     | string          | รหัส lot             |
| start_lot_at | string (ISO date) | วันเริ่ม lot       |
| end_lot_at   | string (ISO date) | วันตัดรอบ lot      |
| arrive_at    | string \| null  | วันถึงไทยโดยประมาณ  |

**Example:**
```json
{
  "lot_code": "LOT-2026-01",
  "arrive_at": "2026-03-28T00:00:00.000Z"
}
```

**Response 200:**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "lot_code": "LOT-2026-01",
    "start_lot_at": "2026-03-01T00:00:00.000Z",
    "end_lot_at": "2026-03-15T23:59:59.000Z",
    "arrive_at": "2026-03-28T00:00:00.000Z",
    "createdAt": "2026-03-10T10:00:00.000Z",
    "updatedAt": "2026-03-10T12:00:00.000Z"
  },
  "message": "Lot updated"
}
```

**Error:**
- 400 — validation error
- 404 — lot ไม่พบ
- 409 — lot_code ซ้ำ (LOT_CODE_EXISTS)

---

## 4. PATCH /api/backoffice/auction-requests/:id/lot

กำหนด lot ให้ auction request

**Path params:** `id` — auction request id

**Request body (JSON):**

| Field  | Type      | Required | Description                                  |
|--------|-----------|----------|----------------------------------------------|
| lot_id | number \| null | ใช่  | id ของ lot หรือ null เพื่อลบ lot ออกจาก auction |

**Example (กำหนด lot):**
```json
{
  "lot_id": 1
}
```

**Example (ลบ lot):**
```json
{
  "lot_id": null
}
```

**Response 200:**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "userId": 1,
    "url": "https://...",
    "status": "tracking",
    "lot": {
      "id": 1,
      "lot_code": "LOT-2026-01",
      "start_lot_at": "2026-03-01T00:00:00.000Z",
      "end_lot_at": "2026-03-15T23:59:59.000Z",
      "arrive_at": "2026-03-25T00:00:00.000Z"
    },
    "deliveryStages": [],
    "isDeliveried": false,
    "endTime": "2026-03-20T23:59:59.000Z",
    "createdAt": "2026-03-10T10:00:00.000Z",
    "updatedAt": "2026-03-10T10:00:00.000Z"
  },
  "message": "Lot assigned"
}
```

กรณี `lot_id: null` — `lot` จะเป็น `null` และ `message` เป็น `"Lot cleared"`

**Error:**
- 400 — validation error
- 404 — auction request ไม่พบ
- 404 — lot ไม่พบ (LOT_NOT_FOUND)
