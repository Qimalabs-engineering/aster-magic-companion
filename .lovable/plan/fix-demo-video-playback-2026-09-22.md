# Fix demo video playback

## Changes
- Replace the Lovable-only video address with a compressed MP4 bundled with the public site.
- Preserve the cinematic video, narration, poster, controls, and existing page design.
- Verify playback starts and the deployed file supports browser byte-range requests.

## Technical details
- Re-encode the existing 1080p MP4 to a web-optimized H.264/AAC file below the repository size limit.
- Enable fast-start metadata and reference the public file directly.
