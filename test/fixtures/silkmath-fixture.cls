\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{silkmath-fixture}[2026/08/21 Silk Math visual fixture class]
\LoadClass{article}
\RequirePackage{silkmath-fixture}

% 文本环境：begin 并不进入数学模式。
% 里面的 \[...\]、$...$ 必须仍是独立公式，不能把整段解答吞成一条“公式”。
\newenvironment{question}{%
  \par\bigskip\noindent\textbf{Question.}\par
}{\par}
\newenvironment{solution}{%
  \par\noindent\textit{Solution.}\par
}{\par}

\newcommand{\clsOnly}[1]{\mathsf{#1}}
\definecolor{ClsAccent}{rgb}{0.20,0.55,0.80}
