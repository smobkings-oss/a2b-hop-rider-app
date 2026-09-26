# A2B Hop — Rider App

Installable rider app for **instant hops** and **scheduled rides** across Northwest Ohio and Michigan.

Black / gold A2B branding. Works as a phone home-screen app (PWA) with no build step.

## What riders can do

- Hop now or schedule a pickup
- Choose pickup / dropoff from local places (Toledo, Perrysburg, Findlay, Fremont, TOL / DTW / CLE)
- Use current location
- Pick Comfort, Tesla Navigator, or XL
- See a live fare estimate (same rate math as a2bridesohio.com)
- Confirm card or cash
- Track an instant ride through matching → en route → arrived → in trip
- Review trip history
- Save a rider profile on-device

## Run it

Open `index.html` in a browser, or serve the folder:

```bash
npx --yes serve .
```

On a phone: open the hosted URL → Share / Add to Home Screen.

## Production backend

Live dispatch, passenger accounts, Stripe, and driver matching already live in the canonical repo:

- Site: https://a2bridesohio.com/hop
- Code: https://github.com/smobkings-oss/a2bridesohio-com

This Hop rider shell is the mobile-first experience. Set `API_BASE` in `app.js` to `https://a2bridesohio.com` when you want `placeRide()` to `POST /api/ride-requests` instead of localStorage-only.

## Brand

Anytime Anywhere Solutions LLC DBA A2B Rides · a2bridesohio.com
