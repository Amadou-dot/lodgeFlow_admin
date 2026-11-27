# LodgeFlow Admin API Documentation

**Version:** 1.0
**Base URL:** `/api`
**Authentication:** All endpoints require Clerk authentication unless noted otherwise.

> This document describes the **admin** app (`@lodgeflow/admin`). File paths below
> (e.g. `lib/booking-pricing.ts`, `lib/validations/`) are relative to `apps/admin/`.

Response examples show selected fields. The linked schemas define the full contracts.

---

## Table of Contents

1. [Authentication](#authentication) and [staff operations](#staff-operations)
2. [Response Formats](#response-formats)
3. [Error Handling](#error-handling)
4. [Rate Limiting](#rate-limiting)
5. [Endpoints](#endpoints)
   - [Bookings](#bookings)
   - [Cabins](#cabins)
   - [Customers](#customers)
   - [Dining](#dining)
   - [Experiences](#experiences)
   - [Settings](#settings)
   - [Dashboard](#dashboard)
   - [Email Services](#email-services)
   - [Cron Jobs](#cron-jobs)

---

## Authentication

Except explicitly public or bearer-protected routes, APIs require a Clerk session with the configured LodgeFlow organization active. The server checks live organization membership and the MongoDB `StaffAccess` assignment.

**Required Headers:**

- Clerk session cookie (automatically handled by Clerk middleware)

**Application-owned access:**

- `front_desk`: booking/customer/catalog reads, booking management, guest profile edits, and payment recording.
- `manager`: front desk permissions plus catalog/settings writes, refund metadata, and audit reads.
- `admin`: all permissions, including staff assignments and destructive account/booking operations.
- Personal guests, customer memberships without a staff assignment, and unrelated organizations have no admin API access. Clerk role claims and customer metadata cannot grant access.

`requireApiAuth({ permission })` enforces the operation. Calls without a permission remain application-administrator-only. `LODGEFLOW_STAFF_ORG_ID` must be configured on the admin app. Missing configuration or failed membership lookup denies access.

**Unauthorized Response:**

```json
{
  "success": false,
  "error": "Unauthorized"
}
```

**Status Code:** `401`

---

## Staff operations

| Endpoint                                     | Permission                                          | Behavior                                                                                                                   |
| -------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/staff/access`                      | `bookings:read`                                     | Current application role and permissions                                                                                   |
| `GET /api/staff`                             | `staff:manage`                                      | Organization members and assigned application roles                                                                        |
| `PUT /api/staff`                             | `staff:manage`                                      | `{ userId, role }`, where role is `front_desk`, `manager`, `admin`, or null; self-changes rejected                         |
| `GET /api/audit`                             | `audit:read`                                        | Filters: actor, action, resourceId, from, to; page/limit; data contains events, total, page, limit                         |
| `GET /api/reservations`                      | `bookings:read`                                     | Filters: type, lifecycle, resourceId, from (inclusive), to (exclusive); page/limit; data contains rows, total, page, limit |
| `GET /api/dining-reservations/:id`           | `bookings:read`                                     | Reservation, guest name, and allowed next statuses                                                                         |
| `PATCH /api/dining-reservations/:id`         | `bookings:manage`                                   | `{ expectedStatus, status }` only; stale state returns 409                                                                 |
| `GET /api/experience-bookings/:id`           | `bookings:read`                                     | Reservation, guest name, and allowed next statuses                                                                         |
| `PATCH /api/experience-bookings/:id`         | `bookings:manage`                                   | `{ expectedStatus, status }` only; stale state returns 409                                                                 |
| `POST /api/dining-reservations/:id/payments` | `bookings:manage`, plus `refunds:issue` for refunds | Record a manual receipt or issue a Stripe refund                                                                           |
| `POST /api/experience-bookings/:id/payments` | `bookings:manage`, plus `refunds:issue` for refunds | Same contract for an experience booking                                                                                    |
| `GET /api/calendar/cabins`                   | `bookings:read`                                     | Listings and overlapping non-cancelled stays                                                                               |
| `GET /api/calendar/dining`                   | `bookings:read`                                     | Listings and seat counts per UTC date and seating time                                                                     |
| `GET /api/calendar/experiences`              | `bookings:read`                                     | Listings and participant counts per UTC date; missing cap means uncapped                                                   |

Calendars accept `start`/`end`, use a half-open UTC date window, and clamp it to 180 days.
Their response includes the effective window. Inbox/audit pagination defaults to 25 and
allows at most 100 rows. Inbox rows preserve product-native status and add a lifecycle
for cross-product filtering. Catalog joins occur after the union is paginated.

Dining transitions: pending → confirmed/cancelled; confirmed → completed/cancelled/no-show.
Experience transitions omit no-show. Terminal states cannot reopen. Status writes use
shared capacity transactions and produce audit events. Staff must refund received
funds before cancelling a paid dining or experience reservation. Legacy paid
reservations without receipts require reconciliation.

The two reservation payment endpoints take `id` (receipt UUID), `type`
(`payment` or `refund`), positive integer `amountCents`, `method`
(`cash`, `bank_transfer`, `card`, or `stripe`), and `reference`. A cash payment
can use an empty reference. Every other tender or refund needs a reference.
The `stripe` method issues refunds. Guests use Checkout to pay online. Reuse the same receipt ID on an uncertain
retry. [Staff workflow](reservation-payments.md) · [Receipt schema](../apps/admin/lib/validations/reservation-payment.ts)

Audit history records selected changed business fields and redacts free text/contact fields.
It excludes guest notes and credentials, has no TTL, and survives demo resets. Audit writes
are best-effort after successful mutations. Both cabin-booking update APIs require
`refunds:issue` for refund metadata. Issuing an online dining or experience refund
goes through its reservation payment endpoint.

---

## Response Formats

Most resource endpoints use a success or error envelope. Pagination field names
belong to the resource. Deleting a booking returns a message without a data
field, `GET /api/sales` returns an array, and successful manual email sends
return the provider object with its string `id`. Use the reader for that route.
[Response types](../apps/admin/types/api-response.ts) · [Reporting readers](../apps/admin/lib/validations/reporting-json.ts)

### Success Response (Single Item)

```json
{
  "success": true,
  "data": { ... }
}
```

### Success Response (Booking List with Pagination)

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 10,
    "totalBookings": 100,
    "limit": 10,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### Success Response (With Message)

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}
```

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": "Human readable error message",
  "details": { ... }  // Optional, for validation errors
}
```

### Validation Error Response

```json
{
  "success": false,
  "error": "Validation failed",
  "details": {
    "fieldName": ["Error message 1", "Error message 2"]
  }
}
```

**Status Code:** `400`

### Common Error Status Codes

| Status | Description                                                     |
| ------ | --------------------------------------------------------------- |
| `400`  | Bad Request - Invalid input or validation failed                |
| `401`  | Unauthorized - Missing or invalid authentication                |
| `403`  | Forbidden - Staff organization or application permission denied |
| `404`  | Not Found - Resource does not exist                             |
| `409`  | Conflict - Resource conflict (e.g., overlapping bookings)       |
| `429`  | Too Many Requests - Rate limit exceeded                         |
| `500`  | Internal Server Error - Server-side error                       |

---

## Rate Limiting

The customer-create and manual email endpoints rate-limit requests per staff user.

**Limits:**

- **Customer creation:** 10 requests per minute per user
- **Email sending:** 5 requests per minute per user

**Rate Limit Exceeded Response:**

```json
{
  "success": false,
  "error": "Too many requests. Please try again later.",
  "retryAfter": 34
}
```

**Status Code:** `429`

---

## Endpoints

---

## Bookings

### List Bookings

```
GET /api/bookings
```

Retrieves a paginated list of bookings with filtering and search capabilities.

**Query Parameters:**

| Parameter   | Type   | Default       | Description                                                                            |
| ----------- | ------ | ------------- | -------------------------------------------------------------------------------------- |
| `page`      | number | `1`           | Page number                                                                            |
| `limit`     | number | `10`          | Items per page (max: 100)                                                              |
| `status`    | string | -             | Filter by status: `unconfirmed`, `confirmed`, `checked-in`, `checked-out`, `cancelled` |
| `search`    | string | -             | Search by cabin name, customer name, or email                                          |
| `sortBy`    | string | `checkInDate` | Sort field                                                                             |
| `sortOrder` | string | `desc`        | Sort order: `asc` or `desc`                                                            |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "65a1b2c3d4e5f6a7b8c9d0e1",
      "cabin": {
        "_id": "65a1b2c3d4e5f6a7b8c9d0e2",
        "name": "Lakeside Cabin",
        "image": "https://example.com/cabin.jpg"
      },
      "customer": {
        "id": "user_2abc123def",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "checkInDate": "2024-01-15T00:00:00.000Z",
      "checkOutDate": "2024-01-20T00:00:00.000Z",
      "numNights": 5,
      "numGuests": 2,
      "totalPrice": 1500,
      "status": "confirmed",
      "isPaid": true
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 10,
    "totalBookings": 100,
    "limit": 10,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

### Create Booking

```
POST /api/bookings
```

Creates a new booking. Validates for date conflicts with existing bookings.

The server computes the price, required deposit, and outstanding balance from the
cabin and Settings. Sending a price, receipt, paid flag, or provider field on
creation returns 400. A new booking starts with no receipts and its full price
outstanding. [Booking schemas](../apps/admin/lib/validations/booking.ts) · [Pricing](../packages/database/src/booking-pricing.ts)

**Request Body:**

| Field             | Type         | Required | Description                                                    |
| ----------------- | ------------ | -------- | -------------------------------------------------------------- |
| `cabin`           | string       | Yes      | Cabin ObjectId                                                 |
| `customer`        | string       | Yes      | Clerk user ID                                                  |
| `checkInDate`     | string (ISO) | Yes      | Check-in date                                                  |
| `checkOutDate`    | string (ISO) | Yes      | Check-out date                                                 |
| `numGuests`       | number       | Yes      | Number of guests (1-50, capped by cabin capacity and settings) |
| `status`          | string       | No       | Default: `unconfirmed`                                         |
| `paymentMethod`   | string       | No       | `cash`, `card`, `bank-transfer`, `online`                      |
| `specialRequests` | string[]     | No       | Default: `[]`. List of special requests                        |
| `extras`          | object       | No       | Optional add-ons                                               |
| `observations`    | string       | No       | Special requests (max 1000 chars)                              |

**Extras Object:**

```json
{
  "hasBreakfast": false,
  "hasPets": false,
  "hasParking": false,
  "hasEarlyCheckIn": false,
  "hasLateCheckOut": false
}
```

**Example Request:**

```json
{
  "cabin": "65a1b2c3d4e5f6a7b8c9d0e2",
  "customer": "user_2abc123def",
  "checkInDate": "2024-02-01T00:00:00.000Z",
  "checkOutDate": "2024-02-05T00:00:00.000Z",
  "numGuests": 2,
  "extras": {
    "hasBreakfast": true
  }
}
```

**Success Response:** `201 Created`

```json
{
  "success": true,
  "data": {
    "_id": "65a1b2c3d4e5f6a7b8c9d0e1",
    "cabin": { ... },
    "customer": { ... },
    ...
  }
}
```

**Conflict Response:** `409 Conflict`

```json
{
  "success": false,
  "error": "The selected dates overlap with an existing booking for this cabin"
}
```

---

### Get Booking by ID

```
GET /api/bookings/[id]
```

Retrieves a single booking with populated cabin and customer data.

**Path Parameters:**

- `id` (string) - Booking ObjectId

**Response:**

```json
{
  "success": true,
  "data": {
    "_id": "65a1b2c3d4e5f6a7b8c9d0e1",
    "cabin": { ... },
    "customer": { ... },
    "checkInDate": "2024-01-15T00:00:00.000Z",
    "checkOutDate": "2024-01-20T00:00:00.000Z",
    "numNights": 5,
    "numGuests": 2,
    "totalPrice": 1500,
    "status": "confirmed",
    "isPaid": true,
    "paidAt": "2024-01-10T10:00:00.000Z",
    "stripeSessionId": "cs_test_...",
    "stripePaymentIntentId": "pi_...",
    "cancelledAt": null,
    "cancellationReason": null,
    "refundStatus": "none",
    "refundAmount": null,
    "refundedAt": null,
    "paymentConfirmationSentAt": "2024-01-10T10:01:00.000Z"
  }
}
```

---

### Update Booking

```
PUT /api/bookings
```

Updates an existing booking. Validates for date conflicts.

Supply `_id` and the fields to change. A change to the cabin, dates, party size,
or extras reprices an unpaid quote and recalculates its required deposit.
A receipt or active checkout blocks repricing. Sending derived prices,
`depositAmount`, or `remainingAmount` returns 400. The booking schemas list the
accepted status, cancellation, refund, and guest fields. [Update contract](../apps/admin/lib/validations/booking.ts)

**Response:**

```json
{
  "success": true,
  "data": { ... }
}
```

---

### Update Booking (PATCH)

```
PATCH /api/bookings/[id]
```

Performs special operations on a booking (payment recording, status changes).

**Path Parameters:**

- `id` (string) - Booking ObjectId

**Request Body (Record Payment):**

```json
{
  "recordPayment": {
    "paymentMethod": "card",
    "amountPaid": 500,
    "receiptId": "f368e207-c8c9-40b1-a241-304bc659ea21",
    "notes": "Deposit payment"
  }
}
```

`amountPaid` is a positive amount in major currency units with at most two
decimal places. The staff client supplies a UUID for `receiptId` and reuses it
when replaying the same request. Omitting it makes the server generate a new ID
for that call. [Receipt recovery](reservation-payments.md#recovery-and-historical-data)

**Request Body (Status Change):**

```json
{
  "status": "checked-in"
}
```

**Request Body (Cancellation with Refund):**

```json
{
  "status": "cancelled",
  "cancellationReason": "Guest requested cancellation",
  "refundStatus": "pending",
  "refundAmount": 500
}
```

**Request Body (Payment Metadata):**

```json
{
  "paidAt": "2024-01-10T10:00:00.000Z",
  "stripePaymentIntentId": "pi_...",
  "stripeSessionId": "cs_...",
  "paymentConfirmationSentAt": "2024-01-10T10:01:00.000Z"
}
```

**Writable PATCH Fields:**

| Field                       | Type         | Description                                                                                                                                                                                            |
| --------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `status`                    | string       | Booking status (validated transitions only)                                                                                                                                                            |
| `recordPayment`             | object       | Payment recording (see above)                                                                                                                                                                          |
| `cancellationReason`        | string       | Reason for cancellation (max 500 chars, cancelled bookings only)                                                                                                                                       |
| `cancelledAt`               | string (ISO) | Cancellation timestamp (cancelled bookings only). Auto-set to current time when status transitions to cancelled. Can be overridden in the same request or updated later on already-cancelled bookings. |
| `refundStatus`              | string       | Refund status (cancelled bookings only)                                                                                                                                                                |
| `refundAmount`              | number       | Refund amount (cancelled bookings only)                                                                                                                                                                |
| `refundedAt`                | string (ISO) | Refund timestamp (cancelled bookings only)                                                                                                                                                             |
| `paidAt`                    | string (ISO) | Payment timestamp                                                                                                                                                                                      |
| `stripePaymentIntentId`     | string       | Stripe payment intent ID (must start with `pi_`)                                                                                                                                                       |
| `stripeSessionId`           | string       | Stripe session ID (must start with `cs_`)                                                                                                                                                              |
| `paymentConfirmationSentAt` | string (ISO) | When payment confirmation was sent                                                                                                                                                                     |

**Status Transitions:**

- `unconfirmed` → `confirmed`, `cancelled`
- `confirmed` → `checked-in`, `cancelled`
- `checked-in` → `checked-out`, `cancelled`
- `checked-out` → (terminal)
- `cancelled` → (terminal)

**Response:**

```json
{
  "success": true,
  "data": {
    "...": "...",
    "checkInTime": "2024-01-15T14:30:00.000Z",
    "checkOutTime": "2024-01-18T11:05:00.000Z",
    "paidAt": "2024-01-10T10:00:00.000Z",
    "stripeSessionId": "cs_test_...",
    "stripePaymentIntentId": "pi_...",
    "cancelledAt": null,
    "cancellationReason": null,
    "refundStatus": "none",
    "refundAmount": null,
    "refundedAt": null,
    "paymentConfirmationSentAt": "2024-01-10T10:01:00.000Z"
  }
}
```

---

### Delete Booking

```
DELETE /api/bookings?id={bookingId}
```

Deletes a booking by ID.

**Query Parameters:**

- `id` (string) - Booking ObjectId

**Response:**

```json
{
  "success": true,
  "message": "Booking deleted successfully"
}
```

---

### Find Booking by Email

```
GET /api/bookings/by-email?email={email}
```

Finds the most recent booking for a customer by email address.

**Query Parameters:**

- `email` (string) - Customer email address

**Success Response:**

```json
{
  "success": true,
  "data": { ... }
}
```

**Not Found Response:** `404`

```json
{
  "success": false,
  "error": "Booking not found for this email"
}
```

---

## Cabins

Collection writes and reporting also support these routes.

| Endpoint                     | Behavior                                                                                                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/cabins/stats`      | Catalog totals, capacity, and pricing statistics                                                                                                           |
| `PUT /api/cabins`            | Update the cabin identified by the request body's `_id`                                                                                                    |
| `DELETE /api/cabins?id={id}` | Delete the cabin identified by the query parameter                                                                                                         |
| `POST /api/cabins/bulk`      | Supply `delete` or `update-discount` and 1–50 IDs. Discount updates also require `discount`. [Request schema](../apps/admin/lib/validations/bulk-cabin.ts) |

### List Cabins

```
GET /api/cabins
```

Retrieves cabins with filtering and search.

**Query Parameters:**

| Parameter   | Type   | Default | Description                                                        |
| ----------- | ------ | ------- | ------------------------------------------------------------------ |
| `search`    | string | -       | Search by cabin name                                               |
| `capacity`  | string | -       | `small` (1-3), `medium` (4-7), `large` (8+)                        |
| `discount`  | string | -       | `with` (has discount), `without` (no discount)                     |
| `filter`    | string | -       | Legacy: `with-discount`, `no-discount`, `small`, `medium`, `large` |
| `status`    | string | All     | `active`, `maintenance`, or `inactive`                             |
| `sortBy`    | string | `name`  | Sort field                                                         |
| `sortOrder` | string | `asc`   | Sort order: `asc` or `desc`                                        |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "65a1b2c3d4e5f6a7b8c9d0e2",
      "name": "Lakeside Cabin",
      "description": "A beautiful cabin by the lake...",
      "capacity": 4,
      "price": 200,
      "discount": 20,
      "image": "https://example.com/cabin.jpg",
      "amenities": ["WiFi", "Heating"],
      "status": "active"
    }
  ]
}
```

---

### Create Cabin

```
POST /api/cabins
```

Creates a new cabin.

**Request Body:**

| Field         | Type     | Required | Description                                      |
| ------------- | -------- | -------- | ------------------------------------------------ |
| `name`        | string   | Yes      | Cabin name (1-100 chars)                         |
| `description` | string   | Yes      | Description (10-1000 chars)                      |
| `capacity`    | number   | Yes      | Guest capacity (1-20)                            |
| `price`       | number   | Yes      | Price per night (> 0)                            |
| `discount`    | number   | No       | Discount amount (must be < price)                |
| `image`       | string   | Yes      | Main image URL                                   |
| `amenities`   | string[] | No       | Amenity names, such as `["WiFi", "Fireplace"]`   |
| `status`      | string   | No       | `active` (default), `maintenance`, or `inactive` |

The cabin schema also accepts gallery URLs, bedrooms, bathrooms, floor area,
minimum nights, and the extra guest fee. [Cabin schema](../apps/admin/lib/validations/cabin.ts)

**Success Response:** `201 Created`

---

### Get Cabin by ID

```
GET /api/cabins/[id]
```

**Path Parameters:**

- `id` (string) - Cabin ObjectId

**Response:**

```json
{
  "success": true,
  "data": { ... }
}
```

---

### Update Cabin

```
PUT /api/cabins/[id]
```

**Path Parameters:**

- `id` (string) - Cabin ObjectId

**Request Body:** Fields to update

**Validation:** Discount must be less than price

---

### Delete Cabin

```
DELETE /api/cabins/[id]
```

**Path Parameters:**

- `id` (string) - Cabin ObjectId

---

### Get Cabin Availability

```
GET /api/cabins/[id]/availability
```

Returns unavailable date ranges for a cabin. When editing a booking, supply its ObjectId as `excludeBookingId` to exclude its own stay.

**Path Parameters:**

- `id` (string) - Cabin ObjectId

**Query Parameters:**

| Parameter   | Type         | Default   | Description       |
| ----------- | ------------ | --------- | ----------------- |
| `startDate` | string (ISO) | today     | Query range start |
| `endDate`   | string (ISO) | +6 months | Query range end   |

**Response:**

```json
{
  "success": true,
  "data": {
    "cabinId": "65a1b2c3d4e5f6a7b8c9d0e2",
    "unavailableDates": [
      { "start": "2024-01-15", "end": "2024-01-20" },
      { "start": "2024-02-01", "end": "2024-02-05" }
    ],
    "queryRange": {
      "start": "2024-01-01",
      "end": "2024-07-01"
    }
  }
}
```

---

## Customers

### List Customers

```
GET /api/customers
```

Retrieves customers from Clerk with booking statistics. The wire fields include
`first_name`, `last_name`, `image_url`, and ISO `created_at`. Pagination uses
`totalCustomers`. [Customer list schema](../apps/admin/lib/validations/customer-list.ts)

**Query Parameters:**

| Parameter   | Type   | Default      | Description                                                                                  |
| ----------- | ------ | ------------ | -------------------------------------------------------------------------------------------- |
| `page`      | number | `1`          | Page number                                                                                  |
| `limit`     | number | `10`         | Items per page                                                                               |
| `search`    | string | -            | Search by name or email                                                                      |
| `sortBy`    | string | `created_at` | Sort field: `name`, `email`, `created_at`, `updated_at`, `last_sign_in_at`, `last_active_at` |
| `sortOrder` | string | `desc`       | Sort order                                                                                   |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "user_2abc123def",
      "first_name": "John",
      "last_name": "Doe",
      "name": "John Doe",
      "email": "john@example.com",
      "image_url": "https://...",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": { ... }
}
```

---

### Create Customer

```
POST /api/customers
```

Creates a new customer in Clerk with extended profile data.

**Request Body:**

| Field              | Type   | Required | Description                            |
| ------------------ | ------ | -------- | -------------------------------------- |
| `firstName`        | string | Yes      | First name (1-50 chars)                |
| `lastName`         | string | Yes      | Last name (1-50 chars)                 |
| `email`            | string | Yes      | Valid email address                    |
| `password`         | string | Yes      | Password (min 8 chars)                 |
| `phone`            | string | No       | Phone number (max 20 chars)            |
| `nationality`      | string | No       | Nationality (max 100 chars)            |
| `nationalId`       | string | No       | National ID (alphanumeric, 5-20 chars) |
| `address`          | object | No       | Address details                        |
| `emergencyContact` | object | No       | Emergency contact                      |
| `preferences`      | object | No       | Guest preferences                      |

**Address Object:**

```json
{
  "street": "123 Main St",
  "city": "New York",
  "state": "NY",
  "country": "USA",
  "zipCode": "10001"
}
```

**Emergency Contact Object:**

```json
{
  "name": "Jane Doe",
  "phone": "+1234567890",
  "relationship": "Spouse"
}
```

**Preferences Object:**

```json
{
  "roomType": "suite",
  "floorPreference": "high",
  "dietaryRestrictions": ["vegetarian", "gluten-free"],
  "specialRequests": "Early check-in if possible"
}
```

**Conflict Response:** `409`

```json
{
  "success": false,
  "error": "Email already exists"
}
```

---

### Get Customer by ID

```
GET /api/customers/[id]
```

Retrieves customer with booking statistics.

**Path Parameters:**

- `id` (string) - Clerk user ID

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "user_2abc123def",
    "first_name": "John",
    "last_name": "Doe",
    "name": "John Doe",
    "email": "john@example.com",
    "completedBookings": 5,
    "totalRevenue": 7500,
    "averageStayLength": 4.2,
    "recentBookings": [ ... ]
  }
}
```

---

### Update Customer

```
PUT /api/customers/[id]
```

Updates customer profile in Clerk and extended data.

**Path Parameters:**

- `id` (string) - Clerk user ID

**Request body** accepts the editable fields in the customer schema. Omission
keeps a value. For clearable fields such as `nationality`, an explicit `null`
clears it. [Customer updates](../apps/admin/lib/validations/customer.ts)

---

### Delete Customer

```
DELETE /api/customers/[id]
```

Deletes a customer. Fails if customer has existing bookings.

**Path Parameters:**

- `id` (string) - Clerk user ID

**Error Response (has bookings):** `400`

```json
{
  "success": false,
  "error": "Cannot delete customer with existing bookings"
}
```

---

### Lock Customer Account

```
POST /api/customers/[id]/lock
```

Locks a customer account, preventing login.

**Path Parameters:**

- `id` (string) - Clerk user ID

**Response:**

```json
{
  "success": true,
  "message": "User locked successfully",
  "data": {
    "locked": true,
    "lockedAt": "2024-01-15T10:00:00.000Z"
  }
}
```

---

### Unlock Customer Account

```
DELETE /api/customers/[id]/lock
```

Unlocks a previously locked customer account. On success `data` contains `locked: false` and the ISO timestamp `unlockedAt`. Lock and unlock both invalidate the server-cached Clerk profile after provider success.

**Path Parameters:**

- `id` (string) - Clerk user ID

---

## Dining

The collection also accepts `PUT /api/dining` with `_id` in the body and
`DELETE /api/dining?id={id}`. `GET /api/dining/stats` returns menu and
experience counts, availability, and average price.

### List Dining Items

```
GET /api/dining
```

**Query Parameters:**

| Parameter     | Type    | Description                                  |
| ------------- | ------- | -------------------------------------------- |
| `type`        | string  | `menu` or `experience`                       |
| `mealType`    | string  | `breakfast`, `lunch`, `dinner`, or `all-day` |
| `category`    | string  | Category filter                              |
| `isAvailable` | boolean | Availability filter                          |
| `search`      | string  | Search by name/description                   |
| `sortBy`      | string  | Sort field (default: `name`)                 |
| `sortOrder`   | string  | `asc` or `desc`                              |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "65a1b2c3d4e5f6a7b8c9d0e3",
      "name": "Continental Breakfast",
      "description": "Fresh bread, fruit, and coffee served in the lodge.",
      "type": "menu",
      "mealType": "breakfast",
      "category": "regular",
      "price": 25,
      "servingTime": {
        "start": "07:00",
        "end": "10:30"
      },
      "maxPeople": 50,
      "image": "https://example.com/menu/breakfast.jpg",
      "isAvailable": true
    }
  ]
}
```

---

### Create Dining Item

```
POST /api/dining
```

**Request Body:**

| Field         | Type     | Required | Description                                                    |
| ------------- | -------- | -------- | -------------------------------------------------------------- |
| `name`        | string   | Yes      | Item name (1-100 chars)                                        |
| `description` | string   | Yes      | Description (10-1000 chars)                                    |
| `type`        | string   | Yes      | Dining type enum                                               |
| `mealType`    | string   | Yes      | Meal type enum                                                 |
| `category`    | string   | Yes      | `regular`, `craft-beer`, `wine`, `spirits`, or `non-alcoholic` |
| `price`       | number   | Yes      | Price (> 0)                                                    |
| `servingTime` | object   | Yes      | Start/end times (HH:MM format)                                 |
| `maxPeople`   | number   | Yes      | Max capacity (1-100)                                           |
| `image`       | string   | Yes      | Image URL                                                      |
| `ingredients` | string[] | No       | List of ingredients                                            |
| `allergens`   | string[] | No       | List of allergens                                              |
| `dietary`     | string[] | No       | Dietary labels, such as `vegetarian` or `gluten-free`          |
| `isAvailable` | boolean  | No       | Default: `true`                                                |
| `isPopular`   | boolean  | No       | Default: `false`                                               |

**Serving Time Object:**

```json
{
  "start": "07:00",
  "end": "10:30"
}
```

---

### Get/Update/Delete Dining Item

```
GET /api/dining/[id]
PUT /api/dining/[id]
DELETE /api/dining/[id]
```

Standard CRUD operations by ID.

---

## Experiences

`GET /api/experiences/stats` returns the number of experiences, popular
experiences, average price, and total configured capacity.

### List Experiences

```
GET /api/experiences
```

Returns all experiences.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "name": "Mountain Hiking Tour",
      "description": "...",
      "duration": "4 hours",
      "price": 75,
      "difficulty": "Moderate",
      "maxParticipants": 12,
      "category": "Outdoor",
      "image": "https://...",
      "includes": ["Guide", "Equipment", "Snacks"],
      "available": ["Monday", "Wednesday", "Saturday"],
      "ctaText": "Book Now",
      "requirements": ["Hiking boots", "Water bottle"],
      "isPopular": false
    }
  ]
}
```

---

### Create Experience

```
POST /api/experiences
```

**Request Body:**

| Field                | Type     | Required | Description                           |
| -------------------- | -------- | -------- | ------------------------------------- |
| `name`               | string   | Yes      | Name (1-100 chars)                    |
| `description`        | string   | Yes      | Description (1-2000 chars)            |
| `duration`           | string   | Yes      | Duration text (1-50 chars)            |
| `price`              | number   | Yes      | Price (>= 0)                          |
| `difficulty`         | string   | Yes      | `Easy`, `Moderate`, `Challenging`     |
| `category`           | string   | Yes      | Category (1-50 chars)                 |
| `image`              | string   | Yes      | Image URL (1-2048 chars)              |
| `includes`           | string[] | Yes      | At least one inclusion                |
| `available`          | string[] | Yes      | At least one availability option      |
| `ctaText`            | string   | Yes      | Call to action text (1-100 chars)     |
| `longDescription`    | string   | No       | Extended description (max 5000 chars) |
| `gallery`            | string[] | No       | Additional image URLs                 |
| `isPopular`          | boolean  | No       | Default: `false`                      |
| `maxParticipants`    | number   | No       | Max participants (1-500)              |
| `minAge`             | number   | No       | Minimum age (0-120)                   |
| `requirements`       | string[] | No       | Requirements                          |
| `location`           | string   | No       | Location (max 200 chars)              |
| `highlights`         | string[] | No       | Highlight points                      |
| `whatToBring`        | string[] | No       | Items to bring                        |
| `cancellationPolicy` | string   | No       | Cancellation policy (max 500 chars)   |
| `seasonality`        | string   | No       | Season information (max 200 chars)    |
| `tags`               | string[] | No       | Tags for categorization               |
| `rating`             | number   | No       | Rating (0-5)                          |
| `reviewCount`        | number   | No       | Number of reviews. Default: `0`       |

---

### Get/Update/Delete Experience

```
GET /api/experiences/[id]
PUT /api/experiences/[id]
DELETE /api/experiences/[id]
```

Standard CRUD operations by ID.

---

## Settings

`POST /api/settings` resets the singleton to its defaults and requires an
application administrator. [Settings routes](../apps/admin/app/api/settings/route.ts)

### Get Settings

```
GET /api/settings
```

Retrieves application settings. Creates default settings if none exist.

**Response:**

```json
{
  "success": true,
  "data": {
    "minBookingLength": 1,
    "maxBookingLength": 30,
    "maxGuestsPerBooking": 10,
    "breakfastPrice": 15,
    "checkInTime": "15:00",
    "checkOutTime": "11:00",
    "cancellationPolicy": "moderate",
    "requireDeposit": true,
    "depositPercentage": 20,
    "allowPets": true,
    "petFee": 25,
    "smokingAllowed": false,
    "earlyCheckInFee": 30,
    "lateCheckOutFee": 30,
    "wifiIncluded": true,
    "parkingIncluded": true,
    "parkingFee": 0,
    "currency": "USD",
    "timezone": "America/New_York",
    "businessHours": {
      "open": "08:00",
      "close": "22:00"
    },
    "contactInfo": {
      "email": "contact@lodgeflow.com",
      "phone": "+1234567890",
      "address": { "city": "Pine Valley", "state": "MT" }
    },
    "notifications": {
      "bookingConfirmation": true,
      "paymentReminders": true,
      "checkInReminders": true
    }
  }
}
```

---

### Update Settings

```
PUT /api/settings
```

Updates application settings.

**Request Body:** Settings fields to update

The update replaces a supplied nested object such as `notifications` or
`businessHours`. A response may contain just the supplied nested fields.
[Settings response schema](../packages/database/src/settings-json-schema.ts)

---

## Dashboard

The booking reports also require `bookings:read`. `GET /api/bookings/stats`
returns summary counts. `GET /api/bookings/analytics` accepts a `period`
query parameter (default `30d`) and returns summary and chart data.
[Booking analytics](../apps/admin/app/api/bookings/analytics/route.ts)

### Get Dashboard Data

```
GET /api/dashboard
```

Returns booking and cancellation totals for the last 30 days, recent booking activity, today’s check-ins and check-outs, and occupancy, revenue, and duration series.

**Response:**

```json
{
  "success": true,
  "data": {
    "overview": {
      "totalBookings": 150,
      "totalRevenue": 45000,
      "totalCabins": 12,
      "totalCustomers": 89,
      "totalCancellations": 5,
      "occupancyRate": 78.5,
      "checkInsToday": 3,
      "checkOutsToday": 2
    },
    "recentActivity": [
      {
        "id": "65a1b2c3d4e5f6a7b8c9d0e1",
        "customerName": "Jordan Lane",
        "cabinName": "Lakeside Cabin",
        "checkInDate": "2024-01-15T00:00:00.000Z",
        "checkOutDate": "2024-01-20T00:00:00.000Z",
        "totalPrice": 1500,
        "status": "confirmed",
        "createdAt": "2024-01-10T10:00:00.000Z"
      }
    ],
    "charts": {
      "occupancy": [...],
      "revenue": [...],
      "durations": [...]
    }
  }
}
```

---

### Get Sales Data

```
GET /api/sales
```

Returns daily sales data for the last 30 days.

**Response:**

```json
[
  {
    "date": "Jan 1",
    "fullDate": "2024-01-01",
    "sales": 1500,
    "bookings": 3
  }
]
```

---

The overview cards, activity list, and stay-duration chart all read from
`GET /api/dashboard`. The sales chart uses `GET /api/sales`.
[Dashboard hooks](../apps/admin/hooks/useData.ts)

---

## Email Services

Both manual send endpoints return the original provider object with a string
`id` on success. An uncertain reply can follow a successful send, so retrying
may send another email. [Email response reader](../apps/admin/lib/validations/send-email-response.ts)

### Send Booking Confirmation

```
POST /api/send/confirm
```

Sends a booking confirmation email to the customer.

**Request Body:**

| Field         | Type   | Required | Description                                |
| ------------- | ------ | -------- | ------------------------------------------ |
| `firstName`   | string | No       | Omission or null renders an empty greeting |
| `email`       | string | Yes      | Customer email                             |
| `bookingData` | object | Yes      | Booking details                            |
| `cabinData`   | object | Yes      | Cabin details                              |

**Rate Limited:** Yes (stricter limits)

---

### Send Welcome Email

```
POST /api/send/welcome
```

Sends a welcome email to a new customer.

**Request Body:**

| Field       | Type   | Required | Description                                |
| ----------- | ------ | -------- | ------------------------------------------ |
| `firstName` | string | No       | Omission or null renders an empty greeting |
| `email`     | string | Yes      | Customer email                             |

**Rate Limited:** Yes (stricter limits)

---

## Cron Jobs

### Seed Database

```
GET /api/cron/seed
```

This bearer-protected endpoint resets demo data. The local admin `seed` command
prints a notice and exits. The live demo reset is managed by n8n. [Demo-data operations](guest-identity.md#local-seed-status)

The server requires `Authorization: Bearer <SEED_SECRET>`, resolves non-staff
Clerk guests, and validates the replacement records. One transaction replaces
Settings, cabins, dining items, experiences, and cabin bookings, and clears
dining and experience reservations. Staff assignments and audit history survive.
Success returns `success`, `message`, and a `results` object with numeric
`cabins`, `experiences`, `dining`, `settings`, `bookings`, and `clerkUsers`
counts. [Seed operation](../apps/admin/lib/seed-database.ts)

---

## Validation Schemas

The API uses Zod schemas for request validation. See `lib/validations/` for schema definitions.

### Booking Status Values

- `unconfirmed`
- `confirmed`
- `checked-in`
- `checked-out`
- `cancelled`

### Payment Methods

- `cash`
- `card`
- `bank-transfer`
- `online`

### Dining Types

- `menu`
- `experience`

### Meal Types

- `breakfast`
- `lunch`
- `dinner`
- `all-day`

### Refund Status Values

- `none`
- `pending`
- `processing`
- `partial`
- `full`
- `failed`

### Experience Difficulty

- `Easy`
- `Moderate`
- `Challenging`

---

## Best Practices

### Pagination

Use pagination on the booking and customer lists. For example:

```
GET /api/bookings?page=1&limit=20
```

### Search

Use the `search` parameter for text-based filtering:

```
GET /api/customers?search=john
```

### Sorting

Use `sortBy` and `sortOrder` for custom sorting:

```
GET /api/cabins?sortBy=price&sortOrder=asc
```

### Error Handling

Check the HTTP status and validate the JSON with the reader for that endpoint
before updating the cache or reporting success. [Admin response readers](../apps/admin/lib/validations)

---

## Changelog

### Version 1.0 (February 2026)

- Initial API documentation
- Complete endpoint coverage for all 21 API routes
- Authentication and rate limiting documentation
- Request/response schema documentation
