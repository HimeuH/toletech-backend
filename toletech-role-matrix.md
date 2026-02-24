# Toletech — API Role Matrix

**Base URL:** `http://localhost:3000/api/v1`

**Auth:** Cookie `token` (httpOnly, set on login/verify-otp) **or** `Authorization: Bearer <token>` header.

**Roles:** `AGRICULTEUR` · `PROPRIETAIRE` · `TRANSFORMATEUR` · `AGENT` · `ADMIN`

Legend: ✅ allowed · — not allowed · 🌐 public (no auth required)

---

## AUTH

| Endpoint | Public | AGRICULTEUR | PROPRIETAIRE | TRANSFORMATEUR | AGENT | ADMIN |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `POST /auth/register` | 🌐 | 🌐 | 🌐 | 🌐 | 🌐 | 🌐 |
| `POST /auth/verify-otp` | 🌐 | 🌐 | 🌐 | 🌐 | 🌐 | 🌐 |
| `POST /auth/resend-otp` | 🌐 | 🌐 | 🌐 | 🌐 | 🌐 | 🌐 |
| `POST /auth/login` | 🌐 | 🌐 | 🌐 | 🌐 | 🌐 | 🌐 |
| `GET /auth/logout` | 🌐 | 🌐 | 🌐 | 🌐 | 🌐 | 🌐 |
| `POST /auth/password/forgot` | 🌐 | 🌐 | 🌐 | 🌐 | 🌐 | 🌐 |
| `PUT /auth/password/reset/:token` | 🌐 | 🌐 | 🌐 | 🌐 | 🌐 | 🌐 |
| `GET /auth/me` | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| `PUT /auth/me/update` | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /auth/verify-phone-change` | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| `PUT /auth/password/update` | — | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## ADMIN — User Management

| Endpoint | Public | AGRICULTEUR | PROPRIETAIRE | TRANSFORMATEUR | AGENT | ADMIN |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `GET /auth/admin/users` | — | — | — | — | — | ✅ |
| `GET /auth/admin/user/:id` | — | — | — | — | — | ✅ |
| `PUT /auth/admin/user/:id` | — | — | — | — | — | ✅ |
| `DELETE /auth/admin/user/:id` | — | — | — | — | — | ✅ |
| `POST /auth/admin/agents` | — | — | — | — | — | ✅ |

---

## STORAGES

| Endpoint | Public | AGRICULTEUR | PROPRIETAIRE | TRANSFORMATEUR | AGENT | ADMIN |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `GET /storages` | 🌐 | 🌐 | 🌐 | 🌐 | 🌐 | 🌐 |
| `GET /storages/search` | 🌐 | 🌐 | 🌐 | 🌐 | 🌐 | 🌐 |
| `GET /storages/:id` | 🌐 | 🌐 | 🌐 | 🌐 | 🌐 | 🌐 |
| `GET /storages/my` | — | — | ✅ | ✅ | ✅ | ✅ |
| `POST /storages` | — | — | ✅ | ✅ | ✅ ¹ | ✅ |
| `PUT /storages/:id` | — | — | ✅ ² | ✅ ² | ✅ ² | ✅ |
| `DELETE /storages/:id` | — | — | ✅ ² | ✅ ² | — | ✅ |
| `DELETE /storages/:id/photos` | — | — | ✅ ² | ✅ ² | — | ✅ |

> ¹ AGENT must include `ownerId` (must be a PROPRIETAIRE or TRANSFORMATEUR).
> ² Owner check enforced — only the storage owner can modify/delete (ADMIN bypasses).

---

## STORAGE SPACES

| Endpoint | Public | AGRICULTEUR | PROPRIETAIRE | TRANSFORMATEUR | AGENT | ADMIN |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `GET /storages/:id/spaces` | 🌐 | 🌐 | 🌐 | 🌐 | 🌐 | 🌐 |
| `POST /storages/:id/spaces` | — | — | ✅ ² | ✅ ² | ✅ ² | ✅ |
| `PUT /storages/:id/spaces/:spaceId` | — | — | ✅ ² | ✅ ² | — | ✅ |
| `DELETE /storages/:id/spaces/:spaceId` | — | — | ✅ ² | ✅ ² | — | ✅ |

> ² Caller must own the parent storage.

---

## RESERVATIONS

| Endpoint | Public | AGRICULTEUR | PROPRIETAIRE | TRANSFORMATEUR | AGENT | ADMIN |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `GET /reservations` | — | — | — | — | ✅ | ✅ |
| `GET /reservations/my` | — | ✅ | — | — | — | — |
| `GET /reservations/owner` | — | — | ✅ | ✅ | — | ✅ |
| `GET /reservations/search` | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /reservations/:id` | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /reservations` | — | ✅ | — | — | ✅ ³ | ✅ |
| `PUT /reservations/:id` | — | ✅ ⁴ | — | — | — | ✅ ⁵ |
| `PUT /reservations/:id/respond` | — | — | ✅ ² | ✅ ² | — | ✅ |
| `DELETE /reservations/:id` | — | — | — | — | — | ✅ |

> ³ AGENT must include `onBehalfOf` (farmerId). Farmer becomes the reservation owner; agent is recorded as `createdBy`.
> ⁴ AGRICULTEUR can only set `status: "ANNULÉ"` (if current status is EN_ATTENTE or APPROUVÉ).
> ⁵ ADMIN valid transitions: EN_ATTENTE → APPROUVÉ | REJETÉ | ANNULÉ · APPROUVÉ → CONFIRMÉ | ANNULÉ. CONFIRMÉ triggers auto-billing.

**`PUT /reservations/:id/respond` body:**
```json
{ "action": "approve" | "reject", "message": "optional owner message" }
```

---

## BILLINGS

> Billings are auto-created when a reservation reaches `CONFIRMÉ` status. No manual create endpoint.

| Endpoint | Public | AGRICULTEUR | PROPRIETAIRE | TRANSFORMATEUR | AGENT | ADMIN |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `GET /billings` | — | — | — | — | — | ✅ |
| `GET /billings/my` | — | ✅ ⁶ | ✅ ⁷ | ✅ ⁷ | — | ✅ |
| `GET /billings/storage/:storageId` | — | — | ✅ | ✅ | — | ✅ |
| `GET /billings/:id` | — | ✅ ⁶ | ✅ ⁷ | ✅ ⁷ | — | ✅ |
| `PUT /billings/:id/status` | — | — | — | — | — | ✅ |

> ⁶ AGRICULTEUR sees only their own billings.
> ⁷ PROPRIETAIRE/TRANSFORMATEUR see billings for their storages only.

**Billing status enum:** `PENDING` · `PAID` · `CANCELLED`

---

## NOTIFICATIONS

| Endpoint | Public | AGRICULTEUR | PROPRIETAIRE | TRANSFORMATEUR | AGENT | ADMIN |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `GET /notifications` | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /notifications/unread-count` | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| `PUT /notifications/read-all` | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| `PUT /notifications/:id/read` | — | ✅ | ✅ | ✅ | ✅ | ✅ |

**Notification types:** `RESERVATION_REQUESTED` · `RESERVATION_APPROVED` · `RESERVATION_REJECTED` · `RESERVATION_CANCELLED` · `RESERVATION_CONFIRMED` · `PAYMENT_DUE` · `GENERAL`

**Triggered automatically:**
| Event | Recipient | Channel |
|---|---|---|
| Reservation created | Storage owner | In-app |
| Reservation approved | Farmer | In-app + SMS |
| Reservation rejected | Farmer | In-app + SMS |
| Reservation cancelled | Storage owner | In-app |

---

## AGENT

| Endpoint | Public | AGRICULTEUR | PROPRIETAIRE | TRANSFORMATEUR | AGENT | ADMIN |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `GET /agent/users` | — | — | — | — | ✅ | — |

> Returns `{ farmers: [], owners: [] }` filtered by the agent's `assignedRegion`. Supports `?search=` by name or phone.

---

## DASHBOARD

| Endpoint | Public | AGRICULTEUR | PROPRIETAIRE | TRANSFORMATEUR | AGENT | ADMIN |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `GET /dashboard/farmer` | — | ✅ | — | — | — | — |
| `GET /dashboard/owner` | — | — | ✅ | ✅ | — | — |
| `GET /dashboard/admin` | — | — | — | — | — | ✅ |

**Response shapes:**

`/dashboard/farmer` → `{ activeReservations, pendingPayments[], recentHistory[] }`

`/dashboard/owner` → `{ totalStorages, totalSpaces, occupiedSpaces, occupationRate, pendingRequests, monthlyRevenue }`

`/dashboard/admin` → `{ users: { byRole[], newToday, newWeek, newMonth }, storages: { total }, reservations: { total, byStatus[] }, revenue: { total } }`

---

## Enum Reference

| Field | Values |
|---|---|
| `role` | `AGRICULTEUR` · `PROPRIETAIRE` · `TRANSFORMATEUR` · `AGENT` · `ADMIN` |
| `storageType` | `SILO` · `HANGAR` · `CHAMBRE_FROIDE` |
| `capacityUnit` | `M2` · `HA` · `L` · `M3` · `TONNES` |
| `pricingPeriod` | `DAILY` · `MONTHLY` · `SEASONAL` |
| `spaceStatus` | `DISPONIBLE` · `OCCUPÉ` · `MAINTENANCE` |
| `reservationStatus` | `EN_ATTENTE` · `APPROUVÉ` · `REJETÉ` · `CONFIRMÉ` · `ANNULÉ` |
| `quantityUnit` | `KG` · `TONNES` · `SACS` · `LITRES` |
| `billingStatus` | `PENDING` · `PAID` · `CANCELLED` |

---

## Standard Response Shape

```json
// Success
{ "success": true, "data": <object>, "message": "string" }

// Paginated list
{
  "success": true,
  "data": {
    "data": [],
    "count": 10,
    "totalCount": 45,
    "totalPages": 3,
    "currentPage": 1
  },
  "message": ""
}

// Auth (login / verify-otp)
{ "success": true, "user": {}, "token": "jwt_string" }

// Error
{ "success": false, "message": "error description" }
```

All paginated endpoints accept `?page=1&limit=20` query params (default limit: 20).
