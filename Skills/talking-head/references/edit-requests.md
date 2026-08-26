# Talking-Head revision playbook

How this skill realizes a revision. The harness only tells you it is a revision.

**Do not** `str_replace` `hf-project/index.html`. That file is scaffold output.

## Realize the change

1. Rewrite `cards/*.html` and `storyboard.json` to match the request (copy, timing, layout, style tokens).
2. Re-open the Storyboard-ready gate (Ask-Me) or continue (Auto-Run).
3. Re-scaffold from the **original upload**, not `speaker_noaudio`, via `scaffold_talking_head_project`.
4. `render_hyperframes`.

## Orientation or restyle

Rewrite cards from the active style-seed HTML, keep session orientation, re-gate, re-scaffold from the original upload.

## Restore a tagged past final

Follow this playbook after restore — still rewrite cards + storyboard, then re-scaffold. Do not patch the restored `hf-project/index.html` by hand.
