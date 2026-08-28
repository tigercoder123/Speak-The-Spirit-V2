# Speak the Spirit 🕊️
### Natively Integrating Scripture into Emerging Frontiers

Experience Scripture in action to restore muted Songbeasts, learning and memorizing verses to equip your daily walk with the Spirit.
---

## 🚀 Features & Core Capabilities
* **Native Scripture Ingestion:** Powered by the YouVersion Platform API to surface contextually relevant textual payloads seamlessly.
* **Values-Aligned Enrichment:** Integrates Gloo AI Studio endpoints to generate semantic text transformations and relational workflows.
* **Modern Web Framework:** Engineered on Next.js 14+ for lightning-fast, production-ready backend routing and client rendering.

---

## ⚙️ Local Setup & Installation

Follow these steps to run the application locally on your machine for testing or review:

### 1. Clone the Repository
```bash
git clone [https://github.com/miyonifluff-sys/speakTheSpirit.git](https://github.com/miyonifluff-sys/speakTheSpirit.git)
cd speakTheSpirit
```

### 2. Install Dependencies  
```bash
npm install
```

### 3. Configure Environment Variables
Create a file named .env in the root directory of your project. Copy the template below and replace the placeholder values with your authorized developer API credentials:
```bash
# YouVersion API Platform Configuration
YOUVERSION_API_KEY=your_actual_youversion_app_key_here

# Gloo AI Studio OAuth2 Credentials
GLOO_CLIENT_ID=your_actual_gloo_client_id_here
GLOO_CLIENT_SECRET=your_actual_gloo_client_secret_here
```
Note: Your local .env file is automatically ignored by Git configurations to ensure credential safety.

### 4. Run the deployment server
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```
Open http://localhost:3000 in your web browser to interact with the application demo.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

Click https://speak-the-spirit-v2.vercel.app to play the game without deployment!
