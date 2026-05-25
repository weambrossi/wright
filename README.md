# PageMind

A warm, elegant AI writing editor for authors. Built with Next.js, Tiptap, and Claude.

## Getting started

```bash
npm install
cp .env.local.example .env.local
# add your ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000.

## Deploying to Vercel

1. Push this repo to GitHub.
2. Import into Vercel.
3. Add `ANTHROPIC_API_KEY` as an environment variable.
4. Deploy.

## Tech stack

- Next.js 14 (App Router)
- Tailwind CSS
- Tiptap (with StarterKit, Typography, Underline, TextAlign, CharacterCount, Placeholder)
- Anthropic SDK — `claude-opus-4-20250514`
- mammoth (.docx import)
- html-to-docx (.docx export)
