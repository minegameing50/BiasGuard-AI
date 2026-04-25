<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# BiasGuard AI

BiasGuard AI is a CSV-based fairness auditing app with a server-side Google Gemini analysis endpoint.

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm.cmd install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm.cmd run dev`

The app runs through the local Express server on `http://localhost:3000`. Gemini calls stay on the server and the browser never receives your API key.

## Safe Deployment

This repo is prepared for server-side deployment on hosts like Render or Railway.

Build command:
`npm install && npm run build`

Start command:
`npm run start`

Required environment variable:
`GEMINI_API_KEY`
