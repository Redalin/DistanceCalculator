# Meeting Point Distance Calculator

A small web app for calculating driving distances to a meeting point. Place people on the map, set a meeting point, and see each person’s drive distance plus the combined total and longest single drive.

## Features

- **Map**: Place multiple people and one meeting point on an interactive map (OpenStreetMap).
- **Driving distances**: Uses [OSRM](https://project-osrm.org/) to compute road distances and estimated drive times.
- **Summary**: Shows total combined distance and the longest individual drive.
- **Single container**: Runs as one Docker container, ready to deploy on any Docker host.

Drive times are based on speed limits. Live **traffic** is not included; adding it would require a provider such as Google Directions API (with traffic model) or similar.

## Quick start (local)

```bash
npm install
npm run dev
```

- App: [http://localhost:5173](http://localhost:5173)  
- API is proxied from the dev server to the backend. Start the server as well (it runs on port 3000 when you run `npm run dev` via concurrently).

Or run client and server separately:

```bash
npm run dev:server   # in one terminal (port 3000)
npm run dev:client   # in another (port 5173); proxy forwards /api to 3000
```

## Docker (single container)

Build and run:

```bash
docker build -t distance-calculator .
docker run -p 3000:3000 distance-calculator
```

Open [http://localhost:3000](http://localhost:3000).

With Docker Compose:

```bash
docker compose up --build
```

Then open [http://localhost:3000](http://localhost:3000).

## Deploy on a Docker host

1. Build the image (e.g. on your machine or in CI):
   ```bash
   docker build -t your-registry/distance-calculator:latest .
   docker push your-registry/distance-calculator:latest
   ```
2. On the host:
   ```bash
   docker pull your-registry/distance-calculator:latest
   docker run -d -p 3000:3000 --name meeting-calc your-registry/distance-calculator:latest
   ```
3. Put a reverse proxy (e.g. nginx, Caddy) in front of port 3000 if you want HTTPS or a domain.

Optional environment variables:

- `PORT` – port to listen on (default `3000`)
- `OSRM_URL` – custom OSRM server (default: public `https://router.project-osrm.org`)

## Troubleshooting 502 errors

If you see "Routing failed" or 502 errors when calculating distances:

1. **Check container logs** – The server logs OSRM errors. In Portainer: Container → Logs. Look for `[OSRM table]` or `[OSRM route]` lines.
2. **Network egress** – The container must reach the OSRM URL over HTTPS. If your host blocks outbound traffic, routing will fail.
3. **Region coverage** – The public OSRM server (`router.project-osrm.org`) may not cover all regions well (e.g. some areas return `NoRoute`). For better coverage, run your own OSRM instance and set `OSRM_URL` to it.
4. **Rate limits** – The public server may throttle requests. Self-hosting OSRM avoids this.

Example with a custom OSRM server:

```bash
docker run -d -p 3000:3000 -e OSRM_URL=https://your-osrm-server.com distance-calculator
```

## How to use

1. Click **Add person**, then click on the map to place each person. You can rename them in the side panel.
2. Click **Set meeting point**, then click on the map where you want to meet.
3. Click **Calculate distances**. The app will show each person’s driving distance and time, the combined total, and the longest drive. Routes are drawn on the map.

## Tech

- **Frontend**: React, Vite, Leaflet (react-leaflet), TypeScript
- **Backend**: Express; proxies routing requests to the public OSRM service to avoid CORS
- **Routing**: OSRM (driving profile); no API key required when using the default public server
