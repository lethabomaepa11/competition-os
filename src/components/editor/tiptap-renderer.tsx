"use client";

import { useMemo } from "react";
import { generateHTML } from "@tiptap/html";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Strike from "@tiptap/extension-strike";
import Heading from "@tiptap/extension-heading";
import BulletList from "@tiptap/extension-bullet-list";
import OrderedList from "@tiptap/extension-ordered-list";
import ListItem from "@tiptap/extension-list-item";
import Blockquote from "@tiptap/extension-blockquote";
import CodeBlock from "@tiptap/extension-code-block";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import HardBreak from "@tiptap/extension-hard-break";
import HorizontalRule from "@tiptap/extension-horizontal-rule";

const extensions = [
  Document, Paragraph, Text, Bold, Italic, Strike,
  Heading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
  BulletList, OrderedList, ListItem, Blockquote, CodeBlock,
  Link.configure({ openOnClick: false }),
  Image, HardBreak, HorizontalRule,
];

export default function TipTapRenderer({ content }: { content: Record<string, unknown> | null | undefined }) {
  const html = useMemo(() => {
    if (!content) return "";
    try {
      return generateHTML(content as any, extensions);
    } catch {
      return "";
    }
  }, [content]);

  if (!html) return null;

  return (
    <div
      className="tiptap-content"
      dangerouslySetInnerHTML={{ __html: html }}
      style={{ lineHeight: 1.8 }}
    />
  );
}
