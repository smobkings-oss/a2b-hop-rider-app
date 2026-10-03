const STORE = { rides: "a2b-hop-rides", profile: "a2b-hop-profile", places: "a2b-hop-places", active: "a2b-hop-active" };
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
  { id: "comfort", name: "Comfort", blurb: "Everyday hop", multiplier: 1 },
  { id: "tesla", name: "Tesla", blurb: "Navigator fleet", multiplier: 1.15 },
  { id: "xl", name: "XL", blurb: "Up to 6", multiplier: 1.35 }
];
const DRIVERS = [
  { name: "Maya Chen", vehicle: "Tesla Model 3", plate: "A2B-301", rating: 4.98 },
  { name: "Jordan Hale", vehicle: "Tesla Model 3", plate: "A2B-118", rating: 4.95 },
  { name: "Alex Ruiz", vehicle: "Comfort sedan", plate: "A2B-224", rating: 4.92 }
];
const STEPS = ["Matching", "Assigned", "En Route", "Arrived", "In Progress", "Completed"];
const app = document.getElementById("app");
const state = { screen: "home", mode: "now", pickup: "", dropoff: "", date: "", time: "", vehicle: "tesla", passengers: 1, payment: "card", notes: "", airport: false, focus: "pickup", query: "" };
let map, driverMarker, tick;

function load(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function save(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function profile() { return load(STORE.profile, null); }
function rides() { return load(STORE.rides, []); }
function places() { return load(STORE.places, PLACES.slice(0, 4)); }
function money(n) { return `$${n.toFixed(2)}`; }
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => {
    if (c === "&") return "&" + "amp;";
    if (c === "<") return "&" + "lt;";
    if (c === ">") return "&" + "gt;";
    if (c === '"') return "&" + "quot;";
    return "&" + "#39;";
  });
}
function toast(msg) { const el = document.createElement("div"); el.className = "toast"; el.textContent = msg; document.body.appendChild(el); setTimeout(() => el.remove(), 2200); }
function easternNowPlus(mins) {
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
function guess(text) {
  const q = (text || "").toLowerCase();
  return PLACES.find((p) => q.includes(p.label.toLowerCase()) || q.includes(p.address.toLowerCase().slice(0, 16))) || null;
}
function surcharge(date, time) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  const [h, m] = String(time || "12:00").split(":").map(Number);
  const t = h * 60 + m;
  let percent = 0, label = "Standard A2B rate";
  const set = (p, l) => { if (p > percent) { percent = p; label = l; } };
  if ([4, 5, 6].includes(day) && t >= 20 * 60 && t < 22 * 60) set(10, "Thu–Sat evening");
  if ([4, 5, 6].includes(day) && t < 3 * 60 + 46) set(20, "Thu–Sat late night");
  if (day >= 1 && day <= 5 && t >= 7 * 60 && t < 8 * 60) set(15, "Weekday morning");
  if (day >= 1 && day <= 5 && t >= 16 * 60 + 30 && t < 18 * 60) set(12, "Weekday evening");
  return { percent, label };
}
function quote() {
  if ((state.pickup || "").trim().length < 5 || (state.dropoff || "").trim().length < 5) return null;
  const from = guess(state.pickup) || { lat: 41.6528, lng: -83.5379 };
  const to = guess(state.dropoff) || { lat: 41.55, lng: -83.63 };
  const miles = Math.max(1.4, haversine(from, to) * 1.18);
  const minutes = Math.max(8, Math.round(miles * 2.15 + 5));
  const airport = state.airport || /airport|tol|dtw|cle/i.test(`${state.pickup} ${state.dropoff}`);
  const when = state.mode === "now" ? easternNowPlus(8) : { date: state.date, time: state.time };
  const base = 3.5 + miles * 1.65 + minutes * 0.25 + (airport ? 10 : 0);
  const subtotal = Math.max(12, base);
  const surge = surcharge(when.date, when.time);
  const vehicle = VEHICLES.find((v) => v.id === state.vehicle);
  const total = (subtotal + subtotal * surge.percent / 100) * vehicle.multiplier;
  return { miles, minutes, airport, subtotal, total, surge, vehicle, when, from, to };
}
function uid() { return `HOP-${Math.random().toString(36).slice(2, 6).toUpperCase()}${Date.now().toString(36).slice(-3).toUpperCase()}`; }

function go(screen) { state.screen = screen; render(); }
function nav(active) {
  return `<nav class="nav">
    <button class="${active === "home" ? "on" : ""}" data-go="home">Hop</button>
    <button class="${active === "schedule" ? "on" : ""}" data-go="schedule">Schedule</button>
    <button class="${active === "rides" ? "on" : ""}" data-go="rides">Rides</button>
    <button class="${active === "account" ? "on" : ""}" data-go="account">You</button>
  </nav>`;
}
function bindNav() {
  app.querySelectorAll("[data-go]").forEach((btn) => btn.onclick = () => {
    if (btn.dataset.go === "schedule") { state.mode = "later"; state.screen = "home"; if (!state.date) Object.assign(state, easternNowPlus(90)); }
    else if (btn.dataset.go === "home") { state.mode = "now"; state.screen = "home"; }
    else state.screen = btn.dataset.go;
    render();
  });
}

function render() {
  clearInterval(tick);
  if (!profile() && state.screen !== "join") return renderJoin();
  if (state.screen === "confirm") return renderConfirm();
  if (state.screen === "live") return renderLive();
  if (state.screen === "rides") return renderRides();
  if (state.screen === "account") return renderAccount();
  renderHome();
}

function renderJoin() {
  app.innerHTML = `<section class="splash"><div><div class="mark">A2</div><h1 class="hologram">A2B HOP</h1><p class="muted">Instant hops and scheduled rides. NW Ohio & Michigan.</p>
    <div class="card" style="text-align:left;margin-top:18px"><label>Your name</label><input id="name" placeholder="Alex Rivera" /><div style="height:10px"></div><label>Mobile</label><input id="phone" placeholder="419-555-0142" inputmode="tel" /></div>
    <button class="cta" id="join">Hop on</button></div></section>`;
  document.getElementById("join").onclick = () => {
    const name = document.getElementById("name").value.trim();
    const phone = document.getElementById("phone").value.trim();
    if (name.length < 2 || phone.replace(/\D/g, "").length < 10) return toast("Enter your name and a 10-digit phone.");
    save(STORE.profile, { name, phone });
    state.screen = "home";
    render();
  };
}

function renderHome() {
  const q = quote();
  const saved = places();
  const when = state.mode === "now" ? easternNowPlus(8) : state;
  app.innerHTML = `<header class="top"><div class="brand"><div class="mark">A2</div><div><h1>A2B HOP</h1><p>Premium rides. Local drivers.</p></div></div><span class="pill">${esc(profile().name.split(" ")[0])}</span></header>
    <div class="modes"><button class="${state.mode === "now" ? "on" : ""}" data-mode="now">Hop now</button><button class="${state.mode === "later" ? "on" : ""}" data-mode="later">Schedule</button></div>
    ${state.mode === "later" ? `<div class="card row"><div><label>Date</label><input id="date" type="date" value="${esc(state.date || when.date)}" /></div><div><label>Time</label><input id="time" type="time" value="${esc(state.time || when.time)}" /></div></div>` : `<p class="small">Pickup window about 8 minutes after you confirm.</p>`}
    <div class="card route"><label>Pickup</label><input id="pickup" value="${esc(state.pickup)}" placeholder="Where should we meet you?" />
      <div style="height:8px"></div><label>Dropoff</label><input id="dropoff" value="${esc(state.dropoff)}" placeholder="Where are you headed?" />
      <div class="suggest">${saved.map((p) => `<button data-place="${esc(p.label)}">${esc(p.label)}</button>`).join("")}<button id="loc">Use my location</button></div></div>
    <div class="card"><label>Vehicle</label><div class="vehicles">${VEHICLES.map((v) => `<button class="${state.vehicle === v.id ? "on" : ""}" data-vehicle="${v.id}"><strong>${v.name}</strong><span>${v.blurb}</span></button>`).join("")}</div>
      <div class="row" style="margin-top:10px"><div><label>Riders</label><select id="passengers">${[1,2,3,4,5,6].map((n) => `<option ${state.passengers === n ? "selected" : ""}>${n}</option>`).join("")}</select></div>
      <div><label>Pay</label><select id="payment"><option value="card" ${state.payment === "card" ? "selected" : ""}>Card</option><option value="cash" ${state.payment === "cash" ? "selected" : ""}>Cash</option></select></div></div></div>
    <div class="card fare"><div><div class="small">${q ? `${q.miles.toFixed(1)} mi · ${q.minutes} min · ${q.surge.label}` : "Add pickup and dropoff for a quote"}</div><b>${q ? money(q.total) : "—"}</b></div><button class="cta" id="next" style="width:auto;padding:12px 16px">${state.mode === "now" ? "Review hop" : "Review schedule"}</button></div>
    ${nav(state.mode === "later" ? "schedule" : "home")}`;
  bindNav();
  app.querySelectorAll("[data-mode]").forEach((btn) => btn.onclick = () => { state.mode = btn.dataset.mode; if (state.mode === "later" && !state.date) Object.assign(state, easternNowPlus(90)); render(); });
  app.querySelectorAll("[data-vehicle]").forEach((btn) => btn.onclick = () => { readForm(); state.vehicle = btn.dataset.vehicle; render(); });
  app.querySelectorAll("[data-place]").forEach((btn) => btn.onclick = () => { readForm(); const place = places().find((p) => p.label === btn.dataset.place) || PLACES.find((p) => p.label === btn.dataset.place); if (!state.pickup) state.pickup = place.address; else state.dropoff = place.address; render(); });
  document.getElementById("loc").onclick = () => navigator.geolocation?.getCurrentPosition((pos) => { state.pickup = `Current location (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`; render(); }, () => toast("Location permission is off."));
  document.getElementById("next").onclick = () => { readForm(); if (!quote()) return toast("Enter two different pickup and dropoff addresses."); if (state.pickup.trim().toLowerCase() === state.dropoff.trim().toLowerCase()) return toast("Pickup and dropoff need to be different."); go("confirm"); };
  ["pickup", "dropoff", "date", "time", "passengers", "payment"].forEach((id) => { const el = document.getElementById(id); if (el) el.onchange = readForm; });
}
function readForm() {
  const get = (id) => document.getElementById(id)?.value;
  state.pickup = get("pickup") ?? state.pickup;
  state.dropoff = get("dropoff") ?? state.dropoff;
  state.date = get("date") ?? state.date;
  state.time = get("time") ?? state.time;
  state.passengers = Number(get("passengers") || state.passengers);
  state.payment = get("payment") || state.payment;
}

function renderConfirm() {
  const q = quote();
  if (!q) return go("home");
  app.innerHTML = `<header class="top"><div class="brand"><div class="mark">A2</div><div><h1>${state.mode === "now" ? "Confirm hop" : "Confirm schedule"}</h1><p>${esc(q.when.date)} · ${esc(q.when.time)} ET</p></div></div></header>
    <div class="card"><div class="small">Pickup</div><strong>${esc(state.pickup)}</strong><hr /><div class="small">Dropoff</div><strong>${esc(state.dropoff)}</strong><hr />
    <div class="small">${q.miles.toFixed(1)} miles · about ${q.minutes} min · ${q.vehicle.name} · ${state.passengers} rider${state.passengers > 1 ? "s" : ""}</div>
    <p>${money(q.subtotal)} ride · ${q.surge.percent ? q.surge.label + " +" + q.surge.percent + "%" : "no time surcharge"} · ${q.vehicle.name} rate</p>
    <div class="fare"><span>Estimate</span><b>${money(q.total)}</b></div>
    <p class="small">Drivers keep the majority. Card checkout finishes on a2bridesohio.com. Cash is paid to the driver.</p></div>
    <div class="card"><label>Note for the driver</label><textarea id="notes" placeholder="Gate code, luggage, flight number">${esc(state.notes)}</textarea></div>
    <button class="cta" id="place">${state.mode === "now" ? "Place hop" : "Schedule ride"}</button>
    <div style="height:8px"></div><button class="ghost" id="back">Edit trip</button>${nav("home")}`;
  bindNav();
  document.getElementById("back").onclick = () => go("home");
  document.getElementById("place").onclick = placeRide;
}
function placeRide() {
  const q = quote();
  state.notes = document.getElementById("notes").value.trim();
  const ride = {
    id: uid(), when: state.mode, pickup: state.pickup.trim(), dropoff: state.dropoff.trim(), date: q.when.date, time: q.when.time,
    passengers: state.passengers, payment: state.payment, notes: state.notes, vehicle: q.vehicle.name, fare: Number(q.total.toFixed(2)),
    miles: Number(q.miles.toFixed(1)), minutes: q.minutes, status: state.mode === "now" ? "Matching" : "Scheduled",
    createdAt: Date.now(), from: q.from, to: q.to, rider: profile(), driver: null, rating: 0
  };
  const all = rides();
  all.unshift(ride);
  save(STORE.rides, all);
  localStorage.setItem(STORE.active, ride.id);
  toast(state.mode === "now" ? "Hop placed. Finding a driver." : "Ride scheduled.");
  state.screen = state.mode === "now" ? "live" : "rides";
  render();
}

function activeRide() {
  const id = localStorage.getItem(STORE.active);
  return rides().find((r) => r.id === id) || rides().find((r) => !["Completed", "Canceled", "Scheduled"].includes(r.status));
}
function updateRide(id, patch) {
  const all = rides().map((r) => r.id === id ? { ...r, ...patch } : r);
  save(STORE.rides, all);
  return all.find((r) => r.id === id);
}
function advance(ride) {
  if (ride.when !== "now" || ["Completed", "Canceled", "Scheduled"].includes(ride.status)) return ride;
  const elapsed = (Date.now() - ride.createdAt) / 1000;
  let status = "Matching", driver = ride.driver;
  if (elapsed > 5) { status = "Assigned"; driver = driver || DRIVERS[ride.vehicle === "Comfort" ? 2 : 0]; }
  if (elapsed > 8) status = "En Route";
  if (elapsed > 26) status = "Arrived";
  if (elapsed > 34) status = "In Progress";
  if (elapsed > 34 + ride.minutes) status = "Completed";
  if (status !== ride.status || !ride.driver && driver) return updateRide(ride.id, { status, driver });
  return ride;
}
function renderLive() {
  let ride = activeRide();
  if (!ride) return go("rides");
  ride = advance(ride);
  const idx = Math.max(0, STEPS.indexOf(ride.status));
  app.innerHTML = `<header class="top"><div class="brand"><div class="mark">A2</div><div><h1>${esc(ride.id)}</h1><p class="status">${esc(ride.status)}</p></div></div></header>
    <div id="map" class="map"></div>
    <div class="card"><strong>${esc(ride.driver ? ride.driver.name : "Finding your driver")}</strong><div class="small">${ride.driver ? `${esc(ride.driver.vehicle)} · ${esc(ride.driver.plate)} · ${ride.driver.rating}★` : "Nearby A2B drivers are being offered this hop."}</div>
      <div class="timeline">${STEPS.map((s, i) => `<div class="step ${i <= idx ? "on" : ""}"><span class="dot"></span>${s}</div>`).join("")}</div>
      <div class="small">${esc(ride.pickup)} → ${esc(ride.dropoff)}</div><div class="fare"><span>${esc(ride.payment)} · ${esc(ride.vehicle)}</span><b>${money(ride.fare)}</b></div></div>
    <div class="row"><button class="ghost" id="share">Share trip</button><button class="danger" id="cancel">Cancel</button></div>
    ${ride.status === "Completed" ? `<div class="card"><label>Rate this hop</label><div class="stars">${[1,2,3,4,5].map((n) => `<button data-star="${n}">${n <= ride.rating ? "★" : "☆"}</button>`).join("")}</div></div>` : ""}
    ${nav("rides")}`;
  bindNav();
  drawMap(ride);
  document.getElementById("share").onclick = shareTrip(ride);
  document.getElementById("cancel").onclick = () => { if (["Completed", "Canceled"].includes(ride.status)) return toast("This hop is already closed."); updateRide(ride.id, { status: "Canceled" }); toast("Hop canceled."); go("rides"); };
  app.querySelectorAll("[data-star]").forEach((btn) => btn.onclick = () => { updateRide(ride.id, { rating: Number(btn.dataset.star) }); toast("Thanks for the rating."); render(); });
  if (!["Completed", "Canceled"].includes(ride.status)) tick = setInterval(() => { const next = advance(activeRide() || ride); if (next.status !== ride.status) render(); else moveDriver(next); }, 1000);
}
function drawMap(ride) {
  if (!window.L) return;
  map = L.map("map", { zoomControl: false }).setView([ride.from.lat, ride.from.lng], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap" }).addTo(map);
  L.circleMarker([ride.from.lat, ride.from.lng], { radius: 7, color: "#e6c35c" }).addTo(map).bindPopup("Pickup");
  L.circleMarker([ride.to.lat, ride.to.lng], { radius: 7, color: "#f6e7b2" }).addTo(map).bindPopup("Dropoff");
  L.polyline([[ride.from.lat, ride.from.lng], [ride.to.lat, ride.to.lng]], { color: "#e6c35c" }).addTo(map);
  driverMarker = L.circleMarker(driverPoint(ride), { radius: 8, color: "#111", fillColor: "#e6c35c", fillOpacity: 1 }).addTo(map);
  map.fitBounds([[ride.from.lat, ride.from.lng], [ride.to.lat, ride.to.lng]], { padding: [24, 24] });
}
function driverPoint(ride) {
  const elapsed = (Date.now() - ride.createdAt) / 1000;
  const start = { lat: ride.from.lat + 0.03, lng: ride.from.lng - 0.03 };
  if (ride.status === "In Progress" || ride.status === "Completed") {
    const t = Math.min(1, Math.max(0, (elapsed - 34) / ride.minutes));
    return [ride.from.lat + (ride.to.lat - ride.from.lat) * t, ride.from.lng + (ride.to.lng - ride.from.lng) * t];
  }
  const t = Math.min(1, Math.max(0, (elapsed - 8) / 18));
  return [start.lat + (ride.from.lat - start.lat) * t, start.lng + (ride.from.lng - start.lng) * t];
}
function moveDriver(ride) { if (driverMarker) driverMarker.setLatLng(driverPoint(ride)); }
function shareTrip(ride) {
  return async () => {
    const text = `A2B Hop ${ride.id}: ${ride.pickup} to ${ride.dropoff}. Status ${ride.status}. Driver ${ride.driver ? ride.driver.name + " " + ride.driver.plate : "assigning"}.`;
    if (navigator.share) { try { await navigator.share({ title: "A2B trip", text }); } catch {} }
    else { await navigator.clipboard.writeText(text); toast("Trip details copied."); }
  };
}

function renderRides() {
  const all = rides();
  app.innerHTML = `<header class="top"><div class="brand"><div class="mark">A2</div><div><h1>Your rides</h1><p>${all.length} hop${all.length === 1 ? "" : "s"} on this phone</p></div></div></header>
    <div class="list">${all.length ? all.map((r) => `<article class="ride"><div class="status">${esc(r.status)} · ${esc(r.when)}</div><h3>${esc(r.pickup.split(",")[0])} → ${esc(r.dropoff.split(",")[0])}</h3><div class="small">${esc(r.date)} ${esc(r.time)} · ${money(r.fare)} · ${esc(r.vehicle)}</div>
      <div class="row" style="margin-top:8px"><button class="ghost" data-open="${r.id}">${r.status === "Scheduled" ? "Start matching" : "Open"}</button><button class="ghost" data-again="${r.id}">Rebook</button></div></article>`).join("") : `<div class="empty">No rides yet. Hop now or schedule a pickup.</div>`}</div>${nav("rides")}`;
  bindNav();
  app.querySelectorAll("[data-open]").forEach((btn) => btn.onclick = () => {
    const ride = rides().find((r) => r.id === btn.dataset.open);
    if (ride.status === "Scheduled") updateRide(ride.id, { status: "Matching", when: "now", createdAt: Date.now() });
    localStorage.setItem(STORE.active, btn.dataset.open);
    state.screen = "live";
    render();
  });
  app.querySelectorAll("[data-again]").forEach((btn) => btn.onclick = () => { const ride = rides().find((r) => r.id === btn.dataset.again); Object.assign(state, { pickup: ride.pickup, dropoff: ride.dropoff, vehicle: VEHICLES.find((v) => v.name === ride.vehicle)?.id || "tesla", passengers: ride.passengers, payment: ride.payment, mode: "now", screen: "home" }); render(); });
}
function renderAccount() {
  const p = profile();
  const saved = places();
  app.innerHTML = `<header class="top"><div class="brand"><div class="mark">A2</div><div><h1>You</h1><p>Saved on this device</p></div></div></header>
    <div class="card"><label>Name</label><input id="name" value="${esc(p.name)}" /><div style="height:8px"></div><label>Mobile</label><input id="phone" value="${esc(p.phone)}" /><div style="height:10px"></div><button class="cta" id="save">Save profile</button></div>
    <div class="card"><label>Saved places</label><div class="suggest">${saved.map((pl) => `<button data-drop="${esc(pl.label)}">${esc(pl.label)}</button>`).join("")}</div>
      <div class="row"><select id="addplace">${PLACES.map((pl) => `<option value="${esc(pl.label)}">${esc(pl.label)}</option>`).join("")}</select><button class="ghost" id="add">Save</button></div></div>
    <button class="ghost" id="install">Add A2B Hop to home screen</button><div style="height:8px"></div>
    <a class="ghost" style="display:block;text-align:center;text-decoration:none" href="https://a2bridesohio.com/book" target="_blank" rel="noreferrer">Open live dispatch booking</a>
    <p class="small">Anytime Anywhere Solutions LLC DBA A2B Rides. Card payments and driver assignment run on a2bridesohio.com. This app stores your hops on the phone until that account is connected.</p>${nav("account")}`;
  bindNav();
  document.getElementById("save").onclick = () => { save(STORE.profile, { name: document.getElementById("name").value.trim(), phone: document.getElementById("phone").value.trim() }); toast("Profile saved."); };
  document.getElementById("add").onclick = () => { const label = document.getElementById("addplace").value; const place = PLACES.find((pl) => pl.label === label); const next = [place, ...places().filter((pl) => pl.label !== label)].slice(0, 8); save(STORE.places, next); toast("Place saved."); render(); };
  document.getElementById("install").onclick = () => toast(window.deferredPrompt ? "Use the install prompt." : "On iPhone: Share → Add to Home Screen. On Android: browser menu → Install app.");
  app.querySelectorAll("[data-drop]").forEach((btn) => btn.onclick = () => { const next = places().filter((pl) => pl.label !== btn.dataset.drop); save(STORE.places, next); render(); });
}

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); window.deferredPrompt = e; });
render();
