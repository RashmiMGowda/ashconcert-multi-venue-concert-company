import express from "express";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const root = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(root, "..");
const clientDist = resolve(projectRoot, "client", "dist");
const dbPath = process.env.DATABASE_PATH
  ? resolve(process.env.DATABASE_PATH)
  : resolve(root, "data", "ashconcert.sqlite");
const seed = JSON.parse(readFileSync(resolve(projectRoot, "data", "seed.json"), "utf8"));

export function initializeDatabase(path = dbPath) {
  mkdirSync(dirname(path), { recursive: true });
  const database = new DatabaseSync(path);
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS venues (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      type TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      street TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      genre TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      age_restriction INTEGER NOT NULL,
      venue_id INTEGER NOT NULL REFERENCES venues(id),
      image TEXT NOT NULL,
      accent TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Scheduled'
    );
    CREATE TABLE IF NOT EXISTS ticket_options (
      id INTEGER PRIMARY KEY,
      event_id INTEGER NOT NULL REFERENCES events(id),
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      price REAL NOT NULL CHECK (price >= 0)
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY,
      reference TEXT NOT NULL UNIQUE,
      event_id INTEGER NOT NULL REFERENCES events(id),
      ticket_option_id INTEGER NOT NULL REFERENCES ticket_options(id),
      quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 8),
      customer_name TEXT NOT NULL,
      email TEXT NOT NULL,
      total REAL NOT NULL CHECK (total >= 0),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  if (database.prepare("SELECT COUNT(*) AS count FROM events").get().count === 0) {
    const insertVenue = database.prepare(`
      INSERT INTO venues (id, name, city, state, type, capacity, street)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertEvent = database.prepare(`
      INSERT INTO events (id, title, artist, genre, date, time, age_restriction, venue_id, image, accent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertTicket = database.prepare(`
      INSERT INTO ticket_options (id, event_id, name, type, description, price)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    database.exec("BEGIN");
    try {
      for (const venue of seed.venues) {
        insertVenue.run(venue.id, venue.name, venue.city, venue.state, venue.type, venue.capacity, venue.street);
      }
      for (const event of seed.events) {
        insertEvent.run(
          event.id, event.title, event.artist, event.genre, event.date, event.time,
          event.ageRestriction, event.venueId, event.image, event.accent,
        );
        for (const ticket of event.tickets) {
          insertTicket.run(ticket.id, event.id, ticket.name, ticket.type, ticket.description, ticket.price);
        }
      }
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      database.close();
      throw error;
    }
  }
  return database;
}

export function createApp(database = initializeDatabase()) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));

  app.get("/api/health", (_request, response) => response.json({ ok: true }));

  app.get("/api/events", (request, response) => {
    const terms = [];
    const values = [];
    const query = typeof request.query.q === "string" ? request.query.q.trim() : "";
    const city = typeof request.query.city === "string" ? request.query.city.trim() : "";
    const genre = typeof request.query.genre === "string" ? request.query.genre.trim() : "";
    if (query) {
      terms.push("(e.title LIKE ? OR e.artist LIKE ? OR v.name LIKE ? OR v.city LIKE ?)");
      const pattern = `%${query}%`;
      values.push(pattern, pattern, pattern, pattern);
    }
    if (city && city !== "All cities") {
      terms.push("v.city = ?");
      values.push(city);
    }
    if (genre && genre !== "All genres") {
      terms.push("e.genre = ?");
      values.push(genre);
    }
    terms.push("e.status = 'Scheduled'", "e.date >= date('now')");
    const rows = database.prepare(`
      SELECT e.id, e.title, e.artist, e.genre, e.date, e.time,
             e.age_restriction AS ageRestriction, e.image, e.accent,
             v.name AS venue, v.city, v.state,
             MIN(t.price) AS startingPrice
      FROM events e
      JOIN venues v ON v.id = e.venue_id
      JOIN ticket_options t ON t.event_id = e.id
      WHERE ${terms.join(" AND ")}
      GROUP BY e.id
      ORDER BY e.date, e.time
    `).all(...values);
    const ticketsByEvent = database.prepare(`
      SELECT id, name, type, description, price
      FROM ticket_options WHERE event_id = ? ORDER BY price
    `);
    response.json({ events: rows.map((row) => ({ ...row, tickets: ticketsByEvent.all(row.id) })) });
  });

  app.get("/api/venues", (_request, response) => {
    const venues = database.prepare(`
      SELECT v.id, v.name, v.city, v.state, v.type, v.capacity, v.street,
             COUNT(DISTINCT e.id) AS upcomingShows
      FROM venues v
      LEFT JOIN events e ON e.venue_id = v.id AND e.date >= date('now') AND e.status = 'Scheduled'
      GROUP BY v.id
      ORDER BY v.city, v.name
    `).all();
    response.json({ venues });
  });

  app.post("/api/bookings", (request, response) => {
    const input = request.body;
    const eventId = Number(input?.eventId);
    const ticketOptionId = Number(input?.ticketOptionId);
    const quantity = Number(input?.quantity);
    const customerName = typeof input?.name === "string" ? input.name.trim() : "";
    const email = typeof input?.email === "string" ? input.email.trim() : "";
    if (!Number.isInteger(eventId) || !Number.isInteger(ticketOptionId)) {
      return response.status(400).json({ error: "Choose a valid concert and ticket type." });
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 8) {
      return response.status(400).json({ error: "Choose between 1 and 8 tickets." });
    }
    if (customerName.length < 2 || customerName.length > 100) {
      return response.status(400).json({ error: "Enter a name between 2 and 100 characters." });
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return response.status(400).json({ error: "Enter a valid email address." });
    }
    const ticket = database.prepare(`
      SELECT t.id, t.name, t.price, e.id AS eventId, e.title, e.date, e.status,
             v.name AS venue
      FROM ticket_options t
      JOIN events e ON e.id = t.event_id
      JOIN venues v ON v.id = e.venue_id
      WHERE t.id = ? AND e.id = ?
    `).get(ticketOptionId, eventId);
    if (!ticket || ticket.status !== "Scheduled" || ticket.date < new Date().toISOString().slice(0, 10)) {
      return response.status(404).json({ error: "That ticket is no longer available." });
    }
    const reference = `AC-${randomBytes(4).toString("hex").toUpperCase()}`;
    const total = Number((ticket.price * quantity).toFixed(2));
    database.prepare(`
      INSERT INTO bookings (reference, event_id, ticket_option_id, quantity, customer_name, email, total)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(reference, eventId, ticketOptionId, quantity, customerName, email, total);
    return response.status(201).json({
      booking: {
        reference,
        event: ticket.title,
        venue: ticket.venue,
        date: ticket.date,
        ticket: ticket.name,
        quantity,
        total,
        name: customerName,
      },
    });
  });

  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get("*splat", (_request, response) => response.sendFile(resolve(clientDist, "index.html")));
  }
  app.use((error, _request, response, _next) => {
    if (error instanceof SyntaxError && "body" in error) {
      return response.status(400).json({ error: "Request body must be valid JSON." });
    }
    console.error("API request failed:", error);
    return response.status(500).json({ error: "Something went wrong. Please try again." });
  });
  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const database = initializeDatabase();
  const port = Number(process.env.PORT ?? 3000);
  const server = createApp(database).listen(port, () => {
    console.log(`ashConcert Company API listening at http://localhost:${port}`);
  });
  const shutdown = () => server.close(() => {
    database.close();
    process.exit(0);
  });
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
