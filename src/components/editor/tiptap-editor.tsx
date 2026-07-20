"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import LinkExtension from "@tiptap/extension-link";
import ImageExtension from "@tiptap/extension-image";
import { useCallback, useEffect } from "react";
import {
  BoldOutlined,
  ItalicOutlined,
  StrikethroughOutlined,
  LinkOutlined,
  PictureOutlined,
  MinusOutlined,
  UndoOutlined,
  RedoOutlined,
} from "@ant-design/icons";

const MenuButton = ({
  onClick,
  active,
  children,
  title,
}: {
  onClick: () => void;
  active: boolean;
  children: React.ReactNode;
  title: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    style={{
      border: "1px solid #d9d9d9",
      borderRadius: 4,
      background: active ? "#e6f4ff" : "#fff",
      color: active ? "#1677ff" : "#333",
      cursor: "pointer",
      padding: "4px 8px",
      fontSize: 14,
      lineHeight: 1,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minWidth: 32,
      height: 32,
      transition: "all 0.2s",
    }}
  >
    {children}
  </button>
);

export interface TipTapEditorProps {
  value?: Record<string, unknown> | null;
  onChange?: (value: Record<string, unknown> | null) => void;
  placeholder?: string;
  minHeight?: number;
}

export default function TipTapEditor({
  value,
  onChange,
  placeholder = "Start typing...",
  minHeight = 200,
}: TipTapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      LinkExtension.configure({ openOnClick: false }),
      ImageExtension,
    ],
    content: (value ?? { type: "doc", content: [] }) as Record<string, unknown>,
    editorProps: {
      attributes: {
        style: `min-height: ${minHeight}px; outline: none; padding: 12px;`,
      },
    },
    onUpdate: ({ editor: ed }) => {
      const json = ed.getJSON() as Record<string, unknown>;
      onChange?.(json);
    },
  });

  // Sync external value changes to editor
  useEffect(() => {
    if (!editor) return;
    if (!value) {
      // Only clear if editor actually has content
      const content = editor.getJSON() as { content?: unknown[] };
      if (content?.content && content.content.length > 0) {
        editor.commands.setContent({ type: "doc", content: [] });
      }
    }
  }, []); // only on mount for initial empty state

  const addLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const addImage = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("Image URL", "https://");
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div
      style={{
        border: "1px solid #d9d9d9",
        borderRadius: 8,
        overflow: "hidden",
        background: "#fff",
      }}
      onClick={() => editor.chain().focus().run()}
    >
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          padding: "8px 12px",
          borderBottom: "1px solid #f0f0f0",
          background: "#fafafa",
        }}
      >
        <MenuButton
          onClick={() => editor.chain().focus().undo().run()}
          active={false}
          title="Undo"
        >
          <UndoOutlined />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().redo().run()}
          active={false}
          title="Redo"
        >
          <RedoOutlined />
        </MenuButton>

        <div
          style={{
            width: 1,
            height: 24,
            background: "#e8e8e8",
            margin: "0 4px",
          }}
        />

        <MenuButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Bold"
        >
          <BoldOutlined />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Italic"
        >
          <ItalicOutlined />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")}
          title="Strikethrough"
        >
          <StrikethroughOutlined />
        </MenuButton>

        <div
          style={{
            width: 1,
            height: 24,
            background: "#e8e8e8",
            margin: "0 4px",
          }}
        />

        <MenuButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          active={editor.isActive("heading", { level: 1 })}
          title="Heading 1"
        >
          H1
        </MenuButton>
        <MenuButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          active={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        >
          H2
        </MenuButton>
        <MenuButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          active={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
        >
          H3
        </MenuButton>

        <div
          style={{
            width: 1,
            height: 24,
            background: "#e8e8e8",
            margin: "0 4px",
          }}
        />

        <MenuButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="Bullet List"
        >
          &#8226;
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="Ordered List"
        >
          1.
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          title="Blockquote"
        >
          &ldquo;
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive("codeBlock")}
          title="Code Block"
        >
          {"</>"}
        </MenuButton>

        <div
          style={{
            width: 1,
            height: 24,
            background: "#e8e8e8",
            margin: "0 4px",
          }}
        />

        <MenuButton
          onClick={addLink}
          active={editor.isActive("link")}
          title="Link"
        >
          <LinkOutlined />
        </MenuButton>
        <MenuButton onClick={addImage} active={false} title="Image">
          <PictureOutlined />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          active={false}
          title="Horizontal Rule"
        >
          <MinusOutlined />
        </MenuButton>
      </div>

      {/* Editor Content */}
      <div style={{ padding: 0 }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
