# Talking-head motion catalog

Card motion is `data-anim-*` on elements. Scaffold compiles those into GSAP on
`index.html`. Do not invent CSS `@keyframes` (exception: technical seed cursor)
and do not `str_replace` `hf-project/index.html` — rewrite the card HTML, then
re-scaffold.

## Beat → layout

| Beat | Layout |
|------|--------|
| Hook / title / quote / mantra | `overlay` |
| Definition / data beside the face | `split` |
| Dense list / diagram / kinetic board | `pip` |
| Social lower-third (social style only) | `stack` (speaker bottom) |

Change layout when the card’s job changes. Consecutive same-job cards keep the
previous layout. No mix quota.

## `data-anim` kinds (compiled by scaffold)

`fade-in` · `fade-out` · `slide-in` (`data-anim-from`, `data-anim-distance`) ·
`kinetic-chars` (English: one `.char` **per word**) · `grow-x` / `grow-y` ·
`scale-pop` · `blur-in` · `draw-path` · `mask-reveal` (`data-anim-direction`)

Required attrs: `data-anim`, `data-anim-at`, `data-anim-duration`. Optional:
`data-anim-stagger`, `data-anim-from`, `data-anim-distance`, `data-anim-target-w`,
`data-anim-target-h`, `data-anim-direction`, plus a stable `id` for the selector.

If a needed kind is missing from the active seed, read
`Skills/hyperframes/hyperframes-animation/rules-index.md` then the named
`rules/<name>.md`. Keep new elements inside the seed’s color/font tokens.
