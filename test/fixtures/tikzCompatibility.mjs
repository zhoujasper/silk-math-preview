const s = String.raw;
const picture = (body) => s`\begin{tikzpicture}` + body + s`\end{tikzpicture}`;
const plot = (body, options = '') => picture(s`\begin{axis}[width=6cm,height=4cm,` + options + ']' + body + s`\end{axis}`);

// Small real-TeX regressions; no browser, external data, shell or system TeX needed.
export const tikzCompatibilityCases = [
  ['groupplots', picture(s`\begin{groupplot}[group style={group size=2 by 1},width=4cm,height=3cm]\nextgroupplot[title={$x^2$}]\addplot{x^2};\nextgroupplot[title={$x^3$}]\addplot{x^3};\end{groupplot}`)],
  ['fillbetween', plot(s`\addplot[name path=A,blue,domain=0:2]{x^2};\addplot[name path=B,red,domain=0:2]{x};\addplot[blue!20] fill between[of=A and B];`), s`\usepgfplotslibrary{fillbetween}`],
  ['statistics', plot(s`\addplot+[boxplot prepared={lower whisker=0,lower quartile=1,median=2,upper quartile=3,upper whisker=4}] coordinates {};`), s`\usepgfplotslibrary{statistics}`],
  ['polar', picture(s`\begin{polaraxis}[width=5cm,height=4cm]\addplot[domain=0:360,samples=30]{1+cos(x)};\end{polaraxis}`)],
  ['ternary', picture(s`\begin{ternaryaxis}[width=5cm]\addplot3 coordinates {(0.2,0.3,0.5) (0.4,0.4,0.2)};\end{ternaryaxis}`)],
  ['smithchart', picture(s`\begin{smithchart}[width=5cm]\addplot coordinates {(0.2,0.5) (1,1) (2,0.5)};\end{smithchart}`)],
  ['dateplot', plot(s`\addplot coordinates {(2026-01-01,1) (2026-01-02,3) (2026-01-03,2)};`, s`date coordinates in=x,xticklabel=\day`), s`\usepgfplotslibrary{dateplot}`],
  ['patchplots', plot(s`\addplot3[patch,patch type=triangle] coordinates {(0,0,0) (1,0,1) (0,1,2)};`), s`\usepgfplotslibrary{patchplots}`],
  ['error-bars', plot(s`\addplot+[error bars/.cd,y dir=both,y explicit] coordinates {(0,1) +- (0,0.2) (1,2) +- (0,0.3)};`)],
  ['bars-legend', plot(s`\addplot coordinates {(A,1) (B,3)};\addplot coordinates {(A,2) (B,1)};\legend{First,Second}`, 'ybar,symbolic x coords={A,B},xtick=data')],
  ['log-axis', picture(s`\begin{loglogaxis}[width=5cm,height=4cm]\addplot coordinates {(1,1) (10,100) (100,10000)};\end{loglogaxis}`)],
  ['surface', plot(s`\addplot3[surf,samples=6,domain=-1:1]{x*y};`)],
  ['custom-function', plot(s`\addplot[domain=0:2]{curve(x)};`), s`\pgfmathdeclarefunction{curve}{1}{\pgfmathparse{#1^2}}`],
  ['inline-table', plot(s`\addplot table[x=x,y=y]{\values};`), s`\usepackage{pgfplotstable}\pgfplotstableread[row sep=\\]{x y\\0 0\\1 2\\2 1\\}\values`],
  ['old-style', picture(s`\node[box] at (0,0) {$\alpha$};`), s`\tikzstyle{box}=[draw,circle,blue]`],
  ['circuit-options', s`\begin{circuitikz}\draw(0,0) to[R=$R$] (2,0);\end{circuitikz}`, s`\usepackage[american]{circuitikz}`],
  ['decorations', picture(s`\draw[decorate,decoration={coil}] (0,0)--(3,0);`), s`\usetikzlibrary{decorations.pathmorphing}`],
  ['patterns', picture(s`\fill[pattern=north east lines,pattern color=blue] (0,0) rectangle (2,1);`), s`\usetikzlibrary{patterns}`],
  ['shading', picture(s`\shade[left color=blue,right color=red] (0,0) rectangle (2,1);`)],
  ['nodes-positioning', picture(s`\node[draw] (a) {A};\node[draw,right=of a] (b) {B};\draw[-{Stealth}] (a)--(b);`), s`\usetikzlibrary{positioning,arrows.meta}`],
  ['matrix', picture(s`\matrix[matrix of math nodes,nodes={draw}] {a & b\\c & d\\};`), s`\usetikzlibrary{matrix}`],
  ['clipping', picture(s`\clip(0,0) rectangle (2,1);\fill[red,opacity=.5] (1,.5) circle(1);`)],
  ['loops-math', picture(s`\def\count{4}\foreach\i in{1,...,\count}{\draw(\i,0)--(\i,{sin(30*\i)});}`)],
  ['nested-tree', picture(s`\node[draw] {Root} child {node[draw] {Left} child {node {A}} child {node {B}}} child {node[draw] {Right} child {node {C}}};`), s`\usetikzlibrary{trees}\tikzset{level 1/.style={sibling distance=3cm},level 2/.style={sibling distance=1cm}}`],
  ['intersections-calc', picture(s`\path[name path=c] (0,0) circle(1);\path[name path=l] (-2,.5)--(2,.5);\path[name intersections={of=c and l,by={a,b}}];\draw[blue] (0,0) circle(1);\draw[red,thick] (a)--(b);\node at($(a)!.5!(b)$) {$M$};`), s`\usetikzlibrary{calc,intersections}`],
  ['layers', picture(s`\node[draw,circle] (a) {A};\begin{pgfonlayer}{back}\fill[blue!20] (-1,-1) rectangle(1,1);\end{pgfonlayer}`), s`\pgfdeclarelayer{back}\pgfsetlayers{back,main}`],
  ['angles-quotes', picture(s`\coordinate (a) at (2,0);\coordinate (b) at (0,0);\coordinate (c) at(1,1);\draw(a)--(b)--(c);\pic[draw,blue,"$\theta$",angle radius=8mm] {angle=a--b--c};`), s`\usetikzlibrary{angles,quotes}`],
  ['logic-gates', picture(s`\node[and gate US,draw,logic gate inputs=nn] (a) at(0,0) {};\node[not gate US,draw] (b) at(2,0) {};\draw(a.output)--(b.input);`), s`\usetikzlibrary{shapes.gates.logic.US}`],
  ['curved-text', picture(s`\path[decorate,decoration={text along path,text={Silk Math Preview}}] (0,0) .. controls(1,1) and(2,1) .. (3,0);`), s`\usetikzlibrary{decorations.text}`],
  ['parametric', plot(s`\addplot[blue,domain=0:360,samples=40] ({cos(x)},{sin(x)});`, 'axis equal')],
  ['quiver', plot(s`\addplot[quiver={u={-y},v={x},scale arrows=.3},-stealth] coordinates {(1,0) (0,1) (-1,0) (0,-1)};`)],
];
