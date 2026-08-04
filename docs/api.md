# LodgeFlow Admin API Documentation

**Version:** 1.0
**Base URL:** `/api`
**Authentication:** All endpoints require Clerk authentication unless noted otherwise.

---

## Table of Contents

1. [Authentication](#authentication)
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

All API endpoints require authentication via Clerk. The server validates the user session using `@clerk/nextjs/server`.

**Required Headers:**
- Clerk session cookie (automatically handled by Clerk middleware)

**Role-Based Access:**
- `org:admin` - Full access to all endpoints
- `org:customer` - Limited access to own data

**Unauthorized Response:**
```json
{
  "success": false,
  "error": "Unauthorized"
}
```
**Status Code:** `401`

---

## Response Formats

### Success Response (Single Item)
```json
{
  "success": true,
  "data": { ... }
}
```

### Success Response (List with Pagination)
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 10,
    "totalItems": 100,
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

| Status | Description |
|--------|-------------|
| `400` | Bad Request - Invalid input or validation failed |
| `401` | Unauthorized - Missing or invalid authentication |
| `404` | Not Found - Resource does not exist |
| `409` | Conflict - Resource conflict (e.g., overlapping bookings) |
| `429` | Too Many Requests - Rate limit exceeded |
| `500` | Internal Server Error - Server-side error |

---

## Rate Limiting

Rate limiting is applied to mutation endpoints to prevent abuse.

**Limits:**
- **Customer creation:** 10 requests per minute per user
- **Email sending:** 5 requests per minute per user

**Rate Limit Exceeded Response:**
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "resetAt": "2024-01-15T10:30:00.000Z"
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

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | `1` | Page number |
| `limit` | number | `10` | Items per page (max: 100) |
| `status` | string | - | Filter by status: `unconfirmed`, `confirmed`, `checked-in`, `checked-out`, `cancelled` |
| `search` | string | - | Search by cabin name, customer name, or email |
| `sortBy` | string | `checkInDate` | Sort field |
| `sortOrder` | string | `desc` | Sort order: `asc` or `desc` |

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
        "fullName": "John Doe",
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

Every price-derived field is computed server-side from the `Cabin` and
`Settings` documents and any client-supplied value is discarded — see
`lib/booking-pricing.ts`.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cabin` | string | Yes | Cabin ObjectId |
| `customer` | string | Yes | Clerk user ID |
| `checkInDate` | string (ISO) | Yes | Check-in date |
| `checkOutDate` | string (ISO) | Yes | Check-out date |
| `numGuests` | number | Yes | Number of guests (1-50, capped by cabin capacity and settings) |
| `status` | string | No | Default: `unconfirmed` |
| `numNights` | number | No | **Ignored** — derived from the dates |
| `cabinPrice` | number | No | **Ignored** — derived from the cabin document |
| `extrasPrice` | number | No | **Ignored** — derived from cabin/settings |
| `totalPrice` | number | No | **Ignored** — derived from cabin/settings |
| `isPaid` | boolean | No | Default: `false` |
| `paymentMethod` | string | No | `cash`, `card`, `bank-transfer`, `online` |
| `depositPaid` | boolean | No | Default: `false` |
| `depositAmount` | number | No | **Ignored** — derived from `settings.requireDeposit`/`depositPercentage` |
| `remainingAmount` | number | No | **Ignored** — `totalPrice - depositAmount` |
| `stripePaymentIntentId` | string | No | Stripe payment intent ID (must start with `pi_`) |
| `stripeSessionId` | string | No | Stripe session ID (must start with `cs_`) |
| `paidAt` | string (ISO) | No | Payment timestamp |
| `paymentConfirmationSentAt` | string (ISO) | No | When payment confirmation email was sent |
| `specialRequests` | string[] | No | Default: `[]`. List of special requests |
| `extras` | object | No | Optional add-ons |
| `observations` | string | No | Special requests (max 1000 chars) |

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
  "cabinPrice": 200,
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
  "error": "Booking dates overlap with existing booking"
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

`numNights`, `cabinPrice`, `extrasPrice`, `totalPrice`, and `remainingAmount`
are ignored if sent: they are recomputed from the `Cabin`/`Settings` documents
whenever a pricing-relevant field (`cabin`, `checkInDate`, `checkOutDate`,
`numGuests`, `extras`) changes. `depositAmount` is ignored too, but is *not*
recomputed — it tracks money actually taken, so it carries over untouched and
can only be changed through `PATCH /api/bookings/[id]`'s `recordPayment`.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | string | Yes | Booking ObjectId |
| `depositAmount` | number | No | **Ignored** — use `PATCH /api/bookings/[id]` `recordPayment` |
| (other fields) | various | No | Fields to update |

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
    "notes": "Deposit payment"
  }
}
```

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

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Booking status (validated transitions only) |
| `recordPayment` | object | Payment recording (see above) |
| `cancellationReason` | string | Reason for cancellation (max 500 chars, cancelled bookings only) |
| `cancelledAt` | string (ISO) | Cancellation timestamp (cancelled bookings only). Auto-set to current time when status transitions to cancelled. Can be overridden in the same request or updated later on already-cancelled bookings. |
| `refundStatus` | string | Refund status (cancelled bookings only) |
| `refundAmount` | number | Refund amount (cancelled bookings only) |
| `refundedAt` | string (ISO) | Refund timestamp (cancelled bookings only) |
| `paidAt` | string (ISO) | Payment timestamp |
| `stripePaymentIntentId` | string | Stripe payment intent ID (must start with `pi_`) |
| `stripeSessionId` | string | Stripe session ID (must start with `cs_`) |
| `paymentConfirmationSentAt` | string (ISO) | When payment confirmation was sent |

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
  "error": "No booking found for this customer"
}
```

---

## Cabins

### List Cabins

```
GET /api/cabins
```

Retrieves cabins with filtering and search.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `search` | string | - | Search by cabin name |
| `capacity` | string | - | `small` (1-3), `medium` (4-7), `large` (8+) |
| `discount` | string | - | `with` (has discount), `without` (no discount) |
| `filter` | string | - | Legacy: `with-discount`, `no-discount`, `small`, `medium`, `large` |
| `sortBy` | string | `name` | Sort field |
| `sortOrder` | string | `asc` | Sort order: `asc` or `desc` |

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
      "amenities": {
        "wifi": true,
        "tv": true,
        "ac": true,
        "heating": true
      },
      "isAvailable": true
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

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Cabin name (1-100 chars) |
| `description` | string | Yes | Description (10-2000 chars) |
| `capacity` | number | Yes | Guest capacity (1-20) |
| `price` | number | Yes | Price per night (> 0) |
| `discount` | number | No | Discount amount (must be < price) |
| `image` | string | No | Image URL |
| `amenities` | object | No | Amenity flags |
| `isAvailable` | boolean | No | Default: `true` |

**Amenities Object:**
```json
{
  "wifi": true,
  "tv": true,
  "ac": true,
  "heating": true,
  "kitchen": false,
  "washer": false,
  "parking": true,
  "pool": false,
  "hotTub": false,
  "fireplace": true,
  "balcony": true,
  "petFriendly": false
}
```

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

Returns unavailable date ranges for a cabin.

**Path Parameters:**
- `id` (string) - Cabin ObjectId

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `startDate` | string (ISO) | today | Query range start |
| `endDate` | string (ISO) | +6 months | Query range end |

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

Retrieves customers from Clerk with pagination.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | `1` | Page number |
| `limit` | number | `10` | Items per page |
| `search` | string | - | Search by name or email |
| `sortBy` | string | `created_at` | Sort field: `name`, `email`, `created_at`, `updated_at`, `last_sign_in_at`, `last_active_at` |
| `sortOrder` | string | `desc` | Sort order |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "user_2abc123def",
      "firstName": "John",
      "lastName": "Doe",
      "fullName": "John Doe",
      "email": "john@example.com",
      "imageUrl": "https://...",
      "createdAt": "2024-01-01T00:00:00.000Z"
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

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `firstName` | string | Yes | First name (1-50 chars) |
| `lastName` | string | Yes | Last name (1-50 chars) |
| `email` | string | Yes | Valid email address |
| `password` | string | Yes | Password (min 8 chars) |
| `phone` | string | No | Phone number (max 20 chars) |
| `nationality` | string | No | Nationality (max 100 chars) |
| `nationalId` | string | No | National ID (alphanumeric, 5-20 chars) |
| `address` | object | No | Address details |
| `emergencyContact` | object | No | Emergency contact |
| `preferences` | object | No | Guest preferences |

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
    "firstName": "John",
    "lastName": "Doe",
    "fullName": "John Doe",
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

**Request Body:** Fields to update (firstName, lastName, username, nationality, etc.)

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

Unlocks a previously locked customer account.

**Path Parameters:**
- `id` (string) - Clerk user ID

---

## Dining

### List Dining Items

```
GET /api/dining
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | `breakfast`, `lunch`, `dinner`, `snack`, `beverage`, `dessert` |
| `mealType` | string | `vegetarian`, `vegan`, `gluten-free`, `dairy-free`, `nut-free`, `regular` |
| `category` | string | Category filter |
| `isAvailable` | boolean | Availability filter |
| `search` | string | Search by name/description |
| `sortBy` | string | Sort field (default: `name`) |
| `sortOrder` | string | `asc` or `desc` |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "name": "Continental Breakfast",
      "description": "...",
      "type": "breakfast",
      "mealType": "regular",
      "category": "Main",
      "price": 25,
      "servingTime": {
        "start": "07:00",
        "end": "10:30"
      },
      "maxPeople": 50,
      "image": "https://...",
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

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Item name (1-100 chars) |
| `description` | string | Yes | Description (10-1000 chars) |
| `type` | string | Yes | Dining type enum |
| `mealType` | string | Yes | Meal type enum |
| `category` | string | Yes | Category (1-50 chars) |
| `price` | number | Yes | Price (> 0) |
| `servingTime` | object | Yes | Start/end times (HH:MM format) |
| `maxPeople` | number | Yes | Max capacity (1-100) |
| `image` | string | Yes | Image URL |
| `ingredients` | string[] | No | List of ingredients |
| `allergens` | string[] | No | List of allergens |
| `calories` | number | No | Calorie count |
| `isAvailable` | boolean | No | Default: `true` |
| `isPopular` | boolean | No | Default: `false` |

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

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Name (1-100 chars) |
| `description` | string | Yes | Description (1-2000 chars) |
| `duration` | string | Yes | Duration text (1-50 chars) |
| `price` | number | Yes | Price (>= 0) |
| `difficulty` | string | Yes | `Easy`, `Moderate`, `Challenging` |
| `category` | string | Yes | Category (1-50 chars) |
| `image` | string | Yes | Image URL (1-2048 chars) |
| `includes` | string[] | No | What's included. Default: `[]` |
| `available` | string[] | No | Availability schedule. Default: `[]` |
| `ctaText` | string | Yes | Call to action text (1-100 chars) |
| `longDescription` | string | No | Extended description (max 5000 chars) |
| `gallery` | string[] | No | Additional image URLs |
| `isPopular` | boolean | No | Default: `false` |
| `maxParticipants` | number | No | Max participants (1-500) |
| `minAge` | number | No | Minimum age (0-120) |
| `requirements` | string[] | No | Requirements |
| `location` | string | No | Location (max 200 chars) |
| `highlights` | string[] | No | Highlight points |
| `whatToBring` | string[] | No | Items to bring |
| `cancellationPolicy` | string | No | Cancellation policy (max 500 chars) |
| `seasonality` | string | No | Season information (max 200 chars) |
| `tags` | string[] | No | Tags for categorization |
| `rating` | number | No | Rating (0-5) |
| `reviewCount` | number | No | Number of reviews. Default: `0` |

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
    "cancellationPolicy": "48 hours before check-in",
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
      "address": "..."
    },
    "notifications": {
      "emailOnBooking": true,
      "emailOnCancellation": true,
      "emailOnCheckIn": true
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

---

## Dashboard

### Get Dashboard Data

```
GET /api/dashboard
```

Retrieves comprehensive dashboard analytics for the last 30 days.

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
        "type": "booking",
        "message": "New booking by John Doe",
        "timestamp": "2024-01-15T10:00:00.000Z"
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

### Get Overview (Mock Data)

```
GET /api/overview
```

Returns quick overview statistics. *Uses generated mock data.*

---

### Get Activities (Mock Data)

```
GET /api/activities
```

Returns current guest activity. *Uses generated mock data.*

---

### Get Durations (Mock Data)

```
GET /api/durations
```

Returns stay duration distribution. *Uses generated mock data.*

---

## Email Services

### Send Booking Confirmation

```
POST /api/send/confirm
```

Sends a booking confirmation email to the customer.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `firstName` | string | Yes | Customer first name |
| `email` | string | Yes | Customer email |
| `bookingData` | object | Yes | Booking details |
| `cabinData` | object | Yes | Cabin details |

**Rate Limited:** Yes (stricter limits)

---

### Send Welcome Email

```
POST /api/send/welcome
```

Sends a welcome email to a new customer.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `firstName` | string | Yes | Customer first name |
| `email` | string | Yes | Customer email |

**Rate Limited:** Yes (stricter limits)

---

## Cron Jobs

### Seed Database

```
GET /api/cron/seed
```

Cron job endpoint for database maintenance and seeding.

**Authentication:** Bearer token (`SEED_SECRET` environment variable), NOT Clerk auth

**Header:**
```
Authorization: Bearer {SEED_SECRET}
```

**Operations:**
1. Seeds cabins, experiences, dining, and settings if collections are empty
2. Deletes bookings older than 30 days
3. Creates 5-10 random new bookings

**Response:**
```json
{
  "success": true,
  "message": "Database seeded successfully",
  "results": {
    "cabins": "Inserted 10 cabins",
    "experiences": "Already seeded",
    "dining": "Inserted 15 items",
    "settings": "Already seeded",
    "bookings": 7
  }
}
```

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
- `breakfast`
- `lunch`
- `dinner`
- `snack`
- `beverage`
- `dessert`

### Meal Types
- `vegetarian`
- `vegan`
- `gluten-free`
- `dairy-free`
- `nut-free`
- `regular`

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
Always use pagination for list endpoints to prevent performance issues:
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
Always check the `success` field in responses:
```javascript
const response = await fetch('/api/bookings');
const data = await response.json();

if (!data.success) {
  console.error(data.error);
  return;
}

// Use data.data
```

---

## Changelog

### Version 1.0 (February 2026)
- Initial API documentation
- Complete endpoint coverage for all 21 API routes
- Authentication and rate limiting documentation
- Request/response schema documentation
