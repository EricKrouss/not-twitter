# Not Twitter

This is Not Twitter.

It looks suspiciously like Twitter, scrolls suspiciously like Twitter, and may
even trigger the same muscle memory as Twitter. But legally, spiritually, and
with a straight face, it is Not Twitter.

Under the trench coat, this is a Bluesky interface built on AT Protocol. The
goal is simple: keep the familiar timeline experience, remove the "Everything App" non-sense, and let posts come from a network that is not actively trying to
turn every refresh into 50 posts from Elon Musk.

## What Is This?

Not Twitter is a frontend for Bluesky.

It keeps the cozy old layout people remember:

- Home timeline
- Profiles
- Replies
- Likes
- Reposts
- Follows
- Search-ish exploration
- Image uploads
- Local bookmarks and theme preferences

But the data comes from Bluesky/AT Protocol, not the platform currently doing
side quests as a finance app, video app, hiring app, banking app, and public
group chat for people who reply "concerning" to everything.

## Why?

Because sometimes you want the old social app experience without the new "Everything App" smell.

Also because making a Bluesky client that looks like Twitter is objectively
funny.

## Development

Install dependencies:

```bash
npm install
```

Run the local dev server:

```bash
npm run dev
```

Open the printed local URL and sign in with a Bluesky handle or DID.

Self-hosted or alternate PDS deployments can be included in auth handle
resolution with a comma-separated list:

```bash
NEXT_PUBLIC_ATPROTO_PDS_URLS=https://bsky.social,https://pds.example.com npm run dev
```

The first URL is used as the default credential-session PDS, and `bsky.social`
stays available as a fallback when it is not listed.

For local OAuth development, use:

```text
http://127.0.0.1:3000
```

instead of:

```text
http://localhost:3000
```

Loopback OAuth tokens are development-only and short lived, just like most
rebrands.

## Static Export

Build the static site:

```bash
npm run export
```

The included GitHub Pages workflow builds `out/` with the correct repository
base path and writes the hosted AT Protocol OAuth client metadata file for the
Pages URL automatically.

For non-loopback deployments outside that workflow, set
`NEXT_PUBLIC_ATPROTO_CLIENT_ID` to a hosted AT Protocol OAuth client metadata
URL, or set `NEXT_PUBLIC_SITE_URL`/`NEXT_PUBLIC_URL` so the build can generate
one.

## Important Legal Stuff

Not Twitter is not Twitter, not X, not X Corp, not affiliated with Elon Musk,
and not responsible for any sudden urge to post "the old site was better."

Twitter-style words may still appear in the codebase because the original
frontend used them and because renaming every internal `tweet` reference would
be a very silly way to spend an afternoon.

## Tech Stuff

- Next.js
- React
- Tailwind CSS
- AT Protocol OAuth with PKCE/DPoP
- Bluesky APIs through `@atproto/api`

## Vibe Check

If Twitter is now X, this is Not Twitter.

If someone asks whether this is just Twitter with Bluesky underneath, politely
tell them no, this is not Twitter
