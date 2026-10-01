<div align="center">

# ProDex Node for Self-Hosted n8n

Run **OpenAI Codex** inside self-hosted n8n workflows — powered by your **Codex subscription**, not pay-per-token API billing.

<br />

[![npm version](https://img.shields.io/npm/v/%40fixtse%2Fn8n-nodes-prodex?style=for-the-badge&logo=npm&logoColor=white)](https://www.npmjs.com/package/@fixtse/n8n-nodes-prodex)
[![Releases & Roadmap](https://img.shields.io/badge/Releases_%26_Roadmap-prodex.proday.in-0ea5e9?style=for-the-badge)](https://prodex.proday.in)
[![Portfolio — Nils](https://img.shields.io/badge/✨_Portfolio-nils.proday.in-8b5cf6?style=for-the-badge)](https://nils.proday.in)

<br />

**Built by [Nils](https://nils.proday.in)** · automation, workflows & integrations

[📦 npm](https://www.npmjs.com/package/@fixtse/n8n-nodes-prodex) · [🌐 prodex.proday.in](https://prodex.proday.in) · [💼 nils.proday.in](https://nils.proday.in) · [GitHub](https://github.com/fixtse/n8n-nodes-prodex)

</div>

---

## 👤 About the author

<table>
<tr>
<td width="60">

**Nils**

</td>
<td>

This project is built and maintained by **[Nils](https://nils.proday.in)**.

→ **Portfolio:** [**nils.proday.in**](https://nils.proday.in) — projects, work & contact  
→ **Release tracker:** [**prodex.proday.in**](https://prodex.proday.in) — changelog, install notes, roadmap  
→ **Questions & feedback:** collegeitpro@gmail.com

</td>
</tr>
</table>

> New versions and release notes land on **[prodex.proday.in](https://prodex.proday.in)** first. Pin package versions in production and check the site before upgrading.

---

## ✨ Features

- **ProDex** root node — prompt in, agent result out
- **ProDex Agent** root node with native n8n Memory and Tool connections, backed by Codex app-server dynamic tools and built-in live web search
- **ProDex Chat Model** for n8n **AI Agent** (connect to Chat Model input)
- **ProDex Setup** node for browser login and credential export inside n8n
- **Token refresh** at runtime when access tokens expire
- Automatic Codex data directory under n8n's own user folder (no manual env vars)
- Thread modes: new, continue, resume
- **Skills system** — install `SKILL.md` files and reference them in system prompts (static + dynamic)

---

## ⚠️ Important caveat

The ProDex and ProDex Chat Model nodes use the official `@openai/codex-sdk`. ProDex Agent uses Codex app-server to register connected n8n tools as dynamic tools; Codex currently marks this app-server tool API experimental. Codex backend endpoints and protocol details may change without notice. Pin package versions in production.

---

## Requirements

- Self-hosted n8n (not n8n Cloud)
- Node.js 18+
- `@openai/codex` CLI binaries (installed automatically as a dependency on supported platforms)

---

## Installation

### Option A: Install from npm (community node UI)

In self-hosted n8n:

1. Open **Settings → Community Nodes**
2. Click **Install**
3. Enter package name:

```
@fixtse/n8n-nodes-prodex
```

4. Accept the risk prompt and install
5. Restart n8n if prompted

### Option B: Custom extensions directory (development)

```bash
git clone git@github.com:fixtse/n8n-nodes-prodex.git
cd n8n-nodes-prodex
pnpm install
pnpm run build

export N8N_CUSTOM_EXTENSIONS="/absolute/path/to/n8n-nodes-prodex"
n8n start
```

The package directory must contain installed dependencies (`@openai/codex`, `@openai/codex-sdk`). Running `pnpm install` in the package folder satisfies that requirement.

For Docker, mount the built package and set `N8N_CUSTOM_EXTENSIONS`. See [`docker/Dockerfile.n8n-codex`](docker/Dockerfile.n8n-codex).

---

## Authentication (entirely inside n8n)

No CLI or manual environment variables are required for users.

### Step 1: Start device login

1. Create a workflow with **Manual Trigger** → **ProDex Setup**
2. Set operation to **Start Device Login**
3. Execute the workflow
4. Open the returned `verificationUrl` and enter `userCode` in your browser
5. Sign in with your Codex account

### Step 2: Wait for login complete

1. Change the setup node operation to **Wait for Login Complete**
2. Execute again after browser login completes
3. Confirm the output shows `hasCompleteAuth: true`

### Step 3: Run Codex

Add the **ProDex** node and run your workflow. **Do not select credentials** — leave **Use n8n Credentials** off. Auth is read automatically from `auth.json` on disk.

If tokens expire and refresh fails, repeat the setup flow with **ProDex Setup**.

### Optional: store tokens in n8n Credentials

Only needed if you prefer n8n Credentials over disk auth (e.g. multi-worker setups):

1. ProDex Setup → **Export Credential Values**
2. Create **Credentials → ProDex Auth API** and paste the returned fields
3. On the ProDex node, enable **Use n8n Credentials** and select that credential

| Credential field | JSON field from setup node |
|---|---|
| Access Token | `accessToken` |
| Refresh Token | `refreshToken` |
| ID Token | `idToken` |
| Account ID | `accountId` |
| Expires At | `expiresAt` |

---

## Use with n8n AI Agent (Chat Model)

Connect **ProDex Chat Model** to the **Chat Model** input on the **AI Agent** node:

1. Complete setup (Start Device Login → Wait for Login Complete)
2. Add **When chat message received** (or any trigger) → **AI Agent**
3. Add **ProDex Chat Model** as a separate node on the canvas
4. Connect **ProDex Chat Model → Model** to **AI Agent → Chat Model**
5. Execute and chat

Example layout:

```
When chat message received → AI Agent
ProDex Chat Model ──────→ Chat Model (on AI Agent)
```

**Notes:**

- Credentials are optional when `auth.json` is already on the server
- Tool nodes connected to AI Agent have limited support — Codex returns text responses, not native LangChain tool-call payloads. For full coding-agent behavior (sandbox, shell, multi-file edits), use the standalone **ProDex** node
- Default sandbox is **Read Only** for safer chat use

## Use ProDex Agent with memory and tools

Use **ProDex Agent** when Codex should own the agent loop and call n8n tools directly. This is separate from **ProDex Chat Model**, which remains a model connection for n8n's AI Agent.

1. Complete ProDex Setup.
2. Connect your trigger or chat input to **ProDex Agent**.
3. Connect an n8n memory node to the Agent's **Memory** input.
4. Connect n8n tool nodes to the Agent's **Tools** input.
5. Choose the sandbox and run the workflow.

The node loads memory before the turn and saves the user prompt and final response afterward. Codex live web search is enabled through the built-in search capability, so you do not need to connect a separate search node. Codex invokes other connected tools through app-server callbacks; tool call names, arguments, and results are included in the output. Codex app-server dynamic tools are experimental and require the package's bundled Codex CLI version.

---

## Skills (install + system prompt)

Skills are stored as `SKILL.md` files under `{codexHome}/skills/{skill-name}/` (Cursor/Codex-compatible format).

### Install a skill

Use **ProDex** → **Install Skill** (install from GitHub via `npx skills add`), or paste skill markdown manually in older flows.

1. **ProDex** → **Install Skill**
2. Set **Skill Name** (e.g. `release-notes`)
3. Paste full **Skill Markdown** (YAML frontmatter + body)
4. Execute

### List installed skills

**ProDex** → **List Installed Skills** — returns `skillNames` you can copy into the ProDex node.

### Use skills in ProDex

| Field | Purpose |
|---|---|
| **System Prompt** | Static instructions on every run |
| **Static Skills** | Comma/newline skill names always loaded (e.g. `release-notes, lint-fix`) |
| **Dynamic Skills** | Expression per item — default `={{ $json.skillNames \|\| $json.skills }}` |

Dynamic skills accept:

- Skill names: `"release-notes"` or `["a", "b"]`
- Inline markdown: full SKILL.md text for one-off runs
- Objects: `[{ "name": "temp", "content": "..." }]`

Output includes `appliedSkills` so you can verify what was loaded.

---

## Usage

1. Add **ProDex** to your workflow
2. Complete **ProDex Setup** once (device login) — credentials are **not** required by default
3. Leave **Use n8n Credentials** off unless you exported tokens to n8n Credentials on purpose
4. Set prompt (default expression reads `chatInput`, `prompt`, or `text`)
5. Choose model, reasoning effort, sandbox, and thread mode
6. Execute

The model picker offers GPT-6 Astra, GPT-6.1 Sol (default), GPT-6 Sol, and GPT-6 Luna. Model access depends on your Codex account and plan.

### Output fields

```json
{
  "output": "Agent final response",
  "threadId": "thread_...",
  "items": [],
  "usage": { "inputTokens": 0, "outputTokens": 0, "totalTokens": 0 },
  "model": "gpt-6.1-sol",
  "finishReason": "stop"
}
```

### Thread modes

- **New Thread**: starts fresh each run
- **Continue Previous Thread**: reuses `threadId` stored in node static data
- **Resume Thread By ID**: resumes explicit thread ID (Codex sessions under the n8n-managed Codex home directory)

---

## Manual E2E test

1. Install the node on a self-hosted n8n instance
2. Run **ProDex Setup → Start Device Login**, complete browser auth, then **Export Credential Values**
3. Create the **ProDex Auth API** credential from the exported JSON
4. Build workflow: **Manual Trigger** → **ProDex** → **Set**
5. Prompt: `Reply with the single word OK.`
6. Model: `gpt-6.1-sol`, Sandbox: `Read Only`, Thread Mode: `New Thread`
7. Execute and verify `output` contains `OK` and `threadId` is populated

---

## Package load troubleshooting

If an update fails with a missing nested `uuid/dist/cjs/index.js`, the error
comes from the Chat Model's n8n AI SDK dependency tree. Version 0.7.2 defers
loading that integration until the Chat Model executes, so discovery of the
package and use of the standalone ProDex Agent do not load the AI SDK.

A missing dependency file can still prevent Chat Model execution. Reinstall
the package in the same container and as the same user that runs n8n. Stop
n8n first, back up the community packages directory, then run (after 0.7.2
has been published):

```bash
cd /home/node/.n8n/nodes
npm uninstall @fixtse/n8n-nodes-prodex
npm install @fixtse/n8n-nodes-prodex@0.7.2
```

Restart n8n afterward. Adapt the directory to your n8n user folder. Keep the
n8n database, credentials, and Codex auth directory intact. Dependency
`overrides` in this package do not control npm resolution when it is installed
as a dependency of n8n's community packages directory.

## Development

```bash
pnpm install
pnpm run build
pnpm test
pnpm run lint
```

---

## Docker example

Build a custom n8n image with Codex preinstalled:

```bash
docker build -f docker/Dockerfile.n8n-codex -t n8n-codex .
docker run -p 5678:5678 -e N8N_CUSTOM_EXTENSIONS=/custom-nodes n8n-codex
```

Codex runtime files are stored automatically under n8n's user folder (for example `/home/node/.n8n/codex` in the official Docker image).

---

## Security notes

- Treat credential tokens like passwords
- Prefer `read_only` sandbox on shared servers
- Do not set `OPENAI_API_KEY` in n8n if you want subscription billing; it can override ChatGPT auth in some Codex versions

---

## License

MIT

---

<div align="center">

**[💼 nils.proday.in](https://nils.proday.in)** · **[🌐 prodex.proday.in](https://prodex.proday.in)** · [GitHub](https://github.com/fixtse/n8n-nodes-prodex) · [npm](https://www.npmjs.com/package/@fixtse/n8n-nodes-prodex)

<br />

Built with care by **[Nils](https://nils.proday.in)**

</div>
