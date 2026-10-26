# VYBORA — A social universe

VYBORA is the new direction for this repository: a social universe for discovery, creativity, community, and connection.

## Current prototype

The first UI prototype lives in `index.html` and uses plain HTML, CSS, and JavaScript so it can be previewed without a build step.

Included in this prototype:
- Responsive desktop and mobile layout
- Feed with seeded sample sparks
- Create/publish text posts
- Local likes, replies, saved posts, topic search, and sharing
- Clear labels for features that are previews or not connected yet

## Important prototype limits

This is **not yet a production social network**. Posts, likes, replies, saved items, and follow states are stored in the current browser only. They do not sync between people or devices. Seed posts are illustrative. Media uploads, real accounts, online persistence, reliable anti-spam, moderation workflows, and messaging are not connected.

## Next implementation stage

1. Establish a dedicated VYBORA backend, separate from all Dream Education projects.
2. Design schema and Row Level Security before exposing any database tables.
3. Add anonymous-first sessions so people can explore without an account-creation flow.
4. Move posts, likes, comments, and media to online storage with server-enforced validation and rate limits.
5. Add tests for feed, interactions, moderation, and access controls before merging into `main`.

## Run

Open `index.html` in a modern browser. No dependencies or build process are required for the prototype.

## Product principle

A great social universe should help people discover and create—not merely scroll. Keep the experience welcoming, fast, accessible, and privacy-conscious as it grows.
