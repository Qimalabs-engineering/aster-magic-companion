# Restore logos on the deployed site

## Changes
- Replace the hosted asset-pointer logo with the bundled public SVG used by the favicon.
- Keep the existing wordmark layout and styling unchanged.
- Verify the logo loads in the running site at desktop and mobile sizes.

## Technical details
- Remove the logo asset JSON import from the homepage.
- Reference `/favicon.svg` for the header and footer marks so Vercel serves the file directly from `public/`.
