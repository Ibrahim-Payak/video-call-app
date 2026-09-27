# Video Call App

Browser-based group video calling built with **WebRTC** — media flows directly
between browsers (peer-to-peer); the server only handles the initial handshake,
so it stays lightweight and cheap to host.

## Tech Stack

| Layer      | Technology              | Why                                                          |
|------------|-------------------------|--------------------------------------------------------------|
| Frontend   | React 18 + TypeScript   | Component-based UI (video tiles, controls); TS catches peer-state bugs early |
| Bundler    | Vite                    | Fast dev server, zero config                                 |
| Media      | WebRTC (native APIs)    | Real peer-to-peer audio/video — `RTCPeerConnection`, `getUserMedia`, `getDisplayMedia` |
| Signaling  | Node.js + `ws`          | Small WebSocket server that relays offer/answer/ICE messages between peers |
| Process    | PM2                     | Keeps the signaling server running in production             |

**How WebRTC works here (short version):** peers can't find each other on their own.
The signaling server passes the SDP offer/answer + ICE candidates between browsers,
and once a network path is found, video/audio flows directly browser-to-browser.
The server never touches the media itself.

## Features

- Multi-party calls (full mesh, best for 2–6 people)
- Mute / camera toggle with status badges
- Screen sharing with spotlight layout
- Auto-reconnect on server drop; detects crashed peers

## Getting Started

**Prerequisites:** Node.js 18+, camera & mic


# 1. Install dependencies
npm install
cd server && npm install && cd ..

# 2. Start the signaling server  (terminal 1)
cd server
node signaling-server.js        # → ws://localhost:3001

# 3. Start the frontend          (terminal 2)
npm run dev                     # → http://localhost:5173


Open two browser windows (use incognito for the second):

http://localhost:5173/?room=test&user=alice
http://localhost:5173/?room=test&user=bob


Allow the camera/mic prompt — both tiles should appear within a few seconds.

```bash
