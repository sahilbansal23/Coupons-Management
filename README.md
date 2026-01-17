# Coupons-Management
Coupons Management API System

## Overview

This repository contains a lightweight Coupons Management API built with Express and PostgreSQL. It supports three coupon types:

- cart-wise (percentage discount if cart total meets a threshold)
- product-wise (percentage discount on a specific product)
- bxgy (buy X of some product(s) and get Y free of some product(s))

The README documents the implementation, expected request shapes, limitations, and assumptions made when handling errors or edge cases.

## Project structure (relevant files)

- `index.js` - app starter and routes mounting
- `route.js` - API routes
- `controllers/couponController.js` - create, list, update, delete coupons
- `controllers/applyCouponController.js` - evaluate and apply coupons to a cart
- `queries/coupons.js` - SQL queries
- `config/dbconfig.js` - DB connection (reads env vars)
- `utils/validateCouponType.js` - coupon type validation
- `utils/logger.js` - pino logger
- `sql.sql` - table DDL (coupons table)

## Database notes

The `coupons` table uses `bigint` columns for timestamps (created_at, updated_at, expiry_at). The code uses `Date.now()` (milliseconds since epoch) when writing these fields.

DDL (from `sql.sql`):

```sql
CREATE TABLE public.coupons
(
		id character varying NOT NULL,
		type character varying,
		details json,
		threshold_qty bigint,
		created_at bigint,
		updated_at bigint,
		expiry_at bigint,
		PRIMARY KEY (id)
);
```

## Coupon types and expected `details` shapes

1) cart-wise
- type: `"cart-wise"`
- details example: `{ "threshold": 500, "discount": 10 }`
- Semantics: if cart total >= threshold, apply (cartTotal * discount%) as total discount. Discount is distributed proportionally across items when applying.

2) product-wise
- type: `"product-wise"`
- details example: `{ "product_id": "prod_123", "discount": 20 }`
- Semantics: find the item in the cart with matching `product_id`. Apply discount% to that product's total (price * quantity).

3) bxgy (Buy X Get Y)
- type: `"bxgy"`
- details example:

```json
{
	"buy_products": [{ "product_id": "A", "quantity": 3 }],
	"get_products": [{ "product_id": "B", "quantity": 1 }],
	"repition_limit": 2
}
```

- Semantics implemented:
	- Count total bought quantity across the `buy_products` listed (combination across multiple buy product entries is supported).
	- Determine how many full groups (applications) = floor(totalBuyQty / groupQty) where `groupQty` is taken from `buy_products[0].quantity`.
	- Cap applications by `repition_limit` if provided.
	- Determine maximum free items = applications * sum(get_products[].quantity).
	- Only GET products that are present in the cart are eligible; among eligible GET items, the implementation sorts them by price descending and grants free quantity up to the cap (so the most expensive eligible items are made free first).

Note: GET free items are capped by their availability in the cart (i.e., you can't get more free units than the cart contains for that product). When applying, the implementation increases the cart item's quantity to reflect free items and increments that item's `total_discount` by (freeQty * price).


## API endpoints (routes)

- POST `/api/coupons` - create coupon
	- Body must include `type`, `details`, `expiry_at` (optional), `threshold_qty` (optional)

- GET `/api/coupons` - get all active coupons
- GET `/api/coupons/:id` - get coupon by id
- PUT `/api/coupons/:id` - update coupon (fields: `details`, `expiry_at`)
- DELETE `/api/coupons/:id` - soft-delete (sets `is_active=false`)

- POST `/api/applicable-coupons` - evaluate and return applicable coupons for a cart
	- Body: `{ "cart": { "items": [{ "product_id": "A", "price": 100, "quantity": 2 }, ...] } }`

- POST `/api/apply-coupon/:id` - apply coupon with id to given cart
	- Body: same cart shape as above

Response shapes are simple JSON objects. See controller implementations for exact returned fields.

### Example payloads

- Cart payload (for applicability and apply endpoints)

```json
{
	"cart": {
		"items": [
			{ "product_id": "A", "price": 100.0, "quantity": 2 },
			{ "product_id": "B", "price": 50.0, "quantity": 1 }
		]
	}
}
```

- Create coupon (cart-wise example)

```json
{
	"type": "cart-wise",
	"details": { "threshold": 200, "discount": 10 },
	"expiry_at": 1750000000000
}
```

## Limitations (current implementation)

- `bxgy` behavior:
	- The `bxgy` evaluation logic selects free items only among GET products already present in the cart. If a GET product is not in the cart, it won't be granted as free (so GETing a different SKU that's not in the cart is not supported).
	- The implementation sorts GET items by price descending and grants free items to the most expensive items first. That may not be the desired business rule for all stores.


## Assumptions made when diagnosing errors

- Timestamps are stored as Unix epoch milliseconds (bigint) in DB. Code uses `Date.now()` for created/updated/expiry stamps.
- `details` column is JSON and the application expects specific keys depending on `type` (see shapes above). No deep schema validation is performed server-side for `details` beyond type checks.
- Discounts in `details` (for cart-wise and product-wise) are percentages (e.g., 10 means 10%).
- Product identifiers in `details` match the `product_id` values in cart item payloads. No product lookup is performed against a product catalog.
- Only one coupon can be applied to a cart at any given time.

## Error cases & typical causes

- 400 Bad Request
	- Invalid coupon type when creating a coupon .
	- Cart validation failures: empty cart, item price == 0 or item quantity == 0.
	- Applying a coupon that is not applicable (the apply functions throw with message "Coupon not applicable for this cart"). These are returned as 400 with the message.

- 404 Not Found
	- Coupon not found when fetching by id or applying by id.

- 500 Internal Server Error
	- DB errors, transaction rollbacks, or unexpected exceptions. Controllers log errors using pino.

## Implementation notes (how discounts computed)

- cart-wise: total discount = (cartTotal * discount%) and is distributed proportionally to item totals. Per-item discount is rounded to 2 decimals.
- product-wise: discount = (price * quantity * discount%). Only applies if the product exists in the cart.
- bxgy: see details above; free units are chosen among GET products present in the cart and capped by availability and repetition limits.

## Environment variables

The app reads DB connection values from environment variables used in `config/dbconfig.js`:

- DBUSER
- DBHOST
- DB
- DBPASSWORD
- DBPORT

Set a `.env` file or export these variables before running.

## How to run (development)

1. Install dependencies

```bash
npm install
```

2. Provide environment variables (e.g., in `.env`)

3. Start the server

```bash
npm start
```

Server listens on port 4000 by default (see `index.js`).

## Recommended fixes / next steps
1. Add strict `details` schema validation per coupon type (Joi or JSON Schema). This will prevent malformed coupon `details` from causing runtime errors.
2. Add unit tests for all discount calculation paths (cart-wise, product-wise, bxgy). Include edge cases: fractional prices, large quantities, repition limits.
3. Consider supporting multiple coupons per cart (define stacking rules and conflict resolution strategy).
4. Replace floating-point money math with integer cents or a decimal library (e.g., decimal.js) to avoid rounding issues in financial calculations.
5. Add integration tests and a Postman collection / OpenAPI spec for the endpoints.
