# Sagar Rajput — 3D Portfolio

A local-first Next.js and React portfolio with a procedurally modeled Three.js
room. The room, navigation, portfolio panels, and terminal are drawn in the
WebGL scene; accessible HTML controls and a contact form provide keyboard and
screen-reader alternatives.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Next.js. `npm run build` creates a production
build, and `npm run start` serves it.

## Project layout

- `app/layout.js` — document metadata and global stylesheet.
- `app/page.js` — portfolio route.
- `app/globals.css` — Tailwind CSS and the full-screen scene styles.
- `src/components/PortfolioExperience.jsx` — React state, accessibility
  controls, hidden contact inputs, and scene lifecycle.
- `src/data/portfolioData.js` — editable profile, project, experience, contact,
  and Spotify-link content.
- `src/main.js` — Three.js room, canvas-rendered UI, pointer interaction, and
  ambient sound.

Update the profile and project details in `src/data/portfolioData.js`. Add a
public `https://open.spotify.com/...` link to `music.spotifyUrl` to connect the
listening panel. The contact form validates its fields and opens the visitor's
email app with a prefilled message; it does not send data to a server.

## Reference observations and interaction model

REA's browser inspection of `raomuhammadhamza.tech` found a 3D scene canvas, an
accessible section navigation for Projects, Experience, About, and Contact,
and scene areas associated with projects, experience, about, contact, and
music. The reference's accessibility tree also exposed project cards and
contact content. These observations informed the broad layout; the portfolio
copy and room are Sagar-specific.

The captured evidence did not establish whether the reference's panels can be
dragged, minimized, or reordered. This implementation uses a single
canvas-rendered panel at a fixed screen position, opened from the 3D section
navigation or room objects and closed with its X control, Escape, or a click
outside the panel. Dragging the room changes the camera view; it does not drag
or reorder individual panels.
