import katex from "katex";

/**
 * Normalizes various math delimiters commonly output by LLMs and Markdown engines:
 * - Escaped dollars: \$ -> $
 * - LaTeX brackets: \(...\) -> $...$
 * - Block brackets: \[...\] -> $$...$$
 */
export function normalizeMathDelimiters(raw: string): string {
  let s = raw;
  // Replace escaped \$ with $
  s = s.replace(/\\+\$/g, "$");
  // Replace \( and \) with $
  s = s.replace(/\\\(|\\\)/g, "$");
  // Replace \[ and \] with $$
  s = s.replace(/\\\[|\\\]/g, "$$");
  return s;
}

/**
 * Converts raw LaTeX expressions into crystal-clear, standard Unicode math symbols for Word documents and fallback rendering.
 * E.g. \frac{1}{2}\angle A -> ½ ∠A
 */
export function latexToReadableUnicode(str: string): string {
  let s = str;

  // Fractions
  s = s.replace(/\\frac\{1\}\{2\}/g, "½");
  s = s.replace(/\\frac\{1\}\{3\}/g, "⅓");
  s = s.replace(/\\frac\{2\}\{3\}/g, "⅔");
  s = s.replace(/\\frac\{1\}\{4\}/g, "¼");
  s = s.replace(/\\frac\{3\}\{4\}/g, "¾");
  s = s.replace(/\\frac\{1\}\{5\}/g, "⅕");
  s = s.replace(/\\frac\{1\}\{8\}/g, "⅛");
  s = s.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1/$2)");

  // Geometry & Trigonometry
  s = s.replace(/\\angle\s*([A-Za-z0-9]+)?/g, (_, g1) => `∠${g1 || ""}`);
  s = s.replace(/\\triangle\s*([A-Za-z0-9]+)?/g, (_, g1) => `△${g1 || ""}`);
  s = s.replace(/\^\\circ|\^\{\\circ\}|\\circ/g, "°");

  // Roots & Algebra
  s = s.replace(/\\sqrt\{([^}]+)\}/g, "√($1)");
  s = s.replace(/\\cdot/g, "·");
  s = s.replace(/\\times/g, "×");
  s = s.replace(/\\div/g, "÷");
  s = s.replace(/\\pm/g, "±");
  s = s.replace(/\\neq/g, "≠");
  s = s.replace(/\\approx/g, "≈");
  s = s.replace(/\\equiv/g, "≡");
  s = s.replace(/\\le|\\leq/g, "≤");
  s = s.replace(/\\ge|\\geq/g, "≥");

  // Greek Letters
  s = s.replace(/\\pi/g, "π");
  s = s.replace(/\\alpha/g, "α");
  s = s.replace(/\\beta/g, "β");
  s = s.replace(/\\gamma/g, "γ");
  s = s.replace(/\\theta/g, "θ");
  s = s.replace(/\\lambda/g, "λ");

  // Superscripts & Subscripts
  s = s.replace(/\^0/g, "⁰");
  s = s.replace(/\^1/g, "¹");
  s = s.replace(/\^2/g, "²");
  s = s.replace(/\^3/g, "³");
  s = s.replace(/\^n/g, "ⁿ");
  s = s.replace(/_0/g, "₀");
  s = s.replace(/_1/g, "₁");
  s = s.replace(/_2/g, "₂");
  s = s.replace(/_3/g, "₃");
  s = s.replace(/_n/g, "ₙ");

  // Clean remaining dollar signs and escape backslashes
  s = s.replace(/\\+\$/g, "");
  s = s.replace(/\$+/g, "");
  s = s.replace(/\\\(|\\\)/g, "");
  s = s.replace(/\\\[|\\\]/g, "");

  return s;
}

/**
 * Safely renders a LaTeX formula to KaTeX HTML with automatic syntax cleaning and fallback
 */
export function renderLatexToHtml(
  rawFormula: string,
  displayMode: boolean = false
): { html?: string; fallback?: string } {
  let cleaned = rawFormula.trim();

  // Strip enclosing delimiters
  if (cleaned.startsWith("$$") && cleaned.endsWith("$$") && cleaned.length > 4) {
    cleaned = cleaned.slice(2, -2).trim();
  } else if (cleaned.startsWith("$") && cleaned.endsWith("$") && cleaned.length > 2) {
    cleaned = cleaned.slice(1, -1).trim();
  } else if (cleaned.startsWith("\\$") && cleaned.endsWith("\\$") && cleaned.length > 4) {
    cleaned = cleaned.slice(2, -2).trim();
  }

  // Remove trailing unescaped backslash which commonly triggers KaTeX ParseError
  if (cleaned.endsWith("\\") && !cleaned.endsWith("\\\\")) {
    cleaned = cleaned.slice(0, -1).trim();
  }

  try {
    const html = katex.renderToString(cleaned, {
      throwOnError: false,
      displayMode,
    });
    return { html };
  } catch {
    return { fallback: latexToReadableUnicode(cleaned) };
  }
}
