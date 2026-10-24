# Database design (MongoDB / Mongoose)

| Model | Purpose | Key indexes |
|---|---|---|
| **User** | Account, role (`donor`/`ngo`/`volunteer`/`admin`), status, donor business and volunteer profile. Hashed password and token hashes are `select:false`. | `email` unique, `role`, `status` |
| **Organization** | One per NGO user; verification status and location. | `owner` unique, `verificationStatus`, `location` 2dsphere (sparse) |
| **FoodCategory** | Admin-managed categories (`requiresPrepTime`). | `slug` unique |
| **Donation** | Listing with quantity, reservation counter, GeoJSON point, window, safety declaration, status + history. | `location` 2dsphere, `status`, `category`, `pickupDeadline`, `(status,pickupDeadline)`, unique `(recurringSource, generatedForDate)` |
| **DonationRequest** | An organization's request for a quantity; own lifecycle and history; expiry. | `donation`, `ngo`, `(ngo,createdAt)`, **unique pending `(donation, ngo)`** (blocks duplicate submits), `expiresAt` |
| **PickupAssignment** | Volunteer job for a request; hashed single-use handover token; timestamps. | `request` unique, `volunteer`, `status`, `(status,createdAt)` |
| **Notification** | Persistent notifications with read state. | `(user,createdAt)`, `(user,readAt)` |
| **RecurringDonation** | Schedule (daily/weekly, window, time zone). | `donor`, `status` |
| **Report** | Reports against listings. | unique `(donation, reporter)` |
| **AuditLog** | Security-relevant admin actions. | `createdAt`, `actor`, `action` |
| **Setting** | Configurable eligibility rules (key/value). | `key` unique |

## Relationships
`User 1─1 Organization` (NGO) · `User 1─* Donation` · `Donation 1─* DonationRequest *─1 User(NGO)` · `DonationRequest 1─0..1 PickupAssignment *─0..1 User(volunteer)` · `RecurringDonation 1─* Donation (drafts)` · `User 1─* Notification`.

## Concurrency and integrity
- **No over-allocation**: accepting a request runs `updateOne({_id, $expr: reserved + qty <= quantity}, {$inc: {quantityReserved: qty}})`. Only one of several racing accepts can win; the loser gets a 409. If the following request update fails, the quantity is released.
- **Compare-and-set transitions**: every state change filters on the status it read, so double clicks and racing jobs are no-ops.
- **Jobs are idempotent**: expiry and reminders act only through conditional updates; recurring drafts are guarded by a unique index.

## Retention and deletion
Handover tokens are deleted when used. Live location is never stored. Notifications and audit logs are kept until the operator purges them (add a TTL index if you need automatic retention). Account deletion is a manual operator task in this version (see Known limitations).
