<p align="center">
  <img src="media/icon.png" width="96" alt="Silk Math Preview">
</p>

<p align="center" id="languages">
  <a href="#english">English</a> ·
  <a href="#chinese">中文</a> ·
  <a href="#chinese-traditional">繁體中文</a> ·
  <a href="#japanese">日本語</a> ·
  <a href="#korean">한국어</a> ·
  <a href="#german">Deutsch</a> ·
  <a href="#french">Français</a> ·
  <a href="#spanish">Español</a> ·
  <a href="#portuguese">Português</a> ·
  <a href="#russian">Русский</a> ·
  <a href="#italian">Italiano</a>
</p>

<p align="center">
  <strong>If you write math in VS Code, try this.</strong>
</p>

<p align="center">LaTeX · TeX · Markdown · MDX · Jupyter · MathJax · Windows / macOS / Linux</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=silkmath.silk-math-preview">Visual Studio Marketplace</a>
  ·
  <a href="https://github.com/zhoujasper/silk-math-preview">GitHub</a>
</p>

<p align="center">
  <img src="media/preview-live-caret.png" width="480" alt="Put the caret in a formula and a live preview appears beside it.">
</p>

<p align="center">
  <img src="media/preview-definitions.png" width="480" alt="Custom macros, environments, and colors render in the preview.">
</p>

<p align="center">
  <img src="media/preview-table.png" width="480" alt="Tables render in the live preview too.">
</p>

<h2 id="english">English</h2>

I kept hitting this in VS Code: the math is in my head, but my eyes are stuck on <code>$\frac{\partial u}{\partial t}=...$</code>. Then compile, switch preview, hunt which term the caret is actually in.

So I built <strong>Silk Math Preview</strong>. A live LaTeX overlay appears next to the formula you are typing. An orange hairline follows the caret. Not a whole-file preview — wherever you are in the equation, the preview is there too. No latexmk, no PDF, no compile step.

Works in <code>.tex</code>, Markdown, MDX, Jupyter (<code>.ipynb</code>), and other files that contain LaTeX math: <code>$...$</code>, <code>\(...\)</code>, <code>\[...\]</code>, <code>equation</code>, <code>align</code>, <code>tabular</code>, GitHub-flavored Markdown tables, and your own macros from <code>.sty</code> / <code>.cls</code>. Undefined commands appear in red; the rest of the formula still renders. Screenshot OCR is optional and stays on your machine.

<strong>Install:</strong> VS Code → Extensions → search <strong>Silk Math</strong>, or open the <a href="https://marketplace.visualstudio.com/items?itemName=silkmath.silk-math-preview">Marketplace listing</a>. The project is open source: <a href="https://github.com/zhoujasper/silk-math-preview">zhoujasper/silk-math-preview</a>.

- **Toggle** <code>Ctrl+Alt+M</code> (Mac: <code>Cmd+Alt+M</code>). <code>Esc</code> dismisses the overlay.
- **Settings** click <strong>Silk Math</strong> in the status bar.
- **OCR** click the camera icon. Models download on first use.

<p align="center"><a href="#languages">Languages</a></p>

<h2 id="chinese">中文</h2>

如果你平时会在 VS Code 里写 LaTeX / Markdown / Jupyter，应该很容易遇到这个问题：公式写到一半，脑子里想的是数学，眼睛看到的却是 <code>$\frac{\partial u}{\partial t}=...$</code>。然后还要不停编译、切预览、找自己到底写到公式哪一项了。

所以我做了 <strong>Silk Math Preview</strong>。它直接在你正在写的公式旁边实时渲染 LaTeX，而且不是普通的整段预览——光标写到哪里，预览里也会标到哪里。不用 latexmk，不用出 PDF。

<code>.tex</code>、Markdown、MDX、Jupyter（<code>.ipynb</code>），以及别的带 LaTeX 公式的文件都可以：<code>$...$</code>、<code>\(...\)</code>、<code>\[...\]</code>、<code>equation</code>、<code>align</code>、<code>tabular</code>、GitHub 风格表，还有 <code>.sty</code> / <code>.cls</code> 里自己的宏。未定义命令标红，其余照常渲染。截图 OCR 可选，只在本机运行。

<strong>安装：</strong>打开 VS Code → Extensions → 搜索 <strong>Silk Math</strong>，或打开<a href="https://marketplace.visualstudio.com/items?itemName=silkmath.silk-math-preview">商店页</a>。源码开源：<a href="https://github.com/zhoujasper/silk-math-preview">zhoujasper/silk-math-preview</a>。

- **开关预览** <code>Ctrl+Alt+M</code>（Mac：<code>Cmd+Alt+M</code>），关掉当前浮层按 <code>Esc</code>
- **设置** 点状态栏的 <strong>Silk Math</strong>
- **截图识别** 点状态栏的相机图标。模型首次使用才下载，只在本机运行

<p align="center"><a href="#languages">语言</a></p>

<h2 id="chinese-traditional">繁體中文</h2>

如果你平常會在 VS Code 裡寫 LaTeX / Markdown / Jupyter，應該很容易遇到這個問題：公式寫到一半，腦子裡想的是數學，眼睛看到的卻是 <code>$\frac{\partial u}{\partial t}=...$</code>。然後還要一直編譯、切預覽、找自己到底寫到公式哪一項。

所以我做了 <strong>Silk Math Preview</strong>。它直接在你正在寫的公式旁邊即時渲染 LaTeX，而且不是普通的整段預覽——游標寫到哪裡，預覽裡也會標到哪裡。不用 latexmk，不用出 PDF。

<code>.tex</code>、Markdown、MDX、Jupyter（<code>.ipynb</code>），以及其他帶 LaTeX 公式的檔案都可以。<strong>安裝：</strong>VS Code → Extensions → 搜尋 <strong>Silk Math</strong>，或打開<a href="https://marketplace.visualstudio.com/items?itemName=silkmath.silk-math-preview">商店頁</a>。源碼：<a href="https://github.com/zhoujasper/silk-math-preview">zhoujasper/silk-math-preview</a>。

- **開關預覽** <code>Ctrl+Alt+M</code>（Mac：<code>Cmd+Alt+M</code>），關掉目前浮層按 <code>Esc</code>
- **設定** 點狀態列的 <strong>Silk Math</strong>
- **截圖辨識** 點狀態列的相機圖示。模型首次使用才下載，只在本機執行

<p align="center"><a href="#languages">語言</a></p>

<h2 id="japanese">日本語</h2>

Visual Studio Code 向けのライブ LaTeX 数式プレビューです。<code>.tex</code>、Markdown、MDX、Quarto、Jupyter（<code>.ipynb</code>）を開き、数式の中にキャレットを置いてください。MathJax のオーバーレイが横に出て、入力位置はオレンジの細線で示されます。latexmk も PDF も不要です。

<code>$...$</code>、<code>\(...\)</code>、<code>\[...\]</code>、<code>equation</code>、<code>align</code>、<code>tabular</code>、GitHub Flavored Markdown の表、それに <code>.sty</code> / <code>.cls</code> の独自マクロも表示されます。未定義のコマンドは赤く残り、それ以外は通常どおり描画されます。

Marketplace で <strong>Silk Math Preview</strong> を検索するか、<a href="https://marketplace.visualstudio.com/items?itemName=silkmath.silk-math-preview">ストアページ</a>からインストールできます。

- **オン/オフ** <code>Ctrl+Alt+M</code>（Mac: <code>Cmd+Alt+M</code>）。<code>Esc</code> でオーバーレイを閉じます。
- **設定** ステータスバーの <strong>Silk Math</strong> をクリック。
- **OCR** カメラアイコンをクリック。モデルは初回のみダウンロードし、このマシンだけに残ります。

<p align="center"><a href="#languages">言語</a></p>

<h2 id="korean">한국어</h2>

Visual Studio Code용 실시간 LaTeX 수식 미리보기입니다. <code>.tex</code>, Markdown, MDX, Quarto, Jupyter(<code>.ipynb</code>) 파일을 열고 수식 안에 캐럿을 두세요. MathJax 오버레이가 옆에 뜨고, 입력 위치는 주황색 가는 선으로 표시됩니다. latexmk나 PDF 컴파일은 필요 없습니다.

<code>$...$</code>, <code>\(...\)</code>, <code>\[...\]</code>, <code>equation</code>, <code>align</code>, <code>tabular</code>, GitHub Flavored Markdown 표, <code>.sty</code> / <code>.cls</code> 사용자 매크로도 함께 보입니다. 정의되지 않은 명령은 빨간색으로 남고 나머지는 그대로 렌더링됩니다.

Marketplace에서 <strong>Silk Math Preview</strong>를 검색하거나 <a href="https://marketplace.visualstudio.com/items?itemName=silkmath.silk-math-preview">스토어 페이지</a>에서 설치하세요.

- **켜기/끄기** <code>Ctrl+Alt+M</code> (Mac: <code>Cmd+Alt+M</code>). <code>Esc</code>로 오버레이를 닫습니다.
- **설정** 상태 표시줄의 <strong>Silk Math</strong>을 클릭하세요.
- **OCR** 카메라 아이콘을 클릭하세요. 모델은 처음 사용할 때만 받고 이 기기에만 저장됩니다.

<p align="center"><a href="#languages">언어</a></p>

<h2 id="german">Deutsch</h2>

Eine Visual-Studio-Code-Erweiterung für Live-LaTeX-Mathematikvorschau. Öffnen Sie eine <code>.tex</code>-, Markdown-, MDX-, Quarto- oder Jupyter-Datei (<code>.ipynb</code>) und setzen Sie die Einfügemarke in eine Gleichung. Ein MathJax-Overlay erscheint daneben; eine orangefarbene Haarlinie zeigt, wo Sie tippen. Kein latexmk, kein PDF, kein Kompilieren.

Unterstützt <code>$...$</code>, <code>\(...\)</code>, <code>\[...\]</code>, <code>equation</code>, <code>align</code>, <code>tabular</code>, GitHub-Flavored-Markdown-Tabellen und eigene Makros aus <code>.sty</code> / <code>.cls</code>. Undefinierte Befehle werden rot angezeigt; der Rest der Formel wird weiter gerendert.

Im Marketplace nach <strong>Silk Math Preview</strong> suchen oder die <a href="https://marketplace.visualstudio.com/items?itemName=silkmath.silk-math-preview">Store-Seite</a> öffnen.

- **Ein/Aus** <code>Ctrl+Alt+M</code> (Mac: <code>Cmd+Alt+M</code>). <code>Esc</code> schließt die Überlagerung.
- **Einstellungen** klicken Sie in der Statusleiste auf <strong>Silk Math</strong>.
- **OCR** klicken Sie auf das Kamera-Symbol. Modelle werden beim ersten Gebrauch heruntergeladen und bleiben auf diesem Rechner.

<p align="center"><a href="#languages">Sprachen</a></p>

<h2 id="french">Français</h2>

Une extension Visual Studio Code pour l’aperçu LaTeX en direct. Ouvrez un fichier <code>.tex</code>, Markdown, MDX, Quarto ou Jupyter (<code>.ipynb</code>) et placez le curseur dans une équation. Un overlay MathJax apparaît à côté ; un trait orange indique où vous tapez. Pas de latexmk, pas de PDF, pas de compilation.

Fonctionne avec <code>$...$</code>, <code>\(...\)</code>, <code>\[...\]</code>, <code>equation</code>, <code>align</code>, <code>tabular</code>, les tableaux GitHub Flavored Markdown, et vos macros <code>.sty</code> / <code>.cls</code>. Les commandes non définies restent en rouge ; le reste de la formule est rendu.

Cherchez <strong>Silk Math Preview</strong> sur le Marketplace, ou ouvrez <a href="https://marketplace.visualstudio.com/items?itemName=silkmath.silk-math-preview">la fiche</a>.

- **Activer** <code>Ctrl+Alt+M</code> (Mac : <code>Cmd+Alt+M</code>). <code>Esc</code> ferme la superposition.
- **Réglages** cliquez sur <strong>Silk Math</strong> dans la barre d’état.
- **OCR** cliquez sur l’icône appareil photo. Les modèles se téléchargent à la première utilisation et restent sur votre machine.

<p align="center"><a href="#languages">Langues</a></p>

<h2 id="spanish">Español</h2>

Una extensión de Visual Studio Code para vista previa de matemáticas LaTeX en vivo. Abre un archivo <code>.tex</code>, Markdown, MDX, Quarto o Jupyter (<code>.ipynb</code>) y coloca el cursor dentro de una ecuación. Aparece una superposición MathJax al lado; una línea naranja marca dónde escribes. Sin latexmk, sin PDF, sin compilar.

Funciona con <code>$...$</code>, <code>\(...\)</code>, <code>\[...\]</code>, <code>equation</code>, <code>align</code>, <code>tabular</code>, tablas GitHub Flavored Markdown y macros propias de <code>.sty</code> / <code>.cls</code>. Los comandos no definidos salen en rojo; el resto de la fórmula se renderiza igual.

Busca <strong>Silk Math Preview</strong> en el Marketplace o abre <a href="https://marketplace.visualstudio.com/items?itemName=silkmath.silk-math-preview">la ficha</a>.

- **Activar** <code>Ctrl+Alt+M</code> (Mac: <code>Cmd+Alt+M</code>). <code>Esc</code> cierra la superposición.
- **Ajustes** haz clic en <strong>Silk Math</strong> en la barra de estado.
- **OCR** haz clic en el icono de la cámara. Los modelos se descargan la primera vez y se quedan en tu equipo.

<p align="center"><a href="#languages">Idiomas</a></p>

<h2 id="portuguese">Português</h2>

Uma extensão do Visual Studio Code para pré-visualização ao vivo de matemática em LaTeX. Abra um arquivo <code>.tex</code>, Markdown, MDX, Quarto ou Jupyter (<code>.ipynb</code>) e coloque o cursor dentro de uma equação. Uma sobreposição MathJax aparece ao lado; uma linha laranja marca onde você está digitando. Sem latexmk, sem PDF, sem compilar.

Funciona com <code>$...$</code>, <code>\(...\)</code>, <code>\[...\]</code>, <code>equation</code>, <code>align</code>, <code>tabular</code>, tabelas GitHub Flavored Markdown e macros em <code>.sty</code> / <code>.cls</code>. Comandos indefinidos ficam em vermelho; o restante da fórmula continua sendo renderizado.

Pesquise <strong>Silk Math Preview</strong> no Marketplace ou abra <a href="https://marketplace.visualstudio.com/items?itemName=silkmath.silk-math-preview">a página</a>.

- **Ligar/desligar** <code>Ctrl+Alt+M</code> (Mac: <code>Cmd+Alt+M</code>). <code>Esc</code> fecha a sobreposição.
- **Configurações** clique em <strong>Silk Math</strong> na barra de status.
- **OCR** clique no ícone da câmera. Os modelos baixam no primeiro uso e ficam neste computador.

<p align="center"><a href="#languages">Idiomas</a></p>

<h2 id="russian">Русский</h2>

Расширение Visual Studio Code для живого предпросмотра формул LaTeX. Откройте файл <code>.tex</code>, Markdown, MDX, Quarto или Jupyter (<code>.ipynb</code>) и поставьте курсор внутрь уравнения. Рядом появится слой MathJax; оранжевая линия отмечает место ввода. Без latexmk, без PDF, без компиляции.

Работают <code>$...$</code>, <code>\(...\)</code>, <code>\[...\]</code>, <code>equation</code>, <code>align</code>, <code>tabular</code>, таблицы GitHub Flavored Markdown и свои макросы из <code>.sty</code> / <code>.cls</code>. Неопределённые команды показаны красным; остальная формула рисуется как обычно.

Найдите <strong>Silk Math Preview</strong> в Marketplace или откройте <a href="https://marketplace.visualstudio.com/items?itemName=silkmath.silk-math-preview">страницу</a>.

- **Вкл/выкл** <code>Ctrl+Alt+M</code> (Mac: <code>Cmd+Alt+M</code>). <code>Esc</code> закрывает наложение.
- **Настройки** нажмите <strong>Silk Math</strong> в строке состояния.
- **OCR** нажмите значок камеры. Модели скачиваются при первом использовании и остаются на этом компьютере.

<p align="center"><a href="#languages">Языки</a></p>

<h2 id="italian">Italiano</h2>

Un’estensione Visual Studio Code per l’anteprima live della matematica LaTeX. Apri un file <code>.tex</code>, Markdown, MDX, Quarto o Jupyter (<code>.ipynb</code>) e metti il cursore dentro un’equazione. Accanto compare un overlay MathJax; una linea arancione indica dove stai scrivendo. Niente latexmk, niente PDF, nessuna compilazione.

Funziona con <code>$...$</code>, <code>\(...\)</code>, <code>\[...\]</code>, <code>equation</code>, <code>align</code>, <code>tabular</code>, tabelle GitHub Flavored Markdown e macro in <code>.sty</code> / <code>.cls</code>. I comandi non definiti restano in rosso; il resto della formula viene comunque renderizzato.

Cerca <strong>Silk Math Preview</strong> nel Marketplace oppure apri <a href="https://marketplace.visualstudio.com/items?itemName=silkmath.silk-math-preview">la scheda</a>.

- **Attiva** <code>Ctrl+Alt+M</code> (Mac: <code>Cmd+Alt+M</code>). <code>Esc</code> chiude la sovrapposizione.
- **Impostazioni** fai clic su <strong>Silk Math</strong> nella barra di stato.
- **OCR** fai clic sull’icona della fotocamera. I modelli si scaricano al primo uso e restano sul computer.

<p align="center"><a href="#languages">Lingue</a></p>

MIT License · [Jasper Zhou](https://zhoujasper.github.io) · [GitHub](https://github.com/zhoujasper/silk-math-preview) · [LICENSE](LICENSE) · [Third-party notices](THIRD_PARTY_NOTICES.md)
