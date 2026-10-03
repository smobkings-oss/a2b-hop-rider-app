# A2B Hop — Rider App

Installable rider app for **instant hops** and **scheduled rides** across Northwest Ohio and southeast Michigan.

Black / gold A2B branding. No build step. Add it to a phone home screen.

## What riders can do

- Hop now, or schedule a pickup date and time
- Search local places or type any address
- Use current location and save frequent places
- Choose Comfort, Tesla Navigator, or XL
- See a transparent fare estimate before confirming
- Pay with card (on the live site) or cash with the driver
- Track an instant ride: matching → assigned → en route → arrived → in trip → completed
- Share the trip, cancel, rate, and rebook
- Keep upcoming scheduled rides and past hops on the device

## Run it

```bash
npx --yes serve .
```

Phone: open the hosted URL, then Share → Add to Home Screen.

## Live dispatch

Production booking, passenger accounts, Stripe, and driver matching live at [a2bridesohio.com](https://a2bridesohio.com). This app is the mobile rider shell. Orders are saved on the device and can be handed to live dispatch from the confirm screen. Card checkout stays on the signed-in site so payment secrets never live in the phone app.

Anytime Anywhere Solutions LLC DBA A2B Rides · a2bridesohio.com
