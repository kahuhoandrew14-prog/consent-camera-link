# Consent Camera Link

A small browser-based, permission-first live camera sharing demo. It is not a video-call room: the camera owner's browser sends a one-way video stream to one viewer. It does not record or store video.

## Run locally
1. Install Node.js 18 or newer.
2. In this folder run `npm install`.
3. Run `npm start`.
4. Open `http://localhost:3000`.

Camera access requires HTTPS on deployed sites (localhost is allowed for local testing).

## Deploy
Deploy this folder to a Node hosting provider that supports WebSockets, such as Render or Railway. Set the start command to `npm start`. Use the HTTPS URL provided by the host.

## How to use
1. Open the website and click **Create sharing link**.
2. Send the generated camera link to the person.
3. They open it, read the consent notice, and press **Allow camera and start sharing**.
4. Open the separate viewing link on your device.

## Important limitations
- This is a starter demo, not a hardened production service.
- Rooms are held in server memory and expire after 15 minutes; restarting the server invalidates them.
- One camera owner and one viewer per room.
- It uses a public STUN server. Some mobile networks may require a TURN relay server for connectivity.
- Add authentication, rate limits, abuse reporting, HTTPS, a TURN service, and stronger room lifecycle controls before public use.
- Never use it to access a camera without the owner's informed consent.
