# Optional OCR component notices

The model/runtime pack is downloaded only after explicit user confirmation and runs locally.
The Webview integration includes code from the MIT components identified below.

- ONNX Runtime Web 1.26.0, copyright Microsoft Corporation, MIT.
- ppu-paddle-ocr 5.8.3 and its bundled Web/canvas helper, copyright 2025
  PT. Perkasa Pilar Utama, MIT.
- Formula inference logic adapted from OCR Buddy, copyright 2026 OCR Buddy contributors, MIT.
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
