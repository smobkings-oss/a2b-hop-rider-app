const STORE = { rides: "a2b-hop-rides", profile: "a2b-hop-profile", places: "a2b-hop-places" };
const PLACES = [
  { label: "Downtown Toledo", address: "1 Government Center, Toledo, OH 43604", lat: 41.6528, lng: -83.5379 },
  { label: "Fifth Third Field", address: "406 Washington St, Toledo, OH 43604", lat: 41.646, lng: -83.538 },
  { label: "Franklin Park Mall", address: "5001 Monroe St, Toledo, OH 43623", lat: 41.697, lng: -83.623 },
  { label: "University of Toledo", address: "2801 W Bancroft St, Toledo, OH 43606", lat: 41.657, lng: -83.614 },
  { label: "ProMedica Toledo Hospital", address: "2142 N Cove Blvd, Toledo, OH 43606", lat: 41.678, lng: -83.577 },
  { label: "Hollywood Casino", address: "1968 Miami St, Toledo, OH 43605", lat: 41.628, lng: -83.512 },
  { label: "Toledo Express (TOL)", address: "11013 Airport Hwy, Swanton, OH 43558", lat: 41.587, lng: -83.805 },
  { label: "Levis Commons", address: "3201 Levis Commons Blvd, Perrysburg, OH 43551", lat: 41.535, lng: -83.642 },
  { label: "Perrysburg", address: "201 W Indiana Ave, Perrysburg, OH 43551", lat: 41.557, lng: -83.627 },
  { label: "Maumee", address: "400 Conant St, Maumee, OH 43537", lat: 41.563, lng: -83.654 },
  { label: "Sylvania", address: "6730 Monroe St, Sylvania, OH 43560", lat: 41.719, lng: -83.709 },
  { label: "Holland", address: "1245 Clarion Ave, Holland, OH 43528", lat: 41.619, lng: -83.71 },
  { label: "Rossford", address: "133 Osborn St, Rossford, OH 43460", lat: 41.609, lng: -83.564 },
  { label: "Bowling Green", address: "304 N Church St, Bowling Green, OH 43402", lat: 41.374, lng: -83.651 },
  { label: "Findlay", address: "318 Dorney Plaza, Findlay, OH 45840", lat: 41.044, lng: -83.65 },
  { label: "Fremont", address: "323 S Front St, Fremont, OH 43420", lat: 41.35, lng: -83.122 },
  { label: "Tiffin", address: "51 E Market St, Tiffin, OH 44883", lat: 41.114, lng: -83.178 },
  { label: "Detroit Metro (DTW)", address: "Detroit Metropolitan Airport, Romulus, MI 48174", lat: 42.216, lng: -83.355 },
  { label: "Ann Arbor", address: "110 E Huron St, Ann Arbor, MI 48104", lat: 42.281, lng: -83.744 },
  { label: "Cleveland Hopkins (CLE)", address: "5300 Riverside Dr, Cleveland, OH 44135", lat: 41.411, lng: -81.838 }
];
const VEHICLES = [
  { id: "comfort", name: "Comfort", blurb: "Everyday hop · up to 4", multiplier: 1 },
  { id: "tesla", name: "Tesla Navigator", blurb: "Quiet Model 3 fleet", multiplier: 1.15 },
  { id: "xl", name: "XL", blurb: "Up to 6 riders", multiplier: 1.35 }
];
const DRIVERS = [
  { name: "Maya Chen", vehicle: "Tesla Model 3", plate: "A2B-301", rating: 4.98 },
  { name: "Jordan Hale", vehicle: "Tesla Model 3", plate: "A2B-118", rating: 4.95 },
  { name: "Alex Ruiz", vehicle: "Comfort sedan", plate: "A2B-224", rating: 4.92 }
];
const STEPS = ["Matching", "Assigned", "En Route", "Arrived", "In Progress", "Completed"];
const app = document.getElementById("app");
const state = {
  screen: "book", mode: "now", vehicle: "tesla", passengers: 1, payment: "card",
  notes: "", flight: "", pickup: null, dropoff: null, date: "", time: "",
  focus: "pickup", query: "", activeId: null
};
let map, tick;

function load(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function save(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function profile() { return load(STORE.profile, null); }
function rides() { return load(STORE.rides, []); }
function savedPlaces() { return load(STORE.places, { home: null, work: null }); }
function money(n) { return `$${Number(n).toFixed(2)}`; }
function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;")
    .replace(/"/g, "&" + "quot;")
    .replace(/'/g, "&#" + "39;");
}
function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2400);
}
function eastern(mins) {
  const d = new Date(Date.now() + mins * 60000);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t).value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}
function haversine(a, b) {
  const r = 3958.8, p = Math.PI / 180, dLat = (b.lat - a.lat) * p, dLng = (b.lng - a.lng) * p;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * p) * Math.cos(b.lat * p) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}
function pinFor(text) {
  const q = (text || "").toLowerCase();
  const known = PLACES.find((p) => q.includes(p.label.toLowerCase()) || q.includes(p.address.toLowerCase().slice(0, 18)));
  if (known) return { ...known };
  let h = 0;
  for (const c of q) h = (h * 33 + c.charCodeAt(0)) >>> 0;
  return { label: text, address: text, lat: 41.56 + ((h % 900) - 450) / 9000, lng: -83.62 + (((h >> 9) % 900) - 450) / 9000 };
}
function surcharge(date, time) {
  const day = new Date(`${date}T12:00:00`).getDay();
  const [h, m] = String(time || "12:00").split(":").map(Number);
  const t = h * 60 + m;
  let percent = 0, label = "Standard A2B rate";
  const set = (p, l) => { if (p > percent) { percent = p; label = l; } };
  if ([4, 5, 6].includes(day) && t >= 20 * 60 && t < 22 * 60) set(10, "Thu–Sat evening");
  if ([4, 5, 6].includes(day) && (t >= 22 * 60 || t < 3 * 60 + 46)) set(20, "Thu–Sat late night");
  if (day >= 1 && day <= 5 && t >= 7 * 60 && t < 8 * 60) set(15, "Weekday morning");
  if (day >= 1 && day <= 5 && t >= 16 * 60 + 30 && t < 18 * 60) set(12, "Weekday evening");
  return { percent, label };
}
function quote() {
  if (!state.pickup || !state.dropoff) return null;
  const miles = Math.max(1.4, haversine(state.pickup, state.dropoff) * 1.18);
  const minutes = Math.max(8, Math.round(miles * 2.15 + 5));
  const airport = /airport|tol|dtw|cle/i.test(`${state.pickup.address} ${state.dropoff.address} ${state.flight}`);
  const when = state.mode === "now" ? eastern(8) : { date: state.date, time: state.time };
  const base = 3.5;
  const distance = miles * 1.65;
  const timeFare = minutes * 0.25;
  const airportFee = airport ? 10 : 0;
  const subtotal = Math.max(12, base + distance + timeFare + airportFee);
  const surge = surcharge(when.date, when.time);
  const vehicle = VEHICLES.find((v) => v.id === state.vehicle);
  const surgeAmt = subtotal * surge.percent / 100;
  const total = (subtotal + surgeAmt) * vehicle.multiplier;
  return { miles, minutes, airport, base, distance, timeFare, airportFee, subtotal, surge, surgeAmt, total, vehicle, when };
}
function uid() { return `HOP-${Math.random().toString(36).slice(2, 6).toUpperCase()}${Date.now().toString(36).slice(-3).toUpperCase()}`; }
function go(screen) { state.screen = screen; render(); }
function nav(active) {
  return `<nav class="nav">
    <button class="${active === "book" ? "on" : ""}" data-go="book">Hop</button>
    <button class="${active === "schedule" ? "on" : ""}" data-go="schedule">Schedule</button>
    <button class="${active === "rides" ? "on" : ""}" data-go="rides">Rides</button>
    <button class="${active === "account" ? "on" : ""}" data-go="account">You</button>
  </nav>`;
}
function bindNav() {
  app.querySelectorAll("[data-go]").forEach((btn) => btn.onclick = () => {
    if (btn.dataset.go === "schedule") { state.mode = "later"; state.screen = "book"; if (!state.date) Object.assign(state, eastern(90)); }
    else if (btn.dataset.go === "book") { state.mode = "now"; state.screen = "book"; }
    else state.screen = btn.dataset.go;
    render();
  });
}
function render() {
  clearInterval(tick);
  if (map) { map.remove(); map = null; }
  if (!profile()) return renderJoin();
  if (state.screen === "search") return renderSearch();
  if (state.screen === "options") return renderOptions();
  if (state.screen === "confirm") return renderConfirm();
  if (state.screen === "live") return renderLive();
  if (state.screen === "rides") return renderRides();
  if (state.screen === "account") return renderAccount();
  renderBook();
}

function renderJoin() {
  app.innerHTML = `<section class="splash"><div>
    <div class="mark">A2</div>
    <h1 class="hologram">A2B HOP</h1>
    <p class="muted">Instant hops and scheduled rides. Northwest Ohio & southeast Michigan.</p>
    <div class="card" style="text-align:left;margin-top:18px">
      <label>Your name</label><input id="name" placeholder="Alex Rivera" autocomplete="name" />
      <div style="height:10px"></div>
      <label>Mobile</label><input id="phone" placeholder="419-555-0142" inputmode="tel" autocomplete="tel" />
    </div>
    <button class="cta" id="join">Hop on</button>
    <p class="small">Orders stay on this phone until a driver accepts. Card checkout finishes on a2bridesohio.com.</p>
  </div></section>`;
  document.getElementById("join").onclick = () => {
    const name = document.getElementById("name").value.trim();
    const phone = document.getElementById("phone").value.trim();
    if (name.length < 2 || phone.replace(/\D/g, "").length < 10) return toast("Enter your name and a 10-digit phone.");
    save(STORE.profile, { name, phone });
    state.screen = "book";
    render();
  };
}

function renderBook() {
  const q = quote();
  const saved = savedPlaces();
  app.innerHTML = `<div class="map-stage" id="map"></div>
    <div class="sheet">
      <div class="handle"></div>
      <div class="top" style="margin-bottom:8px"><div class="brand"><div class="mark">A2</div><div><h1>A2B HOP</h1><p>Premium rides. Local drivers.</p></div></div><span class="pill">${esc(profile().name.split(" ")[0])}</span></div>
      <div class="modes"><button class="${state.mode === "now" ? "on" : ""}" data-mode="now">Hop now</button><button class="${state.mode === "later" ? "on" : ""}" data-mode="later">Schedule</button></div>
      <button class="field" id="pick"><i></i><div><b>${state.pickup ? esc(state.pickup.label) : "Pickup"}</b><span>${state.pickup ? esc(state.pickup.address) : "Where should we meet you?"}</span></div></button>
      <button class="field drop" id="drop"><i></i><div><b>${state.dropoff ? esc(state.dropoff.label) : "Dropoff"}</b><span>${state.dropoff ? esc(state.dropoff.address) : "Where are you headed?"}</span></div></button>
      <div class="chips">
        ${saved.home ? `<button data-saved="home">Home</button>` : ""}
        ${saved.work ? `<button data-saved="work">Work</button>` : ""}
        <button id="loc">Current location</button>
        <button data-quick="Fifth Third Field">Fifth Third</button>
        <button data-quick="Toledo Express (TOL)">TOL Airport</button>
        <button data-quick="Franklin Park Mall">Franklin Park</button>
      </div>
      <div class="fare" style="margin-top:12px"><div><div class="small">${q ? `${q.miles.toFixed(1)} mi · ${q.minutes} min` : "Add both stops for a quote"}</div><b>${q ? money(q.total) : "—"}</b></div>
      <button class="cta" id="next" style="width:auto;padding:12px 16px">${state.mode === "now" ? "Review hop" : "Set time"}</button></div>
    </div>${nav(state.mode === "later" ? "schedule" : "book")}`;
  bindNav();
  drawRoute(state.pickup, state.dropoff);
  app.querySelectorAll("[data-mode]").forEach((btn) => btn.onclick = () => {
    state.mode = btn.dataset.mode;
    if (state.mode === "later" && !state.date) Object.assign(state, eastern(90));
    render();
  });
  document.getElementById("pick").onclick = () => { state.focus = "pickup"; state.query = ""; go("search"); };
  document.getElementById("drop").onclick = () => { state.focus = "dropoff"; state.query = ""; go("search"); };
  document.getElementById("loc").onclick = useLocation;
  app.querySelectorAll("[data-saved]").forEach((btn) => btn.onclick = () => assignPlace(saved[btn.dataset.saved]));
  app.querySelectorAll("[data-quick]").forEach((btn) => btn.onclick = () => assignPlace(PLACES.find((p) => p.label === btn.dataset.quick)));
  document.getElementById("next").onclick = () => {
    if (!quote()) return toast("Choose a pickup and a dropoff.");
    if (state.pickup.address === state.dropoff.address) return toast("Pickup and dropoff need to be different.");
    if (state.mode === "later" && !state.date) Object.assign(state, eastern(90));
    go("options");
  };
}
function assignPlace(place) {
  if (!place) return;
  if (!state.pickup || state.focus === "pickup") state.pickup = place;
  else state.dropoff = place;
  state.focus = state.pickup && !state.dropoff ? "dropoff" : "pickup";
  render();
}
function useLocation() {
  if (!navigator.geolocation) return toast("Location is not available in this browser.");
  navigator.geolocation.getCurrentPosition((pos) => {
    state.pickup = { label: "Current location", address: `Near ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`, lat: pos.coords.latitude, lng: pos.coords.longitude };
    render();
  }, () => toast("Location permission is off."));
}

function renderSearch() {
  const q = state.query.trim().toLowerCase();
  const hits = PLACES.filter((p) => !q || `${p.label} ${p.address}`.toLowerCase().includes(q)).slice(0, 8);
  app.innerHTML = `<section class="pad"><button class="back" id="back">← Back</button>
    <h2>${state.focus === "pickup" ? "Pickup" : "Dropoff"}</h2>
    <input id="q" placeholder="Search Toledo, Perrysburg, airport…" value="${esc(state.query)}" />
    <div style="height:10px"></div>
    <div class="search-list">
      ${hits.map((p, i) => `<button data-i="${i}"><strong>${esc(p.label)}</strong><span class="small">${esc(p.address)}</span></button>`).join("")}
      ${q.length > 3 ? `<button id="custom"><strong>Use “${esc(state.query.trim())}”</strong><span class="small">Custom address</span></button>` : ""}
    </div></section>`;
  const input = document.getElementById("q");
  input.focus();
  input.oninput = () => { state.query = input.value; renderSearch(); document.getElementById("q").focus(); document.getElementById("q").setSelectionRange(state.query.length, state.query.length); };
  document.getElementById("back").onclick = () => go("book");
  app.querySelectorAll("[data-i]").forEach((btn) => btn.onclick = () => choose(hits[Number(btn.dataset.i)]));
  const custom = document.getElementById("custom");
  if (custom) custom.onclick = () => choose(pinFor(state.query.trim()));
}
function choose(place) {
  state[state.focus] = place;
  state.query = "";
  go("book");
}

function renderOptions() {
  const q = quote();
  if (!q) return go("book");
  const soon = eastern(90);
  app.innerHTML = `<section class="pad"><button class="back" id="back">← Trip</button>
    <div class="top"><div class="brand"><div class="mark">A2</div><div><h1>${state.mode === "now" ? "Hop now" : "Schedule"}</h1><p>${esc(state.pickup.label)} → ${esc(state.dropoff.label)}</p></div></div></div>
    ${state.mode === "later" ? `<div class="card"><div class="row"><div><label>Date</label><input id="date" type="date" value="${esc(state.date || soon.date)}" /></div><div><label>Time</label><input id="time" type="time" value="${esc(state.time || soon.time)}" /></div></div>
      <div class="chips" style="margin-top:10px"><button data-when="90">In 90 min</button><button data-when="tomorrow">Tomorrow 7:30 AM</button><button data-when="tonight">Tonight 9:00 PM</button></div>
      <p class="small">Scheduled hops need at least 30 minutes notice. We’ll keep this ride on your phone and ready for dispatch.</p></div>` : `<p class="small">Pickup window is about 8 minutes after you confirm.</p>`}
    <div class="card"><label>Vehicle</label><div class="vehicles">${VEHICLES.map((v) => `<button class="${state.vehicle === v.id ? "on" : ""}" data-vehicle="${v.id}"><div><strong>${v.name}</strong><span>${v.blurb}</span></div><span>${money(q.subtotal * v.multiplier)}</span></button>`).join("")}</div>
      <div class="row" style="margin-top:10px"><div><label>Riders</label><select id="passengers">${[1, 2, 3, 4, 5, 6].map((n) => `<option ${state.passengers === n ? "selected" : ""}>${n}</option>`).join("")}</select></div>
      <div><label>Pay</label><select id="payment"><option value="card" ${state.payment === "card" ? "selected" : ""}>Card on site</option><option value="cash" ${state.payment === "cash" ? "selected" : ""}>Cash to driver</option></select></div></div></div>
    <div class="card"><label>Note for the driver</label><textarea id="notes" placeholder="Gate, luggage, flight">${esc(state.notes)}</textarea>
      ${q.airport ? `<div style="height:8px"></div><label>Flight</label><input id="flight" value="${esc(state.flight)}" placeholder="AA 1234" />` : ""}</div>
    <button class="cta" id="next">Review ${money(q.total)}</button>
    ${nav(state.mode === "later" ? "schedule" : "book")}</section>`;
  bindNav();
  document.getElementById("back").onclick = () => go("book");
  app.querySelectorAll("[data-vehicle]").forEach((btn) => btn.onclick = () => { readOptions(); state.vehicle = btn.dataset.vehicle; render(); });
  app.querySelectorAll("[data-when]").forEach((btn) => btn.onclick = () => {
    if (btn.dataset.when === "90") Object.assign(state, eastern(90));
    if (btn.dataset.when === "tomorrow") { const d = eastern(24 * 60); state.date = d.date; state.time = "07:30"; }
    if (btn.dataset.when === "tonight") { const d = eastern(0); state.date = d.date; state.time = "21:00"; }
    render();
  });
  document.getElementById("next").onclick = () => { readOptions(); if (!validSchedule()) return; go("confirm"); };
}
function readOptions() {
  const get = (id) => document.getElementById(id)?.value;
  state.date = get("date") ?? state.date;
  state.time = get("time") ?? state.time;
  state.passengers = Number(get("passengers") || state.passengers);
  state.payment = get("payment") || state.payment;
  state.notes = get("notes") ?? state.notes;
  state.flight = get("flight") ?? state.flight;
}
function validSchedule() {
  if (state.mode !== "later") return true;
  if (!state.date || !state.time) { toast("Pick a date and time."); return false; }
  const when = new Date(`${state.date}T${state.time}`);
  if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() + 30 * 60000) { toast("Schedule at least 30 minutes ahead."); return false; }
  return true;
}

function renderConfirm() {
  const q = quote();
  if (!q) return go("book");
  app.innerHTML = `<section class="pad"><button class="back" id="back">← Edit</button>
    <div class="top"><div class="brand"><div class="mark">A2</div><div><h1>${state.mode === "now" ? "Confirm hop" : "Confirm schedule"}</h1><p>${esc(q.when.date)} · ${esc(q.when.time)} ET</p></div></div></div>
    <div class="card"><div class="small">Pickup</div><strong>${esc(state.pickup.address)}</strong><hr /><div class="small">Dropoff</div><strong>${esc(state.dropoff.address)}</strong>
      <hr /><div class="breakdown">
        <div><span>Base</span><span>${money(q.base)}</span></div>
        <div><span>${q.miles.toFixed(1)} mi</span><span>${money(q.distance)}</span></div>
        <div><span>${q.minutes} min</span><span>${money(q.timeFare)}</span></div>
        ${q.airport ? `<div><span>Airport</span><span>${money(q.airportFee)}</span></div>` : ""}
        <div><span>${q.surge.label}</span><span>${q.surge.percent ? "+" + q.surge.percent + "%" : "included"}</span></div>
        <div><span>${q.vehicle.name}</span><span>× ${q.vehicle.multiplier.toFixed(2)}</span></div>
      </div><hr /><div class="fare"><span>${state.passengers} rider${state.passengers > 1 ? "s" : ""} · ${state.payment}</span><b>${money(q.total)}</b></div>
      <p class="small">Estimate only. Drivers keep the majority. ${state.payment === "card" ? "Card checkout finishes on a2bridesohio.com." : "Cash is paid to the driver."}</p></div>
    <button class="cta" id="place">${state.mode === "now" ? "Place hop" : "Schedule ride"}</button>
    <div style="height:8px"></div>
    <button class="ghost" id="dispatch">Send to live dispatch</button>
    ${nav("book")}</section>`;
  bindNav();
  document.getElementById("back").onclick = () => go("options");
  document.getElementById("place").onclick = placeRide;
  document.getElementById("dispatch").onclick = () => { placeRide(true); };
}
function placeRide(openDispatch) {
  if (!validSchedule()) return;
  const q = quote();
  const ride = {
    id: uid(), when: state.mode, pickup: state.pickup, dropoff: state.dropoff,
    date: q.when.date, time: q.when.time, passengers: state.passengers, payment: state.payment,
    notes: state.notes, flight: state.flight, vehicle: q.vehicle.name, vehicleId: q.vehicle.id,
    fare: Number(q.total.toFixed(2)), miles: Number(q.miles.toFixed(1)), minutes: q.minutes,
    status: state.mode === "now" ? "Matching" : "Scheduled", createdAt: Date.now(), rider: profile(), driver: null, rating: 0
  };
  const all = rides();
  all.unshift(ride);
  save(STORE.rides, all);
  state.activeId = ride.id;
  toast(state.mode === "now" ? "Hop placed. Finding a driver." : "Ride scheduled.");
  if (openDispatch === true) window.open(dispatchUrl(ride), "_blank", "noopener");
  state.screen = state.mode === "now" ? "live" : "rides";
  render();
}
function dispatchUrl(ride) {
  const params = new URLSearchParams({ pickup: ride.pickup.address, dropoff: ride.dropoff.address, when: ride.when, date: ride.date, time: ride.time, vehicle: ride.vehicle, fare: String(ride.fare), id: ride.id });
  return `https://a2bridesohio.com/?${params.toString()}`;
}

function rideById(id) { return rides().find((r) => r.id === id); }
function updateRide(id, patch) {
  const all = rides().map((r) => r.id === id ? { ...r, ...patch } : r);
  save(STORE.rides, all);
  return all.find((r) => r.id === id);
}
function advance(ride) {
  if (ride.when !== "now" || ["Completed", "Canceled", "Scheduled"].includes(ride.status)) return ride;
  const elapsed = (Date.now() - ride.createdAt) / 1000;
  let status = "Matching", driver = ride.driver;
  if (elapsed > 4) { status = "Assigned"; driver = driver || DRIVERS[ride.vehicleId === "comfort" ? 2 : 0]; }
  if (elapsed > 9) status = "En Route";
  if (elapsed > 22) status = "Arrived";
  if (elapsed > 30) status = "In Progress";
  if (elapsed > 30 + Math.min(ride.minutes, 25)) status = "Completed";
  if (status !== ride.status || (!ride.driver && driver)) return updateRide(ride.id, { status, driver });
  return ride;
}
function renderLive() {
  let ride = rideById(state.activeId) || rides().find((r) => !["Completed", "Canceled", "Scheduled"].includes(r.status));
  if (!ride) return go("rides");
  state.activeId = ride.id;
  ride = advance(ride);
  const idx = Math.max(0, STEPS.indexOf(ride.status));
  app.innerHTML = `<div class="map-stage" id="map"></div>
    <div class="live-card card">
      <div class="status">${esc(ride.status)} · ${esc(ride.id)}</div>
      <strong>${esc(ride.driver ? ride.driver.name : "Finding your driver")}</strong>
      <div class="small">${ride.driver ? `${esc(ride.driver.vehicle)} · ${esc(ride.driver.plate)} · ${ride.driver.rating}★` : "Nearby A2B drivers are being offered this hop."}</div>
      <div class="timeline">${STEPS.map((s, i) => `<div class="step ${i <= idx ? "on" : ""}"><span class="dot"></span>${s}</div>`).join("")}</div>
      <div class="small">${esc(ride.pickup.label)} → ${esc(ride.dropoff.label)}</div>
      <div class="fare"><span>${esc(ride.payment)} · ${esc(ride.vehicle)}</span><b>${money(ride.fare)}</b></div>
      <div class="row"><button class="ghost" id="share">Share</button>${ride.status === "Completed" ? "" : `<button class="danger" id="cancel">Cancel</button>`}</div>
      ${ride.status === "Completed" ? `<div class="stars">${[1, 2, 3, 4, 5].map((n) => `<button data-star="${n}">${n <= ride.rating ? "★" : "☆"}</button>`).join("")}</div>` : ""}
    </div>${nav("rides")}`;
  bindNav();
  drawLive(ride);
  document.getElementById("share").onclick = () => shareTrip(ride);
  const cancel = document.getElementById("cancel");
  if (cancel) cancel.onclick = () => { updateRide(ride.id, { status: "Canceled" }); toast("Hop canceled."); go("rides"); };
  app.querySelectorAll("[data-star]").forEach((btn) => btn.onclick = () => { updateRide(ride.id, { rating: Number(btn.dataset.star) }); toast("Thanks — that stays with this hop."); render(); });
  if (!["Completed", "Canceled"].includes(ride.status)) tick = setInterval(render, 2000);
}
function shareTrip(ride) {
  const text = `A2B Hop ${ride.id}: ${ride.pickup.address} → ${ride.dropoff.address}. Status ${ride.status}.`;
  if (navigator.share) navigator.share({ title: "A2B Hop", text }).catch(() => {});
  else { navigator.clipboard?.writeText(text); toast("Trip details copied."); }
}

function renderRides() {
  const all = rides();
  const upcoming = all.filter((r) => r.status === "Scheduled");
  const active = all.filter((r) => !["Scheduled", "Completed", "Canceled"].includes(r.status));
  const past = all.filter((r) => ["Completed", "Canceled"].includes(r.status));
  const card = (r) => `<article class="ride"><div class="status">${esc(r.status)} · ${esc(r.when === "now" ? "Instant" : "Scheduled")}</div><h3>${esc(r.pickup.label)} → ${esc(r.dropoff.label)}</h3><div class="small">${esc(r.date)} ${esc(r.time)} ET · ${esc(r.vehicle)} · ${money(r.fare)}</div>
    <div class="row" style="margin-top:8px">${r.status === "Scheduled" || !["Completed", "Canceled", "Scheduled"].includes(r.status) ? `<button class="ghost" data-open="${esc(r.id)}">${r.status === "Scheduled" ? "View" : "Track"}</button>` : `<button class="ghost" data-rebook="${esc(r.id)}">Rebook</button>`}
    ${r.status === "Scheduled" ? `<button class="danger" data-cancel="${esc(r.id)}">Cancel</button>` : ""}</div></article>`;
  app.innerHTML = `<section class="pad"><div class="top"><div class="brand"><div class="mark">A2</div><div><h1>Your rides</h1><p>${all.length} on this phone</p></div></div></div>
    ${active.length ? `<h3>Live</h3><div class="list">${active.map(card).join("")}</div>` : ""}
    <h3>Scheduled</h3>${upcoming.length ? upcoming.map(card).join("") : `<div class="empty">No scheduled rides yet.</div>`}
    <h3>Past</h3>${past.length ? past.map(card).join("") : `<div class="empty">Finished hops show up here.</div>`}
    ${nav("rides")}</section>`;
  bindNav();
  app.querySelectorAll("[data-open]").forEach((btn) => btn.onclick = () => { state.activeId = btn.dataset.open; const ride = rideById(state.activeId); go(ride?.status === "Scheduled" ? "rides" : "live"); if (ride?.status === "Scheduled") toast(`${ride.date} at ${ride.time} ET · ${ride.pickup.label}`); });
  app.querySelectorAll("[data-cancel]").forEach((btn) => btn.onclick = () => { updateRide(btn.dataset.cancel, { status: "Canceled" }); toast("Scheduled ride canceled."); render(); });
  app.querySelectorAll("[data-rebook]").forEach((btn) => btn.onclick = () => {
    const ride = rideById(btn.dataset.rebook);
    state.pickup = ride.pickup; state.dropoff = ride.dropoff; state.vehicle = ride.vehicleId || "tesla"; state.mode = "now"; go("book");
  });
}

function renderAccount() {
  const p = profile();
  const saved = savedPlaces();
  app.innerHTML = `<section class="pad"><div class="top"><div class="brand"><div class="mark">A2</div><div><h1>${esc(p.name)}</h1><p>${esc(p.phone)}</p></div></div></div>
    <div class="card"><label>Saved places</label>
      <p class="small">Home: ${saved.home ? esc(saved.home.label) : "not set"} · Work: ${saved.work ? esc(saved.work.label) : "not set"}</p>
      <div class="row"><button class="ghost" id="home">Save pickup as Home</button><button class="ghost" id="work">Save pickup as Work</button></div></div>
    <div class="card"><strong>Service area</strong><p class="small">Toledo, Perrysburg, Maumee, Sylvania, Holland, Rossford, Bowling Green, Findlay, Fremont, Tiffin, plus DTW, Ann Arbor, and CLE airport hops.</p>
      <p class="small">Anytime Anywhere Solutions LLC DBA A2B Rides. Add this app to your home screen for a full-screen hop.</p></div>
    <button class="ghost" id="site">Open a2bridesohio.com</button>
    <div style="height:8px"></div>
    <button class="danger" id="out">Sign out of this phone</button>
    ${nav("account")}</section>`;
  bindNav();
  document.getElementById("home").onclick = () => saveSlot("home");
  document.getElementById("work").onclick = () => saveSlot("work");
  document.getElementById("site").onclick = () => window.open("https://a2bridesohio.com", "_blank", "noopener");
  document.getElementById("out").onclick = () => { localStorage.removeItem(STORE.profile); render(); };
}
function saveSlot(slot) {
  if (!state.pickup) return toast("Set a pickup on the Hop tab first.");
  const saved = savedPlaces();
  saved[slot] = state.pickup;
  save(STORE.places, saved);
  toast(`${slot === "home" ? "Home" : "Work"} saved.`);
  render();
}

function drawRoute(from, to) {
  if (!window.L) return;
  map = L.map("map", { zoomControl: false, attributionControl: false }).setView([41.6528, -83.5379], 11);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(map);
  const pts = [from, to].filter(Boolean);
  pts.forEach((p, i) => L.marker([p.lat, p.lng]).addTo(map).bindTooltip(i ? "Dropoff" : "Pickup", { permanent: true, direction: "top", className: "pin" }));
  if (pts.length === 2) {
    L.polyline(pts.map((p) => [p.lat, p.lng]), { color: "#e6c35c", weight: 4 }).addTo(map);
    map.fitBounds(pts.map((p) => [p.lat, p.lng]), { padding: [30, 160] });
  }
  setTimeout(() => map.invalidateSize(), 80);
}
function drawLive(ride) {
  if (!window.L) return;
  map = L.map("map", { zoomControl: false, attributionControl: false }).setView([ride.pickup.lat, ride.pickup.lng], 13);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(map);
  L.marker([ride.pickup.lat, ride.pickup.lng]).addTo(map).bindTooltip("Pickup", { permanent: true, className: "pin" });
  L.marker([ride.dropoff.lat, ride.dropoff.lng]).addTo(map).bindTooltip("Dropoff", { permanent: true, className: "pin" });
  L.polyline([[ride.pickup.lat, ride.pickup.lng], [ride.dropoff.lat, ride.dropoff.lng]], { color: "#e6c35c", weight: 4 }).addTo(map);
  const elapsed = (Date.now() - ride.createdAt) / 1000;
  const start = { lat: ride.pickup.lat + 0.02, lng: ride.pickup.lng - 0.02 };
  let pos = start;
  if (ride.status === "En Route" || ride.status === "Assigned") pos = mix(start, ride.pickup, Math.min(1, elapsed / 22));
  if (ride.status === "Arrived") pos = ride.pickup;
  if (ride.status === "In Progress" || ride.status === "Completed") pos = mix(ride.pickup, ride.dropoff, ride.status === "Completed" ? 1 : Math.min(1, (elapsed - 30) / Math.min(ride.minutes, 25)));
  if (ride.driver) L.circleMarker([pos.lat, pos.lng], { radius: 8, color: "#f6e7b2", fillColor: "#e6c35c", fillOpacity: 1 }).addTo(map);
  map.fitBounds([[ride.pickup.lat, ride.pickup.lng], [ride.dropoff.lat, ride.dropoff.lng]], { padding: [40, 180] });
  setTimeout(() => map.invalidateSize(), 80);
}
function mix(a, b, t) { return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t }; }

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
render();
