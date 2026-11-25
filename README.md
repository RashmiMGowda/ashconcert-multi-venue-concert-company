# ashConcert Company

A React concert-discovery frontend with a separate Express JSON API and SQLite persistence. The current milestone covers browsing shows and venues and saving demo ticket reservations.

## Run locally

Requires Node.js 22.5 or later (for the built-in SQLite driver).

```sh
npm install
npm run dev
```

Vite serves the React frontend at [http://localhost:5173](http://localhost:5173) and proxies `/api` requests to the Express API at `http://localhost:3000`. To build the frontend and run the production server:

```sh
npm run build
npm start
```

The API creates `server/data/ashconcert.sqlite` on first launch. It seeds six upcoming shows and six venues based on the future-event and venue details in the Phase 4 inserts. The ticket options and prices are sample data for the UI, not ticket-option prices copied from the Phase 4 SQL. Reservations persist in SQLite. This is a demo flow: it does not take payment or issue real tickets.

## Project layout

- `client/` — React 19 + Vite frontend.
- `server/` — Express API, SQLite setup, and API integration tests.
- `data/seed.json` — development catalog seed.
- `phase 1/` through `phase 4/` — original course project documents and SQL scripts, kept outside this app folder.

## API

- `GET /api/health`
- `GET /api/events?q=&city=&genre=`
- `GET /api/venues`
- `POST /api/bookings` with `{ "eventId", "ticketOptionId", "quantity", "name", "email" }`

## How the course phases relate to this milestone

I reviewed the Phase 1 requirements, Phase 2 ERD, both Phase 3 normalization documents, and the Phase 4 DDL, seed data, updates, and analytical queries. They describe a broader system than this first React/API slice:

- Phase 1 includes ten business reports, plus venues, admission areas and seats, performers and genres, people/customers/attendees, ticket sales and payments, refunds, and verified entry.
- Phase 2 gives the ERD relationships and cardinalities for those entities.
- Phase 3 defines the candidate keys and functional dependencies; the companion document checks the relations against BCNF.
- Phase 4 implements 22 Oracle tables, constraints/triggers, and 13 SQL queries.

This app does **not** yet port that complete Oracle schema or those reports. Its SQLite model is intentionally smaller: venue, event, ticket option, and demo booking. Customer accounts, attendee assignment, seat inventory, payment processing, refunds, check-ins, and the Phase 1/Phase 4 analytics remain to be implemented before this can be called a full realization of the submitted plan.

Run API and persistence tests with `npm test`; build the React frontend with `npm run build`.
