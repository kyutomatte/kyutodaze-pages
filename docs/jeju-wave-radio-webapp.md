# JEJU WAVE RADIO Web App

## Purpose

Publish the playable Jeju Wave Radio web app within the KYUTODAZE Pages repository. The app remains a self-contained browser experience while the surrounding route follows the existing Splatify beta presentation pattern.

## Architecture

- Keep the application in `public/apps/jeju-wave-radio/` so GitHub Pages serves all app files as static assets.
- Preserve the web app and its six weather video files in the same relative arrangement required by the app.
- Replace the current placeholder in the `jeju-wave-radio-webapp` route with an iframe that points to the local public app path, while retaining the KYUTO header and return navigation.
- Keep the existing `Web App 이용하기` project link directed to `/jeju-wave-radio-webapp`.

## Runtime behavior

- Fetch live Jeju weather, marine, and air-quality values directly from the public Open-Meteo APIs in the visitor's browser.
- Map those values to the existing weather video state and Web Audio instrument levels.
- Require an explicit visitor action to start audio; no audio auto-plays.
- Continue with the app's built-in default values when one or more live API calls fail, and show the current connection status in the app.

## Verification

- Run the Jeju app's unit tests after moving the static files.
- Run the deploy site's existing test and production build commands.
- Check the published route for app asset loading, live-data refresh/fallback, video changes, and opt-in audio start.
