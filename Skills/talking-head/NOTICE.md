# Attribution

The OkVevo `talking-head` skill adapts style fragments (card seeds under
`references/styles/`), layout geometry (`references/layouts.json`), and the
vendored GSAP runtime from the HyperFrames `talking-head-recut` skill in this
repo, which itself is adapted from the open-source **vtake-skills** project
(`vtake-cut`):

> https://github.com/notedit/vtake-skills

OkVevo changes relative to `talking-head-recut`: English-localized card copy;
CJK font fallbacks removed; style renames (swiss → corporate, terminal →
technical, xhs → social); 16:9 and 9:16 layouts only (no 4:5).

The original is MIT-licensed; its notice is retained below as required.

```
MIT License

Copyright (c) 2026 leeoxiang

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
