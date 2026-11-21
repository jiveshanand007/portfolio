# Jivesh Anand · Portfolio

A cinematic, scroll-driven portfolio with a chat that answers questions about my work.
Built with Next.js 15, TypeScript and Tailwind.

## Run it locally

You need **Node.js 22+** and **Git**.

**1. Get the code**

```bash
git clone https://github.com/jiveshanand007/portfolio.git
cd portfolio
```

**2. Install pnpm (once per computer)**

```bash
npm install -g pnpm@9
```

**3. Install the packages**

```bash
pnpm install
```

**4. Create your settings file**

```bash
cp .env.example .env.local
```

On Windows Command Prompt, use `copy .env.example .env.local` instead.

**5. Start it**

```bash
pnpm dev
```

**6. Open <http://localhost:3000>.** The first load takes a little while.

Press `Ctrl + C` in the terminal to stop it.

## Optional extras

The site works without any keys. These turn on the extra features. Put the keys in `.env.local`, then restart `pnpm dev`.

| Feature | Keys in `.env.local` | Then run |
| --- | --- | --- |
| Contact form sends email | `RESEND_API_KEY` (from resend.com) | (nothing else to run) |
| "Ask me" chat answers | `DATABASE_URL`, `VOYAGE_API_KEY`, and a chat model: `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` | `pnpm db:migrate`, then `pnpm ingest` |

The chat model can be any OpenAI-compatible provider (Google Gemini has a free tier; also Groq, OpenRouter, OpenAI, or your own model) or Anthropic (`LLM_PROVIDER=anthropic`). `.env.example` lists the settings for each.

## Change the content

- Name, links, scene text and nav: `content/site.json`
- About, experience and projects: `content/*.mdx`
- Background art: `public/scenes/`
