import { useEffect, useMemo } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Link2,
  Minus,
  Table as TableIcon,
  Undo2,
  Redo2,
  Rows3,
  Columns3,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { editorExtensions } from '@/lib/editorExtensions';

interface RichTextEditorProps {
  /** Markdown to start from (the server's editorMarkdown). */
  initialMarkdown: string;
  /** Called with the document as Markdown after every change. */
  onChange: (markdown: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Accessible name for the editing area. */
  label: string;
}

function ToolbarButton({
  onClick,
  active = false,
  disabled = false,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      // Keep the editor's selection when clicking the toolbar
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'flex h-7 w-7 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40',
        active && 'bg-muted text-foreground'
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-border" aria-hidden />;
}

function Toolbar({ editor, disabled }: { editor: Editor; disabled: boolean }) {
  // Re-render the toolbar when the selection or formatting changes
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      h1: e.isActive('heading', { level: 1 }),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      task: e.isActive('taskList'),
      quote: e.isActive('blockquote'),
      link: e.isActive('link'),
      table: e.isActive('table'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const chain = () => editor.chain().focus();

  const setLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    // window.prompt is the lightest way to ask for a URL; an empty answer removes the link
    const url = window.prompt('Link address', previous ?? 'https://');
    if (url === null) return;
    if (url.trim() === '') chain().extendMarkRange('link').unsetLink().run();
    else chain().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-border bg-background px-1.5 py-1"
    >
      <ToolbarButton title="Bold (Ctrl+B)" active={state.bold} disabled={disabled} onClick={() => chain().toggleBold().run()}>
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton title="Italic (Ctrl+I)" active={state.italic} disabled={disabled} onClick={() => chain().toggleItalic().run()}>
        <Italic className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton title="Strikethrough" active={state.strike} disabled={disabled} onClick={() => chain().toggleStrike().run()}>
        <Strikethrough className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton title="Inline code" active={state.code} disabled={disabled} onClick={() => chain().toggleCode().run()}>
        <Code className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton title="Link" active={state.link} disabled={disabled} onClick={setLink}>
        <Link2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <Divider />
      <ToolbarButton title="Heading 1" active={state.h1} disabled={disabled} onClick={() => chain().toggleHeading({ level: 1 }).run()}>
        <Heading1 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton title="Heading 2" active={state.h2} disabled={disabled} onClick={() => chain().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton title="Heading 3" active={state.h3} disabled={disabled} onClick={() => chain().toggleHeading({ level: 3 }).run()}>
        <Heading3 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <Divider />
      <ToolbarButton title="Bulleted list" active={state.bullet} disabled={disabled} onClick={() => chain().toggleBulletList().run()}>
        <List className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton title="Numbered list" active={state.ordered} disabled={disabled} onClick={() => chain().toggleOrderedList().run()}>
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton title="Checklist" active={state.task} disabled={disabled} onClick={() => chain().toggleTaskList().run()}>
        <ListChecks className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton title="Quote" active={state.quote} disabled={disabled} onClick={() => chain().toggleBlockquote().run()}>
        <Quote className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton title="Divider" disabled={disabled} onClick={() => chain().setHorizontalRule().run()}>
        <Minus className="h-3.5 w-3.5" />
      </ToolbarButton>
      <Divider />
      {state.table ? (
        <>
          <ToolbarButton title="Add row below" disabled={disabled} onClick={() => chain().addRowAfter().run()}>
            <Rows3 className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton title="Add column to the right" disabled={disabled} onClick={() => chain().addColumnAfter().run()}>
            <Columns3 className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton title="Delete row" disabled={disabled} onClick={() => chain().deleteRow().run()}>
            <Rows3 className="h-3.5 w-3.5 text-destructive" />
          </ToolbarButton>
          <ToolbarButton title="Delete table" disabled={disabled} onClick={() => chain().deleteTable().run()}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </ToolbarButton>
        </>
      ) : (
        <ToolbarButton
          title="Insert table"
          disabled={disabled}
          onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          <TableIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
      )}
      <Divider />
      <ToolbarButton title="Undo (Ctrl+Z)" disabled={disabled || !state.canUndo} onClick={() => chain().undo().run()}>
        <Undo2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton title="Redo (Ctrl+Shift+Z)" disabled={disabled || !state.canRedo} onClick={() => chain().redo().run()}>
        <Redo2 className="h-3.5 w-3.5" />
      </ToolbarButton>
    </div>
  );
}

/**
 * A word-processor-style editor for Notion page bodies. People see formatted
 * text; Markdown is only what goes to Notion (see editorExtensions).
 */
export function RichTextEditor({ initialMarkdown, onChange, placeholder, disabled = false, label }: RichTextEditorProps) {
  const extensions = useMemo(() => editorExtensions(placeholder), [placeholder]);

  const editor = useEditor({
    extensions,
    content: initialMarkdown,
    contentType: 'markdown',
    editable: !disabled,
    immediatelyRender: true,
    editorProps: {
      attributes: {
        class: 'rich-text min-h-[14rem] px-4 py-3 text-sm text-foreground focus:outline-none',
        'aria-label': label,
        role: 'textbox',
        'aria-multiline': 'true',
      },
    },
    // The editor always keeps an empty paragraph at the end; don't save it as a blank line
    onUpdate: ({ editor: e }) => onChange(e.getMarkdown().replace(/(?:\s*<empty-block\/>)+\s*$/, '').trimEnd()),
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  if (!editor) return null;

  return (
    <div className={cn('border border-border bg-background focus-within:border-primary', disabled && 'opacity-70')}>
      <Toolbar editor={editor} disabled={disabled} />
      <div className="max-h-[60vh] overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
