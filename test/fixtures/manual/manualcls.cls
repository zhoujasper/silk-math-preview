\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{manualcls}[2026/08/22 manual class fixture]
\LoadClass{article}

\newcommand{\clsOnly}[1]{\mathsf{#1}}
\newenvironment{eqmath}{\begin{equation}}{\end{equation}}
\newenvironment{question}{%
  \par\bigskip\noindent\textbf{Question.}\par
}{\par}
