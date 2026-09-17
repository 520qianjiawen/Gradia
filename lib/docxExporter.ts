import {
  Document,
  Paragraph,
  TextRun,
  ImageRun,
  HeadingLevel,
  AlignmentType,
  Packer,
  BorderStyle,
} from "docx";
import { latexToReadableUnicode, parseChoiceOptions } from "./mathUtils";

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

    // Markdown Image: ![alt](data:image/png;base64,...)
    const imgMatch = rawLine.match(
      /^!\[(.*?)\]\((data:image\/([a-zA-Z]+);base64,([^\)]+))\)/
    );
    if (imgMatch) {
      const altText = imgMatch[1];
      const mimeType =
        imgMatch[3].toLowerCase() === "jpeg" ? "jpg" : imgMatch[3].toLowerCase();
      const base64Data = imgMatch[4];

      try {
        const binaryStr = atob(base64Data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let b = 0; b < binaryStr.length; b++) {
          bytes[b] = binaryStr.charCodeAt(b);
        }

        // Measure aspect ratio to prevent stretching in Word
        let targetWidth = 320;
        let targetHeight = 200;
        try {
          if (typeof window !== "undefined") {
            const imgObj = new window.Image();
            imgObj.src = imgMatch[2];
            await new Promise((resolve) => {
              imgObj.onload = resolve;
              imgObj.onerror = resolve;
            });
            if (imgObj.naturalWidth && imgObj.naturalHeight) {
              const aspect = imgObj.naturalWidth / imgObj.naturalHeight;
              targetWidth = Math.min(380, Math.max(140, imgObj.naturalWidth));
              targetHeight = Math.round(targetWidth / aspect);
            }
          }
        } catch {}

        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 140, after: altText ? 40 : 140 },
            children: [
              new ImageRun({
                type: mimeType === "jpg" ? "jpg" : "png",
                data: bytes,
                transformation: {
                  width: targetWidth,
                  height: targetHeight,
                },
                altText: {
                  title: altText || "试卷插图",
                  description: altText || "试卷插图",
                  name: altText || "diagram",
                },
              }),
            ],
          })
        );

        const isGenericCaption =
          !altText ||
          altText === "几何配图" ||
          altText === "试卷插图" ||
          altText === "插图" ||
          altText.trim() === "";

        if (altText && !isGenericCaption) {
          children.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 40, after: 120 },
              children: [
                new TextRun({
                  text: altText,
                  size: 18, // 9pt
                  color: "6B7280",
                  italics: true,
                  font: "SongTi",
                }),
              ],
            })
          );
        }
      } catch (err) {
        console.warn("Failed to embed image into docx:", err);
      }
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
      const text = latexToReadableUnicode(rawLine.replace(/^#\s+/, "").replace(/\*\*/g, ""));
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
      const text = latexToReadableUnicode(rawLine.replace(/^##\s+/, "").replace(/\*\*/g, ""));
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
      const text = latexToReadableUnicode(rawLine.replace(/^###\s+/, "").replace(/\*\*/g, ""));
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

    // Sub-heading: #### Heading 4
    if (rawLine.startsWith("#### ")) {
      const text = latexToReadableUnicode(rawLine.replace(/^####\s+/, "").replace(/\*\*/g, ""));
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_4,
          spacing: { before: 160, after: 80 },
          children: [
            new TextRun({
              text,
              bold: true,
              size: 22, // 11pt
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

    // Multiple Choice Options (e.g. A. ... B. ... C. ... D. ...)
    const choiceOpts = parseChoiceOptions(rawLine);
    if (choiceOpts) {
      const isTwo = choiceOpts.length === 2;
      const separator = isTwo ? "                    " : "        ";
      const runs: TextRun[] = [];
      choiceOpts.forEach((opt, oIdx) => {
        runs.push(
          new TextRun({
            text: opt.label + " ",
            bold: true,
            size: 22,
            color: "111827",
            font: "SimSun",
          })
        );
        runs.push(
          new TextRun({
            text:
              latexToReadableUnicode(opt.text) +
              (oIdx < choiceOpts.length - 1 ? separator : ""),
            size: 22,
            color: "1F2937",
            font: "SimSun",
          })
        );
      });

      children.push(
        new Paragraph({
          indent: { left: 420 },
          spacing: { before: 60, after: 60, line: 280 },
          children: runs,
        })
      );
      continue;
    }

    // Normal paragraph or Question line
    const isQuestionNumber =
      /^(?:\d+[\.、]|\(\d+\)|（\d+）|[①②③④⑤⑥⑦⑧⑨⑩])/.test(rawLine);
    children.push(
      new Paragraph({
        spacing: {
          before: isQuestionNumber ? 200 : 60,
          after: 80,
          line: 320, // 1.3x line height for easy reading & writing
        },
        children: [
          new TextRun({
            text: latexToReadableUnicode(rawLine.replace(/\*\*/g, "")),
            size: 22, // 11pt
            color: "1F2937",
            font: "Calibri",
            bold: isQuestionNumber,
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
