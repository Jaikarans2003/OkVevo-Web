# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: educators, trainers, and course makers who have a lecture, script, or recording and need a finished visual lesson without sitting in an editor.

Secondary: logged-in creators already on OkVevo who open Nia from the workspace.

## Product Purpose

OkVevo is the company. **Nia** is the face people remember. You talk to her. She turns lectures, lessons, and training into polished educational videos.

Success: a first-time visitor can name Nia, say what she does in one sentence, and start working with her (`/login` logged out, `/workspace/ai-studio` logged in).

## Positioning

You talk. Nia makes the lesson. Neighboring video generators sell a studio or a prompt box. This product sells a teaching assistant who takes a lecture and returns a shareable lesson.

## Operating Context

Visitors arrive on `/`. Conversion is `Work with Nia`. Pricing is live INR Razorpay plans (Starter / Hobby / Pro; Enterprise is contact). Physical MASIV booth exists in Bangalore but is not the landing story. Routes, auth, billing, and the AI Studio workshop URL stay.

## Capabilities and Constraints

- Nia plans from a lecture or script, then delivers a video with captions and visuals the user can still change in plain language.
- Marketing must not headline AI Studio. Name it at most once, in FAQ.
- Do not invent customers, benchmarks, or lesson titles as proof. Real Nia portraits live in `public/Nia/`. Real rupee prices stay.
- Keep `#pricing` for SEO. Retire MASIV as a landing block.

## Brand Commitments

- Nia is the face. OkVevo is the quiet company name (confirmed 2026-08-26).
- Line: `You talk. Nia makes the lesson.`
- Button: `Work with Nia` (one CTA intent). Hero secondary only: `Watch Nia work`.
- Palette lock (user-pinned): field `#242220`, panels `#2b2b2b`, chrome `#33312e`, type `#e3dcd6`, dim `#b5aea7`, orange `#ff6d1f` / hover `#e8621c` / press `#c45418`, peach glass `#e8c4b0`. Semantic siblings (petrol, rust, ochre, moss, umber, slate) are product status only, not marketing decoration.
- Type: Ubuntu stays. Museo Moderno may be dropped. Dancing Script is not the landing voice.
- Interaction lock: Wispr Flow-style scroll theater. Minimal page. Scroll-based animation instead of stacked marketing sections.
- Logos: `public/OKVEVO Logos WithOut BackGrounds/`. Nia: `public/Nia/`.

## Evidence on Hand

- Nia portraits: `public/Nia/1.png` through `5.png`, `nia-cutout.png`, `nia-cutout@2x.png`.
- Live pricing copy in `LANDING_PAGE_CONTENT.md` and `src/components/ook/Pricing.tsx`.
- Hero already names Nia as an AI teaching assistant; features/FAQ/footer still speak leftover cinema OKVEVO. Treat leftover copy as anti-reference.
- No independent customer testimonials on hand. Do not fabricate quotes.

## Product Principles

1. Nia is who people talk about. OkVevo signs the checks.
2. Prove the mechanism (talk becomes a lesson). Do not list studio features.
3. One CTA intent across the public site.
4. Scroll tells the story. Extra sections are a last resort, not the default.
5. Claims stay true. Prices, routes, and capabilities are not decoration.

## Accessibility & Inclusion

WCAG AA contrast on the locked palette. `prefers-reduced-motion` collapses pin/parallax to opacity. `prefers-reduced-transparency` drops blur for solid panels. Keyboard-reachable nav, CTA, pricing, and FAQ.
