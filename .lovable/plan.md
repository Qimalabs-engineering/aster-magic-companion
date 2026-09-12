# Build the pikopod marketing site

## Goal
Create the single-page pikopod site from the uploaded brief, using withaster.dev only as a visual reference for its restrained developer-tool feel.

## Implementation
- Establish a cool, instrument-like light/dark design system with IBM Plex Sans and IBM Plex Mono, hairline borders, small radii, and product severity colours.
- Build the complete page at `/`: header, terminal-led introduction, CI spec-diff section, declared/observed join, safety claims, design-partner section, application form, and footer.
- Add a working theme switch and anchored navigation while keeping all content visible without scroll effects.
- Connect the design-partner form to persistent storage, validate required fields and email format, and show the supplied confirmation message after submission.
- Add unique page metadata and accessible labels, focus states, horizontal terminal scrolling, and narrow-screen layouts.

## Validation
- Check the page at desktop and 380px widths.
- Submit the form and confirm both validation and the success state.
- Confirm no forbidden marketing terms, fake proof, sideways page scrolling, or unrequested claims appear.
