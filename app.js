/* A2B Hop rider app — instant hops + scheduled rides */
(function () {
  const API_BASE = "";
  const STORE = {
    rides: "a2b.hop.rides.v1",
    account: "a2b.hop.account.v1",
    active: "a2b.hop.active.v1",
    saved: "a2b.hop.saved.v1",
    seenSplash: "a2b.hop.seen.v1"
  };

  const PLACES = [
    { label: "Downtown Toledo", address: "1 Government Center, Toledo, OH 43604", lat: 41.6528, lng: -83.5379 },
    { label: "Toledo Express Airport (TOL)", address: "11013 Airport Hwy, Swanton, OH 43558", lat: 41.5868, lng: -83.8078, airport: true },
    { label: "Promedica Toledo Hospital", address: "2142 N Cove Blvd, Toledo, OH 43606", lat: 41.6728, lng: -83.5936 },
    { label: "Fifth Third Field", address: "2602 N Summit St, Toledo, OH 43611", lat: 41.6483, lng: -83.5389 },
    { label: "Franklin Park Mall", address: "5001 Monroe St, Toledo, OH 43623", lat: 41.6956, lng: -83.6416 },
    { label: "University of Toledo", address: "2801 W Bancroft St, Toledo, OH 43606", lat: 41.6577, lng: -83.6138 },
    { label: "Levis Commons / Perrysburg", address: "3201 Levis Commons Blvd, Perrysburg, OH 43551", lat: 41.5526, lng: -83.6103 },
    { label: "Arrowhead Park / Maumee", address: "1715 Indian Wood Circle, Maumee, OH 43537", lat: 41.5628, lng: -83.6538 },
    { label: "Sylvania", address: "6633 Maplewood Ave, Sylvania, OH 43560", lat: 41.7189, lng: -83.713 },
    { label: "Holland / Springfield", address: "7115 Garden Rd, Holland, OH 43528", lat: 41.6217, lng: -83.7116 },
    { label: "Oregon / Navarre", address: "5330 Seaman Rd, Oregon, OH 43616", lat: 41.6439, lng: -83.4869 },
    { label: "Bowling Green", address: "175 W Wooster St, Bowling Green, OH 43402", lat: 41.3748, lng: -83.6513 },
    { label: "Findlay", address: "200 E Main Cross St, Findlay, OH 45840", lat: 41.0442, lng: -83.6499 },
    { label: "Fremont", address: "323 S Front St, Fremont, OH 43420", lat: 41.3503, lng: -83.1219 },
    { label: "Tiffin", address: "51 E Market St, Tiffin, OH 44883", lat: 41.1145, lng: -83.178 },
    { label: "Defiance", address: "631 Perry St, Defiance, OH 43512", lat: 41.2845, lng: -84.3627 },
    { label: "Monroe, MI", address: "120 E First St, Monroe, MI 48161", lat: 41.9164, lng: -83.3977 },
    { label: "Ann Arbor", address: "200 S Fifth Ave, Ann Arbor, MI 48104", lat: 42.2808, lng: -83.743 },
    { label: "DTW Airport", address: "Detroit Metropolitan Wayne County Airport, Detroit, MI", lat: 42.2162, lng: -83.3554, airport: true },
    { label: "Cleveland Hopkins (CLE)", address: "5300 Riverside Dr, Cleveland, OH 44135", lat: 41.4117, lng: -81.8498, airport: true }
  ];

  const VEHICLES = [
    { id: "comfort", name: "Comfort", eta: "4-8 min", note: "Sedan - everyday hops", multiplier: 1 },
    { id: "tesla", name: "Tesla Navigator", eta: "6-12 min", note: "Model 3 fleet - quiet premium", multiplier: 1.25 },
    { id: "xl", name: "XL", eta: "8-15 min", note: "Up to 6 riders - extra bags", multiplier: 1.45 }
  ];

  const LIVE_STEPS = [
    { status: "New", copy: "Looking for a nearby A2B driver", width: 12 },
    { status: "Assigned", copy: "Driver assigned - heading your way", width: 28 },
    { status: "En Route", copy: "Driver is on the way to you", width: 52 },
    { status: "Arrived", copy: "Your driver is here", width: 72 },
    { status: "In Progress", copy: "You are on the trip", width: 88 },
    { status: "Completed", copy: "Trip complete. Rate your ride.", width: 100 }
  ];

  const DRIVERS = [
    { name: "Marcus J.", car: "Tesla Model 3 - Gold", plate: "A2B 330", rating: "4.98", phone: "419-455-5181" },
    { name: "Priya K.", car: "Tesla Model 3 - White", plate: "HOP 117", rating: "4.96", phone: "419-455-5181" },
    { name: "Andre W.", car: "Comfort sedan - Black", plate: "OH 4418", rating: "4.94", phone: "419-455-5181" }
  ];

  const state = {
    screen: "splash", mode: "now", pickup: "", dropoff: "", pickupMeta: null, dropoffMeta: null,
    date: "", time: "", passengers: "1", airport: false, notes: "", payment: "card", vehicle: "comfort",
    picker: null, placeQuery: "", geoBusy: false, message: "", error: "", quote: null, rideFilter: "all", deferredPrompt: null
  };

  let map = null, pickupMarker = null, dropoffMarker = null, carMarker = null, liveTimer = null;
  function $(id) { return document.getElementById(id); }
  function loadJSON(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || "") || fallback; } catch (e) { return fallback; } }
  function saveJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function rides() { return loadJSON(STORE.rides, []); }
  function savedPlaces() { return loadJSON(STORE.saved, []); }
  function account() { return loadJSON(STORE.account, { name: "", phone: "", email: "", payment: "card" }); }
  function setAccount(next) { saveJSON(STORE.account, next); }
  function easternNowPlus(minutes) {
    const date = new Date(Date.now() + minutes * 60000);
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
    return { date: parts.year + "-" + parts.month + "-" + parts.day, time: parts.hour + ":" + parts.minute };
  }
  function haversine(a, b) {
    const R = 3958.8;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  function guessPoint(text) {
    const q = (text || "").toLowerCase();
    return PLACES.find((p) => q.includes(p.label.toLowerCase().split(" / ")[0].toLowerCase()) || q.includes(p.address.toLowerCase().slice(0, 18))) || null;
  }
  function clockMinutes(value) { const p = String(value || "").split(":").map(Number); return p[0] * 60 + (p[1] || 0); }
  function timeSurcharge(date, time) {
    const day = new Date(date + "T12:00:00Z").getUTCDay();
    const t = clockMinutes(time);
    let percent = 0, label = "Standard A2B rate";
    const set = (p, l) => { if (p > percent) { percent = p; label = l; } };
    if ([4, 5, 6].includes(day) && t >= 20 * 60 && t < 22 * 60) set(10, "Thursday-Saturday evening");
    if ([4, 5, 6].includes(day) && t >= 0 && t < 3 * 60 + 46) set(20, "Thursday-Saturday late night");
    if (day >= 1 && day <= 5 && t >= 7 * 60 && t < 8 * 60) set(15, "Weekday morning rush");
    if (day >= 1 && day <= 5 && t >= 11 * 60 && t < 13 * 60) set(10, "Weekday midday");
    if (day >= 1 && day <= 5 && t >= 16 * 60 + 30 && t < 18 * 60) set(12, "Weekday evening rush");
    return { percent, label };
  }
  function quoteFare() {
    if ((state.pickup || "").trim().length < 5 || (state.dropoff || "").trim().length < 5) return null;
    const from = state.pickupMeta || guessPoint(state.pickup) || { lat: 41.6528, lng: -83.5379 };
    const to = state.dropoffMeta || guessPoint(state.dropoff) || { lat: 41.55, lng: -83.61 };
    const miles = Math.max(1.4, haversine(from, to) * 1.18);
    const minutes = Math.max(8, miles * 2.15 + 5);
    const airport = state.airport || /airport|tol|dtw|cle/i.test(state.pickup + state.dropoff);
    const when = state.mode === "now" ? easternNowPlus(8) : { date: state.date, time: state.time };
    const base = 3.5 + miles * 1.65 + minutes * 0.25 + (airport ? 10 : 0);
    const subtotal = Math.max(12, base);
    const surge = timeSurcharge(when.date, when.time);
    const vehicle = VEHICLES.find((v) => v.id === state.vehicle) || VEHICLES[0];
    const total = (subtotal + (subtotal * surge.percent) / 100) * vehicle.multiplier;
    return { miles, minutes, airport, total, label: surge.label, surchargePercent: surge.percent, vehicle: vehicle.name, when, from, to };
  }
  function uid() { return "HOP-" + Math.random().toString(36).slice(2, 6).toUpperCase() + Date.now().toString(36).slice(-4).toUpperCase(); }
  function activeRide() {
    const id = localStorage.getItem(STORE.active);
    return rides().find((r) => r.id === id) || rides().find((r) => !["Completed", "Canceled"].includes(r.status));
  }
  function upsertRide(ride) {
    const list = rides();
    const idx = list.findIndex((r) => r.id === ride.id);
    if (idx >= 0) list[idx] = ride; else list.unshift(ride);
    saveJSON(STORE.rides, list);
    if (!["Completed", "Canceled"].includes(ride.status)) localStorage.setItem(STORE.active, ride.id);
    else if (localStorage.getItem(STORE.active) === ride.id) localStorage.removeItem(STORE.active);
  }
  function go(screen) {
    if (screen === "schedule") { state.mode = "scheduled"; screen = "home"; }
    state.screen = screen;
    if (screen !== "confirm") state.message = "";
    render();
  }
  function nearestPlace(lat, lng) {
    let best = PLACES[0], dist = Infinity;
    for (const p of PLACES) { const d = haversine({ lat, lng }, p); if (d < dist) { dist = d; best = p; } }
    return { place: best, dist };
  }
  function useLocation() {
    if (!navigator.geolocation) { state.error = "Location is not available in this browser."; render(); return; }
    state.geoBusy = true; state.error = ""; render();
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      const near = nearestPlace(latitude, longitude);
      state.pickup = "Current location near " + near.place.label;
      state.pickupMeta = { lat: latitude, lng: longitude, label: "Current location" };
      state.geoBusy = false; state.picker = null; state.quote = quoteFare(); render();
    }, () => { state.geoBusy = false; state.error = "Turn on location or pick a Toledo-area place."; render(); }, { enableHighAccuracy: true, timeout: 8000 });
  }
  function applyPlace(place) {
    if (state.picker === "dropoff") { state.dropoff = place.address; state.dropoffMeta = place; }
    else { state.pickup = place.address; state.pickupMeta = place; }
    if (place.airport) state.airport = true;
    state.picker = null; state.placeQuery = ""; state.quote = quoteFare(); render();
  }
  function saveFavorite(place) {
    const list = savedPlaces();
    if (list.some((p) => p.address === place.address)) return;
    list.unshift({ label: place.label, address: place.address, lat: place.lat, lng: place.lng, airport: !!place.airport });
    saveJSON(STORE.saved, list.slice(0, 12));
  }
  function filteredPlaces() {
    const q = (state.placeQuery || (state.picker === "dropoff" ? state.dropoff : state.pickup) || "").toLowerCase().trim();
    const fav = savedPlaces();
    const pool = [...fav, ...PLACES.filter((p) => !fav.some((f) => f.address === p.address))];
    if (!q || q.length < 2) return pool.slice(0, 8);
    return pool.filter((p) => (p.label + " " + p.address).toLowerCase().includes(q)).slice(0, 8);
  }
  async function placeRide() {
    const quote = quoteFare();
    if (!quote) { state.error = "Enter pickup and dropoff to hop."; render(); return; }
    if (state.pickup.trim().toLowerCase() === state.dropoff.trim().toLowerCase()) { state.error = "Pickup and dropoff need to be different."; render(); return; }
    if (state.mode === "scheduled" && (!state.date || !state.time)) { state.error = "Pick a date and Eastern time for the scheduled hop."; render(); return; }
    const acc = account();
    const ride = {
      id: uid(), mode: state.mode, pickup: state.pickup, dropoff: state.dropoff, pickupMeta: quote.from, dropoffMeta: quote.to,
      date: quote.when.date, time: quote.when.time, passengers: Number(state.passengers), airport: quote.airport, notes: state.notes,
      payment: state.payment, vehicle: state.vehicle, vehicleName: quote.vehicle, fare: quote.total, miles: quote.miles, minutes: quote.minutes,
      surchargePercent: quote.surchargePercent, surchargeLabel: quote.label, status: state.mode === "now" ? "New" : "Scheduled",
      step: 0, createdAt: Date.now(), rider: acc.name || "Guest rider", phone: acc.phone || "",
      driver: state.mode === "now" ? DRIVERS[Math.floor(Math.random() * DRIVERS.length)] : null, rating: 0
    };
    if (API_BASE) {
      try {
        const res = await fetch(API_BASE + "/api/ride-requests", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ pickup: ride.pickup, dropoff: ride.dropoff, date: ride.date, time: ride.time, passengers: ride.passengers, airport: ride.airport, paymentMethod: ride.payment, notes: ride.notes, when: ride.mode }) });
        const body = await res.json();
        if (res.ok && body.id) ride.serverId = body.id;
      } catch (e) {}
    }
    upsertRide(ride);
    if (state.pickupMeta && state.pickupMeta.label) saveFavorite({ ...state.pickupMeta, address: state.pickup });
    if (state.dropoffMeta && state.dropoffMeta.label) saveFavorite({ ...state.dropoffMeta, address: state.dropoff });
    state.error = "";
    state.message = ride.mode === "now" ? "Hop request sent. Matching a nearby driver." : "Scheduled ride saved on this phone.";
    if (ride.mode === "now") go("live"); else go("rides");
  }
  function tickLive() {
    const ride = activeRide();
    if (!ride || ride.mode !== "now" || ["Completed", "Canceled"].includes(ride.status)) return;
    const next = Math.min((ride.step || 0) + 1, LIVE_STEPS.length - 1);
    ride.step = next; ride.status = LIVE_STEPS[next].status;
    if (!ride.driver) ride.driver = DRIVERS[0];
    upsertRide(ride); render();
  }
  function cancelRide(id) { const ride = rides().find((r) => r.id === id); if (!ride) return; ride.status = "Canceled"; upsertRide(ride); go("rides"); }
  function completeRide() { const ride = activeRide(); if (!ride) return; ride.status = "Completed"; ride.step = LIVE_STEPS.length - 1; upsertRide(ride); go("rides"); }
  function rateRide(id, stars) { const ride = rides().find((r) => r.id === id); if (!ride) return; ride.rating = stars; upsertRide(ride); render(); }
  function repeatRide(id) {
    const ride = rides().find((r) => r.id === id); if (!ride) return;
    state.pickup = ride.pickup; state.dropoff = ride.dropoff;
    state.pickupMeta = ride.pickupMeta || guessPoint(ride.pickup); state.dropoffMeta = ride.dropoffMeta || guessPoint(ride.dropoff);
    state.vehicle = ride.vehicle || "comfort"; state.passengers = String(ride.passengers || 1);
    state.airport = !!ride.airport; state.notes = ride.notes || ""; state.mode = "now"; state.quote = quoteFare(); go("home");
  }
  function shareTrip() {
    const ride = activeRide(); if (!ride) return;
    const text = "I'm on an A2B Hop (" + ride.id + "). " + ride.pickup + " to " + ride.dropoff + ". Driver: " + ((ride.driver && ride.driver.name) || "matching") + ". Call A2B 419-455-5181.";
    if (navigator.share) navigator.share({ title: "A2B trip", text }).catch(() => copyText(text)); else copyText(text);
  }
  function copyText(text) { if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => { state.message = "Trip details copied."; render(); }).catch(() => {}); }
  function escapeHtml(value) { return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function money(n) { return "$" + Number(n || 0).toFixed(2); }
  function topbar(title, sub) {
    return '<div class="topbar"><div class="brand"><div class="mark">A2B</div><div><div class="eyebrow">A2B Hop</div><strong>' + escapeHtml(title) + '</strong></div></div><div class="muted" style="font-size:12px;text-align:right">' + escapeHtml(sub || "NW Ohio - MI") + "</div></div>";
  }
  function mapCard(caption) { return '<div class="map-wrap" id="live-map"><div id="map"></div><div class="map-label">' + escapeHtml(caption || "Toledo metro - live coverage") + "</div></div>"; }
  function placesList() {
    if (!state.picker) return "";
    const list = filteredPlaces();
    if (!list.length) return '<p class="muted tiny">No matching places. Type a street or pick a city.</p>';
    return '<div class="places">' + list.map((p) => '<button type="button" data-place="' + escapeHtml(p.address) + '"><strong>' + escapeHtml(p.label) + "</strong><span>" + escapeHtml(p.address) + "</span></button>").join("") + "</div>";
  }
  function installBanner() {
    if (!state.deferredPrompt) return "";
    return '<div class="card install show"><div><div class="eyebrow">Install</div><div>Add A2B Hop to your home screen</div></div><button class="btn btn-gold" style="width:auto;padding:10px 14px" data-action="install">Add</button></div>';
  }
  function renderHome() {
    state.quote = quoteFare();
    const live = activeRide();
    return topbar(state.mode === "now" ? "Ride now" : "Schedule", "Premium local rides") + mapCard(live ? live.status + " - " + (live.driver ? live.driver.name : "Matching") : "Pick pickup and dropoff") + installBanner() +
      (live ? '<div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:10px"><div><span class="status live">' + escapeHtml(live.status) + "</span><div>" + escapeHtml(live.pickup) + " to " + escapeHtml(live.dropoff) + '</div></div><button class="btn btn-gold" style="width:auto;padding:10px 14px" data-go="live">Track</button></div>' : "") +
      '<div class="toggle" role="tablist"><button type="button" class="' + (state.mode === "now" ? "on" : "") + '" data-mode="now">Hop now</button><button type="button" class="' + (state.mode === "scheduled" ? "on" : "") + '" data-mode="scheduled">Schedule</button></div>' +
      '<div class="card"><label>Pickup<input class="input" id="pickup" value="' + escapeHtml(state.pickup) + '" placeholder="Where should we pick you up?" autocomplete="off"></label><label>Dropoff<input class="input" id="dropoff" value="' + escapeHtml(state.dropoff) + '" placeholder="Where are you going?" autocomplete="off"></label>' +
      '<div class="chips"><button class="chip" data-action="geo">' + (state.geoBusy ? "Locating..." : "Use my location") + '</button><button class="chip" data-action="swap">Swap</button><button class="chip" data-action="airport">' + (state.airport ? "Airport - on" : "Airport trip") + "</button></div>" +
      placesList() +
      (state.mode === "scheduled" ? '<div class="row"><label>Date<input class="input" id="date" type="date" value="' + escapeHtml(state.date) + '"></label><label>Time (Eastern)<input class="input" id="time" type="time" value="' + escapeHtml(state.time) + '"></label></div>' : '<p class="muted tiny">Pickup window: about 8 minutes from now, Eastern time.</p>') +
      '<div class="row"><label>Riders<select class="input" id="passengers">' + [1,2,3,4,5,6].map((n) => '<option value="' + n + '" ' + (String(n) === state.passengers ? "selected" : "") + '>' + n + '</option>').join('') + '</select></label><label>Notes<input class="input" id="notes" maxlength="200" placeholder="Bags, seat, gate..." value="' + escapeHtml(state.notes) + '"></label></div></div>' +
      '<div class="card"><p class="eyebrow">Choose a car</p><div class="vehicle">' + VEHICLES.map((v) => '<button type="button" class="' + (state.vehicle === v.id ? "on" : "") + '" data-vehicle="' + v.id + '"><strong>' + escapeHtml(v.name) + '</strong><div class="meta"><span>' + escapeHtml(v.note) + '</span><span>' + escapeHtml(v.eta) + '</span></div></button>').join('') + '</div></div>' +
      '<div class="card fare"><div><div class="eyebrow">Estimate</div><strong>' + (state.quote ? money(state.quote.total) : "-") + '</strong><div class="muted">' + (state.quote ? state.quote.miles.toFixed(1) + ' mi - ' + Math.round(state.quote.minutes) + ' min - ' + state.quote.label : 'Enter pickup and dropoff') + '</div></div><div class="muted" style="text-align:right">' + (state.payment === "cash" ? "Cash" : "Card") + '</div></div>' +
      (state.error ? '<p class="notice error">' + escapeHtml(state.error) + '</p>' : '') +
      '<button class="btn btn-gold" data-go="confirm">' + (state.mode === "now" ? "Review hop" : "Review scheduled ride") + '</button>';
  }
  function renderConfirm() {
    const quote = state.quote = quoteFare();
    if (!quote) { state.error = "Add pickup and dropoff first."; return renderHome(); }
    return topbar("Confirm ride", state.mode === "now" ? "Instant hop" : "Scheduled") + mapCard(quote.miles.toFixed(1) + " miles") +
      '<div class="card"><p class="eyebrow">' + (state.mode === "now" ? "Leaving soon" : quote.when.date + " - " + quote.when.time + " ET") + '</p><h2 style="margin:8px 0">' + escapeHtml(state.pickup) + '</h2><p class="muted">to</p><h2 style="margin:8px 0 14px">' + escapeHtml(state.dropoff) + '</h2><div class="muted">' + quote.miles.toFixed(1) + ' miles - ' + Math.round(quote.minutes) + ' min - ' + escapeHtml(quote.vehicle) + ' - ' + state.passengers + ' rider' + (state.passengers === "1" ? "" : "s") + '</div></div>' +
      '<div class="card fare"><div><div class="eyebrow">You pay</div><strong>' + money(quote.total) + '</strong><div class="muted">' + (quote.surchargePercent ? quote.surchargePercent + "% " + quote.label : quote.label) + (quote.airport ? " - airport fee included" : "") + '</div></div></div>' +
      '<div class="card"><p class="eyebrow">Pay</p><div class="chips"><button class="chip ' + (state.payment === "card" ? "on" : "") + '" data-pay="card">Card after final fare</button><button class="chip ' + (state.payment === "cash" ? "on" : "") + '" data-pay="cash">Cash</button></div><p class="muted tiny" style="margin-top:8px">Dispatch confirms availability. Card charges happen only after the fare is locked.</p></div>' +
      (state.error ? '<p class="notice error">' + escapeHtml(state.error) + '</p>' : '') +
      '<button class="btn btn-gold" data-action="place">' + (state.mode === "now" ? "Hop on this ride" : "Schedule this ride") + '</button><button class="btn btn-ghost" data-go="home">Edit trip</button>';
  }
  function renderLive() {
    const ride = activeRide();
    if (!ride) return topbar("Live trip", "No active hop") + '<div class="card"><p>No live ride right now.</p></div><button class="btn btn-gold" data-go="home">Hop now</button>';
    const step = LIVE_STEPS[ride.step || 0] || LIVE_STEPS[0];
    const driver = ride.driver || DRIVERS[0];
    return topbar("Live hop", ride.id) + mapCard(step.copy) +
      '<div class="card"><span class="status live">' + escapeHtml(ride.status) + '</span><h2 style="margin:8px 0">' + escapeHtml(step.copy) + '</h2><div class="progress"><span style="width:' + step.width + '%"></span></div><p class="muted">' + escapeHtml(ride.pickup) + ' to ' + escapeHtml(ride.dropoff) + '</p></div>' +
      '<div class="card driver"><div class="avatar">' + escapeHtml(driver.name.slice(0, 1)) + '</div><div><strong>' + escapeHtml(driver.name) + '</strong><div class="muted">' + escapeHtml(driver.car) + ' - ' + escapeHtml(driver.plate) + '</div><div class="muted">* ' + escapeHtml(driver.rating) + '</div></div></div>' +
      '<div class="card fare"><div><div class="eyebrow">Fare</div><strong>' + money(ride.fare) + '</strong></div><div class="muted">' + escapeHtml(ride.vehicleName) + ' - ' + ride.payment + '</div></div>' +
      '<div class="safety"><button class="btn btn-ghost" data-action="share">Share trip</button><a class="btn btn-ghost" href="tel:14194555181">Call A2B</a></div>' +
      (ride.status === "Completed" ? '<button class="btn btn-gold" data-go="rides">Done</button>' : '<button class="btn btn-gold" data-action="advance">' + (ride.status === "Arrived" ? "I am in the car" : ride.status === "In Progress" ? "End trip" : "Refresh status") + '</button><button class="btn btn-ghost" data-action="cancel">Cancel ride</button>') +
      '<p class="muted tiny" style="margin-top:10px">Safety line 419-455-5181 - Anytime Anywhere Solutions LLC DBA A2B Rides</p>';
  }
  function renderRides() {
    const list = rides();
    const filtered = list.filter((r) => {
      if (state.rideFilter === "live") return !["Completed", "Canceled"].includes(r.status);
      if (state.rideFilter === "scheduled") return r.mode === "scheduled";
      if (state.rideFilter === "done") return ["Completed", "Canceled"].includes(r.status);
      return true;
    });
    const liveCount = list.filter((r) => !["Completed", "Canceled"].includes(r.status)).length;
    return topbar("Your rides", list.length + " saved") +
      '<div class="kpi"><div><strong>' + list.length + '</strong><span class="muted">Total</span></div><div><strong>' + liveCount + '</strong><span class="muted">Open</span></div><div><strong>' + list.filter((r) => r.mode === "scheduled").length + '</strong><span class="muted">Scheduled</span></div></div>' +
      '<div class="filter chips"><button class="chip ' + (state.rideFilter === "all" ? "on" : "") + '" data-filter="all">All</button><button class="chip ' + (state.rideFilter === "live" ? "on" : "") + '" data-filter="live">Open</button><button class="chip ' + (state.rideFilter === "scheduled" ? "on" : "") + '" data-filter="scheduled">Scheduled</button><button class="chip ' + (state.rideFilter === "done" ? "on" : "") + '" data-filter="done">Done</button></div>' +
      '<div class="list">' + (filtered.length ? filtered.map((r) => {
        const live = !["Completed", "Canceled"].includes(r.status);
        return '<article class="ride-item"><span class="status ' + (r.status === "Canceled" ? "warn" : live ? "live" : "done") + '">' + escapeHtml(r.status) + '</span><strong>' + escapeHtml(r.mode === "now" ? "Instant hop" : "Scheduled") + '</strong><p class="muted">' + escapeHtml(r.pickup) + ' to ' + escapeHtml(r.dropoff) + '</p><p class="muted">' + escapeHtml(r.date) + ' ' + escapeHtml(r.time) + ' ET - ' + money(r.fare) + '</p>' +
          (r.status === "Completed" ? '<div class="stars">' + [1,2,3,4,5].map((n) => '<button type="button" data-rate="' + r.id + '" data-stars="' + n + '">' + (n <= (r.rating || 0) ? "*" : "o") + '</button>').join('') + '</div>' : '') +
          (live ? '<button class="btn btn-gold" style="margin-top:10px" data-go="' + (r.mode === "now" ? "live" : "home") + '" data-open="' + r.id + '">' + (r.mode === "now" ? "Track" : "Open") + '</button>' : '<button class="btn btn-ghost" data-repeat="' + r.id + '">Hop this again</button>') + '</article>';
      }).join('') : '<div class="card"><p>No hops in this filter. Book an instant ride or schedule one for later.</p></div>') + '</div>';
  }
  function renderAccount() {
    const acc = account(); const fav = savedPlaces();
    return topbar("Account", "Saved on this phone") +
      '<div class="card"><label>Name<input class="input" id="acc-name" value="' + escapeHtml(acc.name) + '" placeholder="Rider name"></label><label>Phone<input class="input" id="acc-phone" value="' + escapeHtml(acc.phone) + '" placeholder="419..."></label><label>Email<input class="input" id="acc-email" value="' + escapeHtml(acc.email) + '" placeholder="you@email.com"></label><button class="btn btn-gold" data-action="save-account">Save profile</button>' + (state.message ? '<p class="notice" style="margin-top:10px">' + escapeHtml(state.message) + '</p>' : '') + '</div>' +
      '<div class="card"><p class="eyebrow">Saved places</p>' + (fav.length ? '<div class="places">' + fav.map((p) => '<button type="button" data-go="home" data-fav="' + escapeHtml(p.address) + '"><strong>' + escapeHtml(p.label) + '</strong><span>' + escapeHtml(p.address) + '</span></button>').join('') + '</div>' : '<p class="muted tiny">Places you hop from get saved here after a booking.</p>') + '</div>' +
      '<div class="card"><p class="eyebrow">A2B Rides</p><p class="muted tiny">Anytime Anywhere Solutions LLC DBA A2B Rides. Toledo, Perrysburg, Findlay, Fremont and Michigan connections.</p><p style="margin-top:10px"><a class="muted" href="https://a2bridesohio.com/hop">Open live dispatch on a2bridesohio.com/hop</a></p><p style="margin-top:8px"><a class="muted" href="tel:14194555181">Call 419-455-5181</a></p></div>';
  }
  function renderSplash() {
    return '<div class="splash"><div><div class="holo">A2B</div><p class="eyebrow" style="margin-top:18px">Northwest Ohio - Michigan</p><h1>Hop on.</h1><p class="muted">Instant rides and scheduled pickups. Premium cars. Transparent fares.</p><div style="margin-top:22px"><button class="btn btn-gold" data-go="home">Ride now</button><button class="btn btn-ghost" data-go="schedule">Schedule a ride</button></div></div></div>';
  }
  function bindNav() {
    document.querySelectorAll(".nav button").forEach((btn) => {
      const onHome = state.screen === "home" || state.screen === "confirm" || state.screen === "live";
      btn.classList.toggle("on", (btn.dataset.go === "home" && onHome && state.mode === "now") || (btn.dataset.go === "schedule" && state.screen === "home" && state.mode === "scheduled") || (btn.dataset.go === state.screen));
    });
    $("nav").style.display = state.screen === "splash" ? "none" : "grid";
  }
  function syncInputs() {
    const mapIds = { pickup: "pickup", dropoff: "dropoff", date: "date", time: "time", passengers: "passengers", notes: "notes" };
    Object.entries(mapIds).forEach(([id, key]) => {
      const el = $(id); if (!el) return;
      el.addEventListener("focus", () => {
        if (id === "pickup" || id === "dropoff") {
          state.picker = id; state.placeQuery = el.value; render();
          const again = $(id); if (again) { again.focus(); again.selectionStart = again.value.length; }
        }
      });
      el.addEventListener("input", () => {
        state[key] = el.value;
        if (id === "pickup") { state.pickupMeta = guessPoint(el.value); state.placeQuery = el.value; }
        if (id === "dropoff") { state.dropoffMeta = guessPoint(el.value); state.placeQuery = el.value; }
        state.quote = quoteFare();
        if (id === "pickup" || id === "dropoff") { const box = document.querySelector(".places"); if (box) box.outerHTML = placesList(); else render(); }
      });
    });
  }
  function destroyMap() { if (map) { map.remove(); map = null; pickupMarker = null; dropoffMarker = null; carMarker = null; } }
  function pinIcon(color) {
    return window.L.divIcon({ className: "", html: '<div style="width:16px;height:16px;border-radius:50%;background:' + color + ';box-shadow:0 0 0 6px rgba(230,195,92,.18);border:2px solid #111"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });
  }
  function mountMap() {
    if (!window.L || !$("map")) return;
    destroyMap();
    const from = (state.pickupMeta && state.pickupMeta.lat) ? state.pickupMeta : (guessPoint(state.pickup) || { lat: 41.6528, lng: -83.5379 });
    const to = (state.dropoffMeta && state.dropoffMeta.lat) ? state.dropoffMeta : guessPoint(state.dropoff);
    map = L.map("map", { zoomControl: false, attributionControl: false }).setView([from.lat, from.lng], 12);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(map);
    pickupMarker = L.marker([from.lat, from.lng], { icon: pinIcon("#e6c35c") }).addTo(map);
    if (to) {
      dropoffMarker = L.marker([to.lat, to.lng], { icon: pinIcon("#ffffff") }).addTo(map);
      map.fitBounds(L.latLngBounds([[from.lat, from.lng], [to.lat, to.lng]]).pad(0.25));
      const ride = activeRide();
      if (ride && ride.mode === "now" && !["Completed", "Canceled"].includes(ride.status)) {
        const t = Math.min(1, (ride.step || 0) / Math.max(1, LIVE_STEPS.length - 1));
        carMarker = L.marker([from.lat + (to.lat - from.lat) * t, from.lng + (to.lng - from.lng) * t], { icon: pinIcon("#c9a227") }).addTo(map);
      }
    }
    setTimeout(() => { if (map) map.invalidateSize(); }, 80);
  }
  function startLiveClock() {
    if (liveTimer) clearInterval(liveTimer);
    liveTimer = setInterval(() => {
      const ride = activeRide();
      if (state.screen === "live" && ride && ride.mode === "now" && !["Arrived", "In Progress", "Completed", "Canceled"].includes(ride.status)) tickLive();
    }, 9000);
  }
  function render() {
    if (!state.date || !state.time) { const when = easternNowPlus(30); state.date = state.date || when.date; state.time = state.time || when.time; }
    const screens = { splash: "screen-splash", home: "screen-home", confirm: "screen-confirm", live: "screen-live", rides: "screen-rides", account: "screen-account" };
    Object.values(screens).forEach((id) => $(id).classList.remove("on"));
    const node = $(screens[state.screen] || "screen-home");
    destroyMap();
    if (state.screen === "splash") node.innerHTML = renderSplash();
    if (state.screen === "home") node.innerHTML = renderHome();
    if (state.screen === "confirm") node.innerHTML = renderConfirm();
    if (state.screen === "live") node.innerHTML = renderLive();
    if (state.screen === "rides") node.innerHTML = renderRides();
    if (state.screen === "account") node.innerHTML = renderAccount();
    node.classList.add("on"); bindNav(); syncInputs();
    if (["home", "confirm", "live"].includes(state.screen)) mountMap();
  }
  document.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-go],[data-mode],[data-action],[data-vehicle],[data-pay],[data-place],[data-filter],[data-rate],[data-repeat],[data-fav]");
    if (!btn) return;
    if (btn.dataset.go) {
      if (btn.dataset.open) localStorage.setItem(STORE.active, btn.dataset.open);
      if (btn.dataset.fav) {
        const place = savedPlaces().find((p) => p.address === btn.dataset.fav) || PLACES.find((p) => p.address === btn.dataset.fav);
        if (place) { state.picker = "pickup"; applyPlace(place); return; }
      }
      if (btn.dataset.go === "home" && !btn.dataset.open) state.mode = "now";
      go(btn.dataset.go); return;
    }
    if (btn.dataset.mode) { state.mode = btn.dataset.mode; render(); return; }
    if (btn.dataset.vehicle) { state.vehicle = btn.dataset.vehicle; state.quote = quoteFare(); render(); return; }
    if (btn.dataset.pay) { state.payment = btn.dataset.pay; render(); return; }
    if (btn.dataset.filter) { state.rideFilter = btn.dataset.filter; render(); return; }
    if (btn.dataset.rate) { rateRide(btn.dataset.rate, Number(btn.dataset.stars)); return; }
    if (btn.dataset.repeat) { repeatRide(btn.dataset.repeat); return; }
    if (btn.dataset.place) {
      const place = savedPlaces().find((p) => p.address === btn.dataset.place) || PLACES.find((p) => p.address === btn.dataset.place);
      if (place) applyPlace(place); return;
    }
    if (btn.dataset.action === "geo") useLocation();
    if (btn.dataset.action === "swap") { const p = state.pickup; state.pickup = state.dropoff; state.dropoff = p; const m = state.pickupMeta; state.pickupMeta = state.dropoffMeta; state.dropoffMeta = m; render(); }
    if (btn.dataset.action === "airport") { state.airport = !state.airport; render(); }
    if (btn.dataset.action === "place") placeRide();
    if (btn.dataset.action === "advance") { const ride = activeRide(); if (ride && (ride.status === "In Progress" || ride.step >= LIVE_STEPS.length - 2)) completeRide(); else tickLive(); }
    if (btn.dataset.action === "cancel") { const ride = activeRide(); if (ride) cancelRide(ride.id); }
    if (btn.dataset.action === "share") shareTrip();
    if (btn.dataset.action === "install" && state.deferredPrompt) { state.deferredPrompt.prompt(); state.deferredPrompt.userChoice.finally(() => { state.deferredPrompt = null; render(); }); }
    if (btn.dataset.action === "save-account") {
      setAccount({ name: ($("acc-name") || {}).value || "", phone: ($("acc-phone") || {}).value || "", email: ($("acc-email") || {}).value || "", payment: state.payment });
      state.message = "Profile saved on this device."; render();
    }
  });
  window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); state.deferredPrompt = event; if (state.screen === "home") render(); });
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
  const existing = activeRide();
  if (existing && existing.mode === "now" && !["Completed", "Canceled"].includes(existing.status)) state.screen = "live";
  else if (localStorage.getItem(STORE.seenSplash)) state.screen = "home";
  localStorage.setItem(STORE.seenSplash, "1");
  render();
  startLiveClock();
})();
