import { useEffect, useMemo, useRef, useState } from "react";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatDate(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  return {
    month: new Intl.DateTimeFormat("en-US", { month: "short" }).format(date).toUpperCase(),
    day: new Intl.DateTimeFormat("en-US", { day: "2-digit" }).format(date),
    full: new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(date),
  };
}

function formatTime(timeString) {
  const [hours, minutes] = timeString.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
}

function imageUrl(imageId, width = 900) {
  return `https://images.unsplash.com/${imageId}?auto=format&fit=crop&w=${width}&q=85`;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Something went wrong. Please try again.");
  return payload;
}

function Brand({ footer = false }) {
  return (
    <a className={`brand${footer ? " footer-brand" : ""}`} href="#" aria-label="ashConcert Company home">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32"><path d="M5 18V14M10 23V9M15 27V5M20 22V10M25 18V14" /></svg>
      </span>
      <span>ash<span className="brand-light">Concert</span></span>
    </a>
  );
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="site-header">
      <Brand />
      <nav className={`main-nav${menuOpen ? " open" : ""}`} aria-label="Main navigation">
        <a className="nav-link active" href="#concerts" onClick={() => setMenuOpen(false)}>Concerts</a>
        <a className="nav-link" href="#venues" onClick={() => setMenuOpen(false)}>Venues</a>
        <a className="nav-link" href="#about" onClick={() => setMenuOpen(false)}>Our story</a>
      </nav>
      <div className="header-actions">
        <a className="header-note" href="#concerts"><span className="live-dot" /> Your next night out awaits</a>
        <a className="header-cta" href="#concerts">Explore shows <span aria-hidden="true">↗</span></a>
      </div>
      <button
        className="menu-toggle"
        type="button"
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span /><span />
      </button>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-background" />
      <div className="hero-shade" />
      <div className="hero-content">
        <p className="eyebrow hero-eyebrow"><span className="eyebrow-line" /> Live music. Real moments.</p>
        <h1 id="hero-title">Make a night<br />of <em>it.</em></h1>
        <p className="hero-copy">The artists you love. The venues you’ll remember.<br />Your next favorite night starts right here.</p>
        <a className="hero-button" href="#concerts">Find your next show <span aria-hidden="true">↗</span></a>
      </div>
      <div className="hero-caption"><span className="caption-dot" /> Good music. Better company.</div>
      <div className="hero-count"><strong>01</strong><span> / </span>06</div>
      <div className="hero-bottom">
        <span>Shows across six cities</span>
        <a href="#concerts" aria-label="Scroll to concerts">↓</a>
      </div>
    </section>
  );
}

function EventCard({ event, index, onBook }) {
  const date = formatDate(event.date);
  return (
    <article className="event-card" style={{ "--card-delay": `${Math.min(index, 5) * 70}ms` }}>
      <div className="event-image-wrap">
        <img className="event-image" src={imageUrl(event.image)} alt="" loading="lazy" />
        <span className="genre-tag">{event.genre}</span>
        <span className="date-stamp"><strong>{date.day}</strong><span>{date.month}</span></span>
        <span className="image-scrim" />
        <span className="image-venue">{event.city}, {event.state}</span>
      </div>
      <div className="event-details">
        <div className="event-meta"><span>{event.venue}</span><span className="meta-dot">·</span><span>{formatTime(event.time)}</span></div>
        <h4>{event.title}</h4>
        <div className="event-bottom">
          <span className="price-label">Tickets from <strong>{currency.format(event.startingPrice)}</strong></span>
          <button className="ticket-button" type="button" onClick={() => onBook(event)}>
            Book <span aria-hidden="true">↗</span>
          </button>
        </div>
      </div>
    </article>
  );
}

function BookingDialog({ event, onClose }) {
  const dialogRef = useRef(null);
  const [ticketId, setTicketId] = useState(event.tickets[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState(null);
  const selectedTicket = event.tickets.find((ticket) => ticket.id === Number(ticketId));
  const total = (selectedTicket?.price ?? 0) * quantity;
  const date = formatDate(event.date);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  async function submit(eventObject) {
    eventObject.preventDefault();
    setError("");
    setSubmitting(true);
    const formData = new FormData(eventObject.currentTarget);
    try {
      const result = await fetchJson("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          ticketOptionId: Number(ticketId),
          quantity: Number(formData.get("quantity")),
          name: formData.get("name"),
          email: formData.get("email"),
        }),
      });
      setBooking(result.booking);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <dialog ref={dialogRef} className="booking-dialog" aria-labelledby="booking-title" onCancel={onClose} onClick={(clickEvent) => {
      if (clickEvent.target === clickEvent.currentTarget) onClose();
    }}>
      <button className="dialog-close" type="button" aria-label="Close booking dialog" onClick={onClose}>×</button>
      {!booking ? (
        <div className="booking-content">
          <p className="eyebrow"><span className="eyebrow-line" /> Your next night out</p>
          <h2 id="booking-title">Make it <em>yours.</em></h2>
          <div className="booking-event">
            <img src={imageUrl(event.image, 520)} alt="" />
            <div>
              <span className="booking-genre">{event.genre}</span>
              <h3>{event.title}</h3>
              <p>{event.venue} · {event.city}</p>
              <p>{date.full} · {formatTime(event.time)}</p>
            </div>
          </div>
          <form className="booking-form" onSubmit={submit}>
            <fieldset className="ticket-options">
              <legend>Choose your tickets</legend>
              {event.tickets.map((ticket) => (
                <label className={`ticket-option${ticket.id === Number(ticketId) ? " chosen" : ""}`} key={ticket.id}>
                  <input
                    type="radio"
                    name="ticketOption"
                    value={ticket.id}
                    checked={ticket.id === Number(ticketId)}
                    onChange={() => setTicketId(ticket.id)}
                  />
                  <span className="radio-mark" />
                  <span className="ticket-option-copy"><strong>{ticket.name}</strong><small>{ticket.description}</small></span>
                  <span className="ticket-option-price">{currency.format(ticket.price)}</span>
                </label>
              ))}
            </fieldset>
            <div className="booking-fields">
              <label className="form-label">Your name<input name="name" type="text" required minLength="2" maxLength="100" autoComplete="name" placeholder="Full name" /></label>
              <label className="form-label">Email for your confirmation<input name="email" type="email" required maxLength="254" autoComplete="email" placeholder="you@example.com" /></label>
            </div>
            <div className="checkout-row">
              <label className="quantity-label" htmlFor="ticket-quantity">Tickets
                <select id="ticket-quantity" name="quantity" value={quantity} onChange={(changeEvent) => setQuantity(Number(changeEvent.target.value))}>
                  {Array.from({ length: 8 }, (_, index) => <option value={index + 1} key={index}>{index + 1}</option>)}
                </select>
              </label>
              <div className="total-label"><span>{quantity} × {selectedTicket?.name}</span><strong>{currency.format(total)}</strong></div>
            </div>
            <p className="demo-note">No payment is processed. This creates a demo reservation.</p>
            {error && <p className="booking-error" role="alert">{error}</p>}
            <button className="confirm-button" type="submit" disabled={submitting}>
              {submitting ? "Saving your reservation…" : "Reserve my tickets"} <span aria-hidden="true">↗</span>
            </button>
          </form>
        </div>
      ) : (
        <div className="booking-content">
          <div className="confirmation-icon" aria-hidden="true">✓</div>
          <p className="eyebrow"><span className="eyebrow-line" /> You’re on the list</p>
          <h2 id="booking-title">That’s your <em>night.</em></h2>
          <p className="confirmation-intro">A little something to look forward to, {booking.name.split(" ")[0]}.</p>
          <div className="confirmation-card">
            <div className="confirmation-ticket-top"><span>ASHCONCERT COMPANY</span><span>RESERVATION</span></div>
            <h3>{booking.event}</h3>
            <p>{booking.venue}</p>
            <div className="confirmation-details"><span>{formatDate(booking.date).full}</span><span>{booking.quantity} × {booking.ticket}</span></div>
            <div className="confirmation-reference"><span>Confirmation</span><strong>{booking.reference}</strong></div>
            <div className="confirmation-details"><span>Reservation total</span><strong>{currency.format(booking.total)}</strong></div>
          </div>
          <p className="demo-note">Demo reservation only — no payment was processed.</p>
          <button className="confirm-button done-button" type="button" onClick={onClose}>Sounds good <span aria-hidden="true">✓</span></button>
        </div>
      )}
    </dialog>
  );
}

function VenueCard({ venue, image, onCitySelect }) {
  return (
    <article className="venue-card">
      <div className="venue-image-wrap">
        <img src={imageUrl(image, 700)} alt="" loading="lazy" />
        <span className="venue-type">{venue.type}</span>
        <span className="venue-capacity">{Number(venue.capacity).toLocaleString()} capacity</span>
      </div>
      <div className="venue-card-copy">
        <div><h3>{venue.name}</h3><p>{venue.city}, {venue.state}</p></div>
        <button className="venue-arrow" type="button" aria-label={`See shows in ${venue.city}`} onClick={() => onCitySelect(venue.city)}>↗</button>
      </div>
    </article>
  );
}

function App() {
  const [events, setEvents] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [city, setCity] = useState("All cities");
  const [genre, setGenre] = useState("All genres");
  const [sort, setSort] = useState("date");
  const [bookingEvent, setBookingEvent] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([fetchJson("/api/events"), fetchJson("/api/venues")])
      .then(([eventPayload, venuePayload]) => {
        if (!active) return;
        setEvents(eventPayload.events);
        setVenues(venuePayload.venues);
      })
      .catch((error) => { if (active) setLoadError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const genres = useMemo(() => [...new Set(events.map((event) => event.genre))], [events]);
  const cities = useMemo(() => [...new Set(venues.map((venue) => venue.city))].sort(), [venues]);
  const visibleEvents = useMemo(() => {
    const filtered = events.filter((event) => {
      const text = `${event.title} ${event.artist} ${event.venue} ${event.city} ${event.genre}`.toLowerCase();
      return (!query || text.includes(query.toLowerCase()))
        && (city === "All cities" || event.city === city)
        && (genre === "All genres" || event.genre === genre);
    });
    return sort === "price" ? [...filtered].sort((a, b) => a.startingPrice - b.startingPrice) : filtered;
  }, [events, query, city, genre, sort]);

  const eventByCity = new Map(events.map((event) => [event.city, event.image]));

  function chooseCity(nextCity) {
    setCity(nextCity);
    document.querySelector("#concerts")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <>
      <Header />
      <main>
        <Hero />
        <section className="discovery-section section-wrap" id="concerts">
          <div className="section-heading">
            <div><p className="eyebrow"><span className="eyebrow-line" /> Find your frequency</p><h2>Make it a <em>live one.</em></h2></div>
            <p className="section-intro">Big voices, small rooms, and the kind of nights<br className="desktop-only" /> you’ll talk about long after the encore.</p>
          </div>
          <form className="search-panel" onSubmit={(submitEvent) => { submitEvent.preventDefault(); setQuery(searchInput.trim()); }}>
            <label className="search-field">
              <span className="input-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4 4" /></svg></span>
              <span className="field-copy"><span>I’m looking for</span><input type="search" value={searchInput} onChange={(changeEvent) => { setSearchInput(changeEvent.target.value); setQuery(changeEvent.target.value.trim()); }} placeholder="Artist, venue, or show" autoComplete="off" /></span>
            </label>
            <span className="search-divider" />
            <label className="search-field city-field">
              <span className="input-icon pin-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M19 10.2c0 5.3-7 11-7 11s-7-5.7-7-11a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.3" /></svg></span>
              <span className="field-copy"><span>Where to?</span>
                <select aria-label="Filter by city" value={city} onChange={(changeEvent) => setCity(changeEvent.target.value)}>
                  <option>All cities</option>{cities.map((cityName) => <option key={cityName}>{cityName}</option>)}
                </select>
              </span>
            </label>
            <button className="search-button" type="submit">Find a show <span aria-hidden="true">↗</span></button>
          </form>
          <div className="filter-row">
            <div className="filter-chips" aria-label="Filter by music style">
              <button className={`filter-chip${genre === "All genres" ? " selected" : ""}`} type="button" onClick={() => setGenre("All genres")}>All shows <span>{String(events.length).padStart(2, "0")}</span></button>
              {genres.map((item) => (
                <button className={`filter-chip${genre === item ? " selected" : ""}`} type="button" key={item} onClick={() => setGenre(item)}>
                  {item} <span>{String(events.filter((event) => event.genre === item).length).padStart(2, "0")}</span>
                </button>
              ))}
            </div>
            <label className="sort-control">Sort by <select aria-label="Sort concerts" value={sort} onChange={(changeEvent) => setSort(changeEvent.target.value)}><option value="date">Date</option><option value="price">Price: low to high</option></select></label>
          </div>
          <div className="results-heading">
            <h3>Coming up <span className="heading-period">·</span> <span>{String(visibleEvents.length).padStart(2, "0")} {visibleEvents.length === 1 ? "show" : "shows"}</span></h3>
            <a href="#venues" className="text-link">Explore our venues <span aria-hidden="true">↗</span></a>
          </div>
          {loading && <div className="loading-state"><span className="spinner" /> Finding your next favorite show…</div>}
          {loadError && <p className="load-error" role="alert">{loadError}</p>}
          {!loading && !loadError && visibleEvents.length > 0 && (
            <div className="event-grid">{visibleEvents.map((event, index) => <EventCard key={event.id} event={event} index={index} onBook={setBookingEvent} />)}</div>
          )}
          {!loading && !loadError && visibleEvents.length === 0 && (
            <div className="empty-state"><span className="empty-icon">♪</span><h3>No shows found just yet.</h3><p>Try a different city or search for another artist.</p><button className="text-button" type="button" onClick={() => { setSearchInput(""); setQuery(""); setCity("All cities"); setGenre("All genres"); }}>Clear your filters</button></div>
          )}
        </section>

        <section className="venues-section" id="venues">
          <div className="section-wrap">
            <div className="section-heading venue-heading">
              <div><p className="eyebrow"><span className="eyebrow-line" /> The places that make it</p><h2>Great rooms.<br /><em>Even better nights.</em></h2></div>
              <p className="section-intro">From intimate theaters to arena-sized singalongs,<br className="desktop-only" /> there’s a stage with your name on it.</p>
            </div>
            <div className="venue-grid">
              {venues.map((venue) => <VenueCard key={venue.id} venue={venue} image={eventByCity.get(venue.city) ?? "photo-1492684223066-81342ee5ff30"} onCitySelect={chooseCity} />)}
            </div>
          </div>
        </section>

        <section className="about-section section-wrap" id="about">
          <div className="about-mark" aria-hidden="true"><svg viewBox="0 0 100 100"><path d="M14 54V46M32 73V27M50 88V12M68 70V30M86 56V44" /></svg></div>
          <div className="about-copy">
            <p className="eyebrow"><span className="eyebrow-line" /> Here for the feeling</p>
            <h2>Some nights just<br />stay <em>with you.</em></h2>
            <p>We bring artists and audiences together in the rooms that make live music feel like it’s just for you. Find your people, find your place, and let the first note do the rest.</p>
          </div>
          <div className="about-note"><span className="note-dash" /><span>Good music has a way<br />of bringing us closer.</span></div>
        </section>
      </main>
      <footer className="site-footer">
        <Brand footer />
        <p>Go where the music takes you.</p>
        <span className="footer-copy">© 2026 ashConcert Company · Made for music people</span>
      </footer>
      {bookingEvent && <BookingDialog event={bookingEvent} onClose={() => setBookingEvent(null)} />}
    </>
  );
}

export default App;
