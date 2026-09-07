# Optional TikZ renderer notices

Silk Math's main extension is MIT licensed. The separately loaded TikZ worker
(`dist/tikz-worker.js`, engine adapter by Jasper Zhou) is GPL-3.0-or-later.
Its corresponding source and pinned build dependencies are included in
`resources/tikz-worker-source.tar.gz`; the full GPL is in `tikz-GPL-3.0.txt`.

To rebuild the worker after extracting the source archive: install the pinned
build dependencies with `npm ci --ignore-scripts`, then run:

```sh
npx esbuild src/tikz/worker.ts --bundle --platform=node --format=cjs --minify --target=node18 --outfile=dist/tikz-worker.js --external:node-tikzjax --external:@prinsss/dvi2html
```

The optional runtime is downloaded only after TikZ is enabled and a picture is
previewed. Archives have fixed versions and verified SHA-512 integrity. Their
original package contents, licenses, readable JavaScript and font files are
retained unchanged in the extension's private component cache. The source code
being previewed stays on the machine. The VSIX contains no TeX binary or fonts.

The VSIX additionally includes the **unmodified pgfplots 1.18.3 macro sources**
in `resources/tikz-pgfplots-1.18.3.tar.gz` (GPL-3.0-or-later, Christian
Feuersänger and the PGF/TikZ contributors). This archive retains the upstream
TeX directory structure, source notices, TeX Live package metadata and GPL text.
It overlays the older pgfplots files in memory, including all distributed plot
libraries, and is used only by the optional TikZ worker. Existing WASM caches
therefore receive the macro upgrade without another runtime download.

Source: [pgfplots 1.18.3](https://github.com/pgf-tikz/pgfplots/releases/tag/1.18.3),
TeX Live revision 80105, downloaded from the
[MIT CTAN mirror](https://mirrors.mit.edu/CTAN/systems/texlive/tlnet/archive/pgfplots.tar.xz).
Source archive SHA-256: `86e6c635020970b292fecaf81d972452c0a75abecd0933db8ec27ee8f7174f9c`.
Bundled archive SHA-256: `77f39113e52895dde53d042dd49c0600ca21884a7cdb1bf7121354b73e344ecb`.
Reproduce it with `python3 scripts/vendor-tikz-libraries.py <pgfplots.tar.xz>`;
the script verifies the exact upstream digest before writing. Keep this separate
source archive alongside `resources/tikz-worker-source.tar.gz` when rebuilding.

- [node-tikzjax 1.0.5](https://github.com/prinsss/node-tikzjax): LPPL-1.3c;
  runtime glue and prebuilt TeX/WebAssembly data, from TikZJax and its forks.
  This extension supplies its own synchronous, memory-only TeX I/O adapter,
  sparse memory checkpoints, SVG cleanup and glyph outlining. The pinned WASM
  module gains four checked i32 global exports in memory so a complete clean
  checkpoint can be restored; its instructions and imports are unchanged.
  The downloaded upstream package files are never modified.
- The worker adapts the verified PGF intersections library **in memory**:
  `compactIntersectionFrames` in `src/tikz/libraries.ts` wraps four recursive
  bodies in zero-argument continuations to release TeX parameter frames early.
  PGF's calculations, tolerances and traversal order stay unchanged. The source
  digest is checked before this transformation; upstream notices are retained.
  This adapter and its reproducible transformation are included in the GPL source archive.
- [@prinsss/dvi2html 0.0.1](https://github.com/prinsss/dvi2html): its package
  metadata declares GPL-3.0. The npm archive's LICENSE file is MIT; both
  upstream declarations are preserved, and the optional adapter is offered
  under GPL-3.0-or-later to accommodate the more restrictive declaration.
- TeX, LaTeX, PGF/TikZ and pgfplots macro files retain their own notices in the
  upstream TeX archive. The bundled upgrade supports pgfplots compatibility 1.18;
  arbitrary CTAN packages, LuaTeX, external files and shell escape are not supported.
- [BaKoMa fonts](https://ctan.org/pkg/bakoma-fonts): BaKoMa Fonts Licence,
  copyright Basil K. Malyshev; the original licence is retained in the runtime.
  Labels become SVG paths using those fonts.
- [opentype.js 1.3.4](https://github.com/opentypejs/opentype.js): MIT, bundled
  only in the optional worker to outline font glyphs.
- [@xmldom/xmldom](https://github.com/xmldom/xmldom): MIT, bundled only in the
  optional worker for XML parsing and serialization.

## Bundled MIT dependency notices

The MIT License (MIT)

Copyright (c) 2020 Frederik De Bleser

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


Copyright 2019 - present Christopher J. Brody and other contributors, as listed in: https://github.com/xmldom/xmldom/graphs/contributors
Copyright 2012 - 2017 @jindw <jindw@xidea.org> and other contributors, as listed in: https://github.com/jindw/xmldom/graphs/contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.




MIT License

Copyright (c) 2015-present Devon Govett

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


Copyright Mathias Bynens <https://mathiasbynens.be/>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
