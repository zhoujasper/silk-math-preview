const s = String.raw;
const picture = (body) => s`\begin{tikzpicture}` + body + s`\end{tikzpicture}`;
const axes = (body, options = '') => picture(s`\begin{axis}[width=8cm,height=5cm,` + options + ']' + body + s`\end{axis}`);
const curve = s`\addplot[blue,thick,domain=0:2,samples=30]{x^2+\offset};`;
const shift = (i) => s`\def\offset{` + i / 100 + '}';
const rowBreak = String.fromCharCode(92, 92);
const grid = Array.from({ length: 8 }, (_, row) => Array.from({ length: 8 }, (_, col) => s`${row + col}+\offset`).join(' & ')).join(rowBreak) + rowBreak;

export const tikzStressCases = [
  { name: 'axis-30', expression: (i) => shift(i) + axes(curve), prelude: '' },
  { name: 'definition-edit', expression: () => axes(curve), prelude: (i) => shift(i) },
  { name: 'curves-8x80', expression: (i) => shift(i) + axes(Array.from({ length: 8 }, (_, n) => `\\addplot[no marks,domain=0:6,samples=80]{sin(deg(x+${n}/4))+${n}/5+\\offset};`).join('')), prelude: '' },
  { name: 'group-6x60', expression: (i) => shift(i) + picture(s`\begin{groupplot}[group style={group size=3 by 2},width=4cm,height=3cm]` + Array.from({ length: 6 }, (_, n) => `\\nextgroupplot[title={$x^{${n+1}}$}]\\addplot[no marks,domain=0:2,samples=60]{x^${n+1}+\\offset};`).join('') + s`\end{groupplot}`), prelude: '' },
  { name: 'surface-25x25', expression: (i) => shift(i) + axes(s`\addplot3[surf,samples=25,domain=-2:2]{sin(deg(x))*cos(deg(y))+\offset};`), prelude: '' },
  { name: 'network-60-nodes', expression: (i) => shift(i) + picture(s`\foreach\layer in{0,...,5}{\foreach\n in{0,...,9}{\node[draw,circle,inner sep=1pt] (n\layer-\n) at(1.2*\layer,.5*\n) {$\n$};}}
\foreach\layer in{0,...,4}{\pgfmathtruncatemacro{\nextlayer}{\layer+1}\foreach\n in{0,...,9}{\draw[blue!40] (n\layer-\n)--(n\nextlayer-\n);\pgfmathtruncatemacro{\nextn}{mod(\n+1,10)}\draw[gray!50] (n\layer-\n)--(n\nextlayer-\nextn);}}
\node at(3,-.5) {$\offset$};`), prelude: '' },
  { name: 'matrix-8x8', expression: (i) => shift(i) + picture(s`\matrix[matrix of math nodes,nodes={draw,inner sep=2pt}] {` + grid + '};'), prelude: s`\usetikzlibrary{matrix}` },
  { name: 'math-labels-80', expression: (i) => shift(i) + picture(s`\foreach\row in{0,...,9}{\foreach\col in{0,...,7}{\node at(1.3*\col,.7*\row) {$\frac{\alpha^{\row}+\beta_{\col}}{1+\offset}$};}}`), prelude: '' },
];
