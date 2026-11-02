# trip-feasibility-simulator

Our CSC 380 project helps users see whether a trip fits their budget by estimating transportation costs, lodging costs, and travel time.

## Team Members
Genesis Facey, Precious Uzoechi, and TaJ Adkins

## Features
- Enter trip details and travel preferences.
- Estimate costs and travel time.
- Check trip feasibility and compare scenarios.
- Flag missing information and invalid inputs.
- Fetch destination weather and show rule-based weather-risk warnings.
- Evaluate budget, a user-selected travel-time limit, and weather availability.
- Show a trip report using the same assessment and forecast as the main results.
- Save one preferred scenario on this device and view it in a dashboard.

## Technologies
React, JavaScript, HTML, CSS, Vite, Node.js, npm, ESLint, and Vitest.

## Setup
Install Node.js and npm, then run:

```bash
git clone https://github.com/gfacey13/trip-feasibility-simulator.git
cd trip-feasibility-simulator/frontend
npm install
```

## Run the App
```bash
npm run dev
```
Open the local link shown in the terminal.

## Current Status
The main features are connected, and the project is still in development. Test files cover cost estimation, feasibility rules, weather request handling, report consistency, and device-saved data handling.

## Limitations
Users enter prices and distance manually. Travel time uses average speeds without accounting for delays. Same-day trips are not supported, and estimates exclude meals and activities.

## Checks
From frontend/:
- npm run lint
- npm run build
- npx vitest run

## Scope of the current dashboard
The dashboard is a partial implementation of SCRUM-12. It stores one preferred
trip in localStorage on this device; saving another replaces it. Its saved
result checks budget only, not the current trip's weather or travel-time limit.
Accounts, user-specific permissions, multiple persisted trips, saved-trip editing,
and saved-trip comparison are not implemented. They remain dependent on the
authentication, saved-trip management, and database backlog work.

Weather covers the destination, not the route. Forecasts have a limited date
window and may be unavailable. Weather warnings are project heuristics, not
official alerts or predicted delay durations. Live transportation delays and
trained AI/ML predictions are not included.