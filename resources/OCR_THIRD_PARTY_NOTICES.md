# Optional OCR component notices

The model/runtime pack is downloaded only after explicit user confirmation and runs locally.
The background Worker includes code from the MIT components identified below.

- ONNX Runtime Web 1.26.0, copyright Microsoft Corporation, MIT.
- ppu-paddle-ocr 5.8.3 and its bundled Web/canvas helper, copyright 2025
  PT. Perkasa Pilar Utama, MIT.
- Formula inference logic adapted from OCR Buddy, copyright 2026 OCR Buddy contributors, MIT.
- PureImage 0.4.20, copyright 2014 Josh Marinacci, MIT (pure JavaScript canvas and PNG/JPEG decoding).
- pngjs 7.0.0, copyright 2015 Luke Page & Original Contributors; derived work copyright 2012 Kuba Niegowski, MIT.
- jpeg-js 0.4.4, copyright 2014 Eugene Ware and contributors, BSD-3-Clause.
- OpenType.js 0.4.11, copyright 2015 Frederik De Bleser, MIT.
- pix2text-mfr quantized model exports by Brian314 and the respective model authors, MIT.
- PP-OCRv5 model files and dictionary from PaddlePaddle/PaddleOCR, Apache-2.0.

Exact pinned revisions, byte sizes and hashes are defined in `src/ocr/packManifest.ts`.
The complete Apache License 2.0 text is shipped at `resources/APACHE-2.0.txt`.

## MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The copyright notices above and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## jpeg-js BSD-3-Clause License

Copyright (c) 2014, Eugene Ware
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright
   notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright
   notice, this list of conditions and the following disclaimer in the
   documentation and/or other materials provided with the distribution.
3. Neither the name of Eugene Ware nor the names of its contributors
   may be used to endorse or promote products derived from this software
   without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY EUGENE WARE ''AS IS'' AND ANY
EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL EUGENE WARE BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
