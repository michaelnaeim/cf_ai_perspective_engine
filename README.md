# cf_ai_perspective_engine

An AI-powered decision architecture tool built for the Cloudflare AI App Assignment.

##  Live Link
[View Deployed App](https://cf-ai-perspective-engine.michael-ai-engine.workers.dev)

##  Technical Architecture
This application implements a complete AI lifecycle within the Cloudflare ecosystem:
- **LLM:** Uses **Llama 3.1 8B** via Workers AI for multi-perspective analysis.
- **Coordination:** Uses **Cloudflare Workflows** to orchestrate history retrieval, AI inference, and state persistence.
- **Memory/State:** Uses **Cloudflare D1 (SQL)** to maintain a permanent record of user decisions.
- **User Interface:** A modern UI served via **Workers**, featuring real-time visual feedback and clickable history.

## 🛠️ Running Locally
1. Clone the repo: `git clone <[https://github.com/michaelnaeim/cf_ai_perspective_engine](https://github.com/michaelnaeim/cf_ai_perspective_engine)>`
2. Install dependencies: `npm install`
3. Create D1 Database: `npx wrangler d1 create decision_db`
4. Update `wrangler.jsonc` with the generated `database_id`.
5. Run migrations: `npx wrangler d1 execute decision_db --remote --command "CREATE TABLE decisions (id INTEGER PRIMARY KEY, userId TEXT, prompt TEXT, analysis TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP);"`
6. Deploy: `npx wrangler deploy`
