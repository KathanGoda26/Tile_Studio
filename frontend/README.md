# Frontend

The React app is part of the workspace at `D:\Tile_Studio`. Follow the root `README.md` for setup and run commands.

- `src/main.jsx`: room and material controls, independent wall/floor state, comparison and PNG download.
- `src/renderer.js`: loads tile faces, repeats textures with grout, applies perspective and restores foreground objects.
- `src/perspective.js`: homography and triangle mesh projection.
- `src/tile-layout.js`: rectangular tile dimensions, rotation and deterministic face mixing.
- `public/assets`: room illustrations and the supplied Whiteeza textures.

The app fetches `/api/catalog` from the Express backend. The catalogue now lives in MongoDB; `backend/data/catalog.json` is the import source. There is no direct static JSON fallback.

The UI redesign is the next milestone. The rooms remain illustrated placeholders. Real photo rooms need a base image, known surface corners and aligned foreground masks. The supplied tile images are fully integrated, with 120 × 60 cm used as an explicitly assumed demo size.
