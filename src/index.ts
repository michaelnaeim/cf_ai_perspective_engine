import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';

type Env = {
  AI: any;
  DB: D1Database;
  DECISION_WORKFLOW: WorkflowBinding;
};

// 1. THE WORKFLOW CLASS
export class DecisionWorkflow extends WorkflowEntrypoint<Env, { prompt: string, userId: string }> {
  async run(event: WorkflowEvent<{ prompt: string, userId: string }>, step: WorkflowStep) {
    const { prompt, userId } = event.payload;

    const history = await step.do('fetch history', async () => {
      const { results } = await this.env.DB.prepare(
        "SELECT prompt, analysis FROM decisions WHERE userId = ? ORDER BY id DESC LIMIT 3"
      ).bind(userId).all();
      return (results || []) as any;
    });

    const analysis = await step.do('ai reasoning', async () => {
      const historyItems = Array.isArray(history) ? history : [];
      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: "You are a Decision Architect. Help the user see hidden perspectives." },
          ...historyItems.map((h: any) => ({ role: 'user', content: String(h.prompt) })),
          { role: 'user', content: `Decision: ${prompt}` }
        ]
      });
      return response.response;
    });

    await step.do('save memory', async () => {
      await this.env.DB.prepare(
        "INSERT INTO decisions (userId, prompt, analysis) VALUES (?, ?, ?)"
      ).bind(userId, prompt, analysis).run();
    });

    return analysis;
  }
}

// 2. THE WORKER
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/") {
      return new Response(HTML, { headers: { 'Content-Type': 'text/html' } });
    }

    // NEW ROUTE: Fetch History for the UI
    if (url.pathname === "/history") {
      const { results } = await env.DB.prepare(
        "SELECT prompt, analysis, timestamp FROM decisions WHERE userId = 'user_1' ORDER BY id DESC"
      ).all();
      return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
    }

    if (req.method === "POST" && url.pathname === "/analyze") {
      try {
        const { prompt } = await req.json() as { prompt: string };
        const instance = await env.DECISION_WORKFLOW.create({ 
          params: { prompt, userId: "user_1" } 
        });
        
        let result = await instance.status();
        let attempts = 0;
        while (result.status !== "terminated" && result.status !== "errored" && attempts < 40) {
          await new Promise(r => setTimeout(r, 1000));
          result = await instance.status();
          attempts++;
        }
        return new Response(JSON.stringify({ 
          analysis: result.status === "errored" ? "Internal Workflow Error." : result.output 
        }));
      } catch (e: any) {
        return new Response(JSON.stringify({ analysis: "Error: " + e.message }), { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  }
};

// 3. THE UI (Updated with History Styles and Logic)
const HTML = `
<!DOCTYPE html>
<html>
<head>
    <title>Perspective Engine</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: -apple-system, sans-serif; background: #f4f4f9; padding: 20px; display: flex; flex-direction: column; align-items: center; }
        .card { background: white; padding: 30px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); width: 100%; max-width: 500px; margin-bottom: 20px; }
        textarea { width: 100%; height: 100px; border: 1px solid #ddd; border-radius: 12px; padding: 15px; font-size: 16px; box-sizing: border-box; margin-bottom: 15px; }
        button { width: 100%; background: #000; color: #fff; border: none; padding: 15px; border-radius: 12px; font-weight: 600; cursor: pointer; }
        #out { margin-top: 25px; padding: 20px; background: #f9f9f9; border-radius: 12px; display: none; white-space: pre-wrap; line-height: 1.6; border-left: 4px solid #000; }
        .history-section { width: 100%; max-width: 500px; }
        .history-item { background: #fff; padding: 15px; border-radius: 12px; margin-bottom: 10px; cursor: pointer; border: 1px solid #eee; transition: all 0.2s; }
        .history-item:hover { border-color: #000; transform: translateY(-2px); }
        .history-item b { display: block; margin-bottom: 5px; color: #000; }
        .history-item small { color: #888; font-size: 11px; }
        .loading { margin-top: 15px; display: none; color: #666; font-style: italic; text-align: center; }
    </style>
</head>
<body>
    <div class="card">
        <h1>Perspective Engine</h1>
        <p>What are you deciding?</p>
        <textarea id="i" placeholder="e.g. Should I move to another country?"></textarea>
        <button id="btn" onclick="run()">Analyze Decision</button>
        <div id="l" class="loading">Consulting the Architect...</div>
        <div id="out"></div>
    </div>

    <div class="history-section">
        <h3>Past Decisions</h3>
        <div id="history-list">Loading history...</div>
    </div>

    <script>
        // Load history on page load
        window.onload = loadHistory;

        async function loadHistory() {
            const list = document.getElementById('history-list');
            const r = await fetch('/history');
            const data = await r.json();
            
            if (data.length === 0) {
                list.innerHTML = "<p style='color:#999'>No history yet.</p>";
                return;
            }

            list.innerHTML = data.map((item, index) => \`
                <div class="history-item" onclick="showPast('\${index}')">
                    <b>\${item.prompt}</b>
                    <small>\${new Date(item.timestamp).toLocaleString()}</small>
                    <div id="past-content-\${index}" style="display:none">\${item.analysis}</div>
                </div>
            \`).join('');
        }

        function showPast(index) {
            const content = document.getElementById('past-content-' + index).innerText;
            const o = document.getElementById('out');
            o.innerText = content;
            o.style.display = 'block';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        async function run() {
            const i = document.getElementById('i');
            const o = document.getElementById('out');
            const l = document.getElementById('l');
            const b = document.getElementById('btn');
            
            if(!i.value) return;
            l.style.display = 'block'; o.style.display = 'none'; b.disabled = true;

            const r = await fetch('/analyze', { method: 'POST', body: JSON.stringify({ prompt: i.value }) });
            const d = await r.json();
            
            l.style.display = 'none';
            b.disabled = false;
            o.innerText = d.analysis;
            o.style.display = 'block';
            
            // Refresh history after new analysis
            loadHistory();
        }
    </script>
</body>
</html>
`;