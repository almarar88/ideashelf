# Making Alcode Trips book for real

There are two ways an app takes a traveller from a price to a ticket. They
differ far more in paperwork than in code, so read this before choosing.

| | **A — Hand-off (meta-search)** | **B — In-app booking** |
|---|---|---|
| Who takes the payment | The partner site | You |
| Who issues the ticket | The airline / OTA | Your booking API on your behalf |
| Travel licence needed | No | Yes, or a partner who holds one |
| PCI / card handling | None | Yes |
| Refunds, schedule changes, support | The partner's problem | Yours, 24/7 |
| Revenue | Commission per booking | Margin per ticket |
| Time to live | Hours | Months |
| Status in this repo | **Built and working** | Provider built; needs your account |

**Start with A.** It is what Skyscanner, Kayak and Google Flights do, it is
already implemented here, and it earns money without a licence. Move to B only
when the volume justifies the overhead.

---

## Path A — hand-off, working today

The app compares prices and sends the traveller to the site that sells the
trip. That site takes the payment and issues the ticket. The traveller really
books; you earn a commission.

This is live in the code: the button on every offer opens the partner's real
booking page, the trip is recorded under **My Trips** as a *saved trip*, and
nothing is ever presented as a ticket the app did not issue.

### Turning on the commission

1. Sign up at [travelpayouts.com](https://www.travelpayouts.com) — free,
   approved in about a day.
2. Copy your **marker** (a number identifying you).
3. Build the app with it:

```bash
VITE_AFFILIATE_MARKER=123456 npm run build
```

Also set `TRAVELPAYOUTS_MARKER` in `server/.env` so links built server-side
carry it too.

Without a marker every link still works — it just earns nothing. Verify with:

```bash
node server/test-providers.mjs      # "booking hand-off links" check
```

### What the traveller sees

- The comparison, with the true total per site (price + that site's fees).
- A note, before they tap, saying the booking happens on the partner site and
  the app never sees their card.
- After tapping: the partner's real booking page, in the system browser so the
  address bar and padlock are visible.
- In **My Trips**: a saved trip labelled *not a ticket*, with the price found
  and a link back to finish.

### Commission rates, roughly

Flights 1.1–1.6% of fare · Hotels 4–7% of booking · Car hire 5–8% ·
eSIM 5–15%. Flights are low-margin and high-volume; hotels are where
meta-search actually makes money.

---

## Path B — booking inside the app

The provider is implemented (`server/providers/duffel.mjs`) and its response
mapping is covered by tests. What it needs is an account and the paperwork.

### Why Duffel and not Amadeus

Issuing an airline ticket requires IATA accreditation, which needs a bonded
travel business with capital requirements. Duffel holds that accreditation and
issues on your behalf, which is the only realistic route for a small team.
Amadeus production is possible but expects an established agency.

### The steps

1. **Get a token.** [duffel.com](https://duffel.com) → free test token
   immediately, no contract. Put it in `server/.env`:

   ```
   DUFFEL_TOKEN=duffel_test_...
   ENABLE_BOOKING=1
   BOOKING_SECRET=<a long random string>
   ```

2. **Verify it works** before anything else:

   ```bash
   node --env-file=server/.env server/test-providers.mjs
   ```

   The Duffel checks search real offers and re-price one. In test mode the
   airlines are Duffel's own test carriers — real API, no real money.

3. **Build the passenger form.** An order needs each traveller's legal name as
   printed on their passport, date of birth, gender, and contact details;
   international routes often need passport number, expiry and nationality.
   Getting a name wrong means a reissue fee, so validate before submitting.

4. **Take the payment.** Duffel's own Payments product, or your own gateway
   with funds held on your Duffel balance. If you touch card details directly
   you inherit PCI DSS; use a hosted field or their SDK and you do not.

5. **Apply for live mode.** Duffel reviews your business, then flips the token.
   Live tokens do not start with `duffel_test`, and `bookingMode` in `/health`
   reports which you are on.

6. **The legal part** — the piece that is not code:
   - A registered company.
   - A travel-seller licence where you operate. In Saudi Arabia this is the
     Ministry of Tourism; the UAE licenses per emirate (DET in Dubai); the EU
     requires Package Travel Directive insolvency protection if you sell
     flight + hotel together; the UK requires an ATOL for flight-inclusive
     packages. Check your own jurisdiction — this list is a starting point,
     not advice.
   - Published terms, refund and cancellation policy, and a support channel
     that answers when a flight is cancelled at 3am.

### How the order flow is wired

Three calls, in this order, because an airline fare expires:

```
POST /api/booking/price   { offerId }
   -> re-prices the offer; the amount returned is what the traveller pays

POST /api/booking/order   { offerId, passengers, payment, expectedTotal }
   -> creates the order and issues the ticket
```

Guards on the order endpoint, all deliberate:

- Refuses unless `ENABLE_BOOKING=1` **and** a Duffel token is present.
- Requires the `X-Booking-Secret` header to match `BOOKING_SECRET`.
- Re-prices server-side and rejects with `409` if the total moved from
  `expectedTotal`, so a stale price can never be silently charged.
- Request bodies are capped; errors are scrubbed of tokens before they leave.

`BOOKING_SECRET` is a shared secret, which is right for a first release with a
trusted client. Before real volume, put a real session behind it — a signed
user token, checked per request — so an order is always attributable to a
signed-in traveller.

### What still needs building for B

The API layer is done. The product around it is not:

- Passenger details form with passport capture and validation.
- Payment UI and the confirmed-order state (the boarding-pass screen already
  exists and renders a real pass once `status: "confirmed"` with a reference).
- Order management: retrieve, cancel, refund, and handling an airline schedule
  change.
- Emailing the itinerary and storing orders in a real database rather than
  `localStorage`.
- Support and refund processes, which are an operational commitment, not code.

---

## Everything else that is already real

These need no licence and no partner approval:

- **Photographs** — Wikimedia Commons, with licence and author credited.
- **Exchange rates** — refreshed daily.
- **Airports and cities** — every airport in the world, searchable.
- **Airline names** — real names for IATA codes.
- **Flight and hotel prices** — Amadeus Self-Service or Travelpayouts; free
  keys, see the README.

## Honest summary

Path A is real booking. The traveller pays a real seller and flies on a real
ticket; the app's job is finding them the cheapest one and handing them over
cleanly. That is a complete, shippable product and it is finished.

Path B means becoming the seller. The code is the small part.
