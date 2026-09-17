import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Packer,
  BorderStyle,
} from "docx";
import { latexToReadableUnicode } from "./mathUtils";

/**
 * Converts Markdown exam paper text into a professional Word (.docx) document and downloads it
 */
export async function exportMarkdownToDocx(
  markdownText: string,
  filename: string = "电子试卷.docx"
): Promise<void> {
  const lines = markdownText.split("\n");
  const children: Paragraph[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();

    if (!rawLine) {
      children.push(new Paragraph({ spacing: { after: 120 } }));
      continue;
    }

    // Horizontal rule
    if (rawLine === "---" || rawLine === "***") {
      children.push(
        new Paragraph({
          border: {
            bottom: {
              color: "CCCCCC",
              space: 1,
              style: BorderStyle.SINGLE,
              size: 6,
            },
          },
          spacing: { before: 180, after: 180 },
        })
      );
      continue;
    }

    // Title: # Heading 1
    if (rawLine.startsWith("# ")) {
      const text = rawLine.replace(/^#\s+/, "");
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 200, after: 160 },
          children: [
            new TextRun({
              text,
              bold: true,
              size: 36, // 18pt
              color: "111827",
              font: "SimHei",
            }),
          ],
        })
      );
      continue;
    }

    // Section Title: ## Heading 2
    if (rawLine.startsWith("## ")) {
      const text = rawLine.replace(/^##\s+/, "");
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 280, after: 140 },
          children: [
            new TextRun({
              text,
              bold: true,
              size: 26, // 13pt
              color: "1F2937",
              font: "SimHei",
            }),
          ],
        })
      );
      continue;
    }

    // Sub-heading: ### Heading 3
    if (rawLine.startsWith("### ")) {
      const text = rawLine.replace(/^###\s+/, "");
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 100 },
          children: [
            new TextRun({
              text,
              bold: true,
              size: 24, // 12pt
              color: "374151",
            }),
          ],
        })
      );
      continue;
    }

    // Student Info line (e.g. **Name: ...**)
    if (rawLine.includes("Name:") || rawLine.includes("姓名")) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { before: 80, after: 180 },
          children: [
            new TextRun({
              text: rawLine.replace(/\*\*/g, ""),
              bold: true,
              size: 22,
              color: "4B5563",
            }),
          ],
        })
      );
      continue;
    }

    // Normal paragraph or Question line
    const isQuestionNumber = /^\d+\.\s/.test(rawLine);
    children.push(
      new Paragraph({
        spacing: {
          before: isQuestionNumber ? 120 : 60,
          after: 80,
          line: 320, // 1.3x line height for easy reading & writing
        },
        children: [
          new TextRun({
            text: latexToReadableUnicode(rawLine.replace(/\*\*/g, "")),
            size: 22, // 11pt
            color: "1F2937",
            font: "Calibri",
          }),
        ],
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".docx") ? filename : `${filename}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
