# Wright

A warm, elegant AI writing editor for authors. Built with Next.js, Tiptap, and Claude.

## Getting started

```bash
npm install
cp .env.local.example .env.local
# add your ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000.

Run the Supabase migrations in `SUPABASE_SETUP.md` (including step 2c, which
creates the `story_context` and `writing_requests` tables used by the
context-grounded writing workflow).

## Context-grounded AI writing

Wright's assistant helps you write *your* story instead of inventing its own.
Before generating prose it checks your manuscript and stored story context;
when an important detail is missing (a character's motivation, a scene's
outcome, a plot direction) it asks you one focused question above the chat
input. Your answers are saved as permanent story context, checked for
contradictions against existing canon, and reused in future generations. A
writing-mode selector beside the input (Ask Me First / Suggest Options /
Draft Freely) controls how much the AI asks versus assumes. Open **Story
context** from the AI panel to review, edit, or delete everything Wright
knows about your book.

## Tests

```bash
npm test
```

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
- sanitize-html + @tiptap/html (safe import normalization)
- html-to-docx (.docx export)
