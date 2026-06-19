const INVISIBLE_CHARS =
  /[\u200B-\u200D\u2060\uFEFF\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180E\u2061-\u2064\u206A-\u206F]/g;

const COLOR_STYLE_PROPS = new Set([
  "color",
  "background",
  "background-color",
  "background-image",
]);

function stripStyleColors(style: string): string {
  const kept = style
    .split(";")
    .map((chunk) => chunk.trim())
    .filter((chunk) => {
      if (!chunk) return false;
      const colon = chunk.indexOf(":");
      if (colon === -1) return true;
      const prop = chunk.slice(0, colon).trim().toLowerCase();
      return !COLOR_STYLE_PROPS.has(prop);
    });
  return kept.join("; ");
}

export function formatPreviewText(text: string): string {
  return stripInvisibleChars(decodeHtmlEntities(text))
    .replace(/\s+/g, " ")
    .trim();
}

const ENTITY_ONLY_LINE = /^(\s*(?:&#?\w+;|&[a-z]+;)\s*)+$/i;

export function decodeHtmlEntities(text: string): string {
  if (typeof document === "undefined") return text;
  const el = document.createElement("textarea");
  el.innerHTML = text
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return el.value;
}

export function stripInvisibleChars(text: string): string {
  return text.replace(INVISIBLE_CHARS, "");
}

export function formatPlainEmailBody(text: string): string {
  const decoded = stripInvisibleChars(decodeHtmlEntities(text))
    .replace(/\r\n/g, "\n")
    .replace(/\u00A0/g, " ");

  const lines = decoded.split("\n").map((line) => line.trimEnd());
  const cleaned = lines.filter((line) => !ENTITY_ONLY_LINE.test(line.trim()));

  return cleaned
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function sanitizeEmailHtml(html: string): string {
  if (typeof document === "undefined") return html;

  const doc = new DOMParser().parseFromString(html, "text/html");
  const blockedTags = [
    "script",
    "style",
    "iframe",
    "object",
    "embed",
    "link",
    "meta",
    "form",
    "base",
  ];

  blockedTags.forEach((tag) => {
    doc.querySelectorAll(tag).forEach((node) => node.remove());
  });

  doc.querySelectorAll("*").forEach((el) => {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (
        name.startsWith("on") ||
        name === "srcdoc" ||
        name === "bgcolor" ||
        name === "color" ||
        (name === "href" && value.startsWith("javascript:")) ||
        (name === "src" && value.startsWith("javascript:"))
      ) {
        el.removeAttribute(attr.name);
      }
    }

    const style = el.getAttribute("style");
    if (style) {
      const cleaned = stripStyleColors(style);
      if (cleaned) {
        el.setAttribute("style", cleaned);
      } else {
        el.removeAttribute("style");
      }
    }

    if (el.tagName === "A") {
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener noreferrer");
    }
  });

  return doc.body.innerHTML;
}

export function prepareEmailDisplay(message: {
  body_text: string | null;
  body_html: string | null;
}): { mode: "html"; content: string } | { mode: "text"; content: string | null } {
  const html = message.body_html?.trim();
  if (html) {
    return { mode: "html", content: sanitizeEmailHtml(html) };
  }

  const text = message.body_text?.trim();
  if (text) {
    return { mode: "text", content: formatPlainEmailBody(text) };
  }

  return { mode: "text", content: null };
}
