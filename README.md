# Aravali Task Tracker

Shared app for Owner, Managers and Employees across 3 outlets. Live photo tasks, feedback, attendance import and scores.
No npm install. Needs Node 18 or newer.

## Run it
    node server.js
Open http://localhost:3000

## First logins (change them straight away with "Change password")
- Owner: owner / owner123
- Managers: manager1, manager2, manager3 / mgr123
- Employees: emp1 to emp6 / emp123
Delete the demo employees in People and create your real ones.

## Put it online so employees can use it (HTTPS is required for the camera)
Option A, Render.com (easiest):
1. Put this folder in a GitHub repository.
2. Render > New > Web Service > connect the repo. Runtime Node, Start Command `node server.js`.
3. Add a Disk (mount path /data) and an environment variable DATA_DIR=/data, so data and photos survive restarts.
4. Share the URL Render gives you.

Option B, any small VPS: run `DATA_DIR=/var/aravali node server.js` under pm2 or systemd and put Caddy or nginx in front for HTTPS.

## Notes
- Data lives in DATA_DIR/db.json and photos in DATA_DIR/photos. Back up that folder.
- Photos and records are kept 30 days, then deleted automatically.
- Passwords are stored as plain text so the owner can hand them out. Use unique passwords.
