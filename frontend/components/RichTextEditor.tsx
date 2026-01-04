import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { useEditor, EditorContent } from '@tiptap/react';

export default function RichTextEditor({ value, onChange }: { value: string, onChange: (html: string) => void }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    immediatelyRender: false,
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) {
    return null;
  }

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ 
        display: 'flex', 
        gap: '4px', 
        padding: '8px', 
        background: '#f9fafb', 
        borderBottom: '1px solid #e5e7eb',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          style={{
            padding: '6px 12px',
            border: '1px solid #d1d5db',
            background: editor.isActive('bold') ? '#1a2340' : '#fff',
            color: editor.isActive('bold') ? '#fff' : '#374151',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '14px'
          }}
        >
          B
        </button>
        
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          style={{
            padding: '6px 12px',
            border: '1px solid #d1d5db',
            background: editor.isActive('italic') ? '#1a2340' : '#fff',
            color: editor.isActive('italic') ? '#fff' : '#374151',
            borderRadius: '4px',
            cursor: 'pointer',
            fontStyle: 'italic',
            fontSize: '14px'
          }}
        >
          I
        </button>

        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          style={{
            padding: '6px 12px',
            border: '1px solid #d1d5db',
            background: editor.isActive('underline') ? '#1a2340' : '#fff',
            color: editor.isActive('underline') ? '#fff' : '#374151',
            borderRadius: '4px',
            cursor: 'pointer',
            textDecoration: 'underline',
            fontSize: '14px'
          }}
        >
          U
        </button>


        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          style={{
            padding: '6px 12px',
            border: '1px solid #d1d5db',
            background: editor.isActive('strike') ? '#1a2340' : '#fff',
            color: editor.isActive('strike') ? '#fff' : '#374151',
            borderRadius: '4px',
            cursor: 'pointer',
            textDecoration: 'line-through',
            fontSize: '14px'
          }}
        >
          S
        </button>

        <div style={{ width: '1px', background: '#d1d5db', margin: '0 4px' }} />

        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          style={{
            padding: '6px 12px',
            border: '1px solid #d1d5db',
            background: editor.isActive('bulletList') ? '#1a2340' : '#fff',
            color: editor.isActive('bulletList') ? '#fff' : '#374151',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          • List
        </button>

        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          style={{
            padding: '6px 12px',
            border: '1px solid #d1d5db',
            background: editor.isActive('orderedList') ? '#1a2340' : '#fff',
            color: editor.isActive('orderedList') ? '#fff' : '#374151',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          1. List
        </button>

        <div style={{ width: '1px', background: '#d1d5db', margin: '0 4px' }} />
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          style={{
            padding: '6px 12px',
            border: '1px solid #d1d5db',
            background: editor.isActive('heading', { level: 1 }) ? '#1a2340' : '#fff',
            color: editor.isActive('heading', { level: 1 }) ? '#fff' : '#374151',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          H1
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          style={{
            padding: '6px 12px',
            border: '1px solid #d1d5db',
            background: editor.isActive('heading', { level: 2 }) ? '#1a2340' : '#fff',
            color: editor.isActive('heading', { level: 2 }) ? '#fff' : '#374151',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          H2
        </button>

        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          style={{
            padding: '6px 12px',
            border: '1px solid #d1d5db',
            background: editor.isActive('heading', { level: 3 }) ? '#1a2340' : '#fff',
            color: editor.isActive('heading', { level: 3 }) ? '#fff' : '#374151',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          H3
        </button>

        <div style={{ width: '1px', background: '#d1d5db', margin: '0 4px' }} />

        {/* Alignment Buttons */}
        <button
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          style={{
            padding: '6px 12px',
            border: '1px solid #d1d5db',
            background: editor.isActive({ textAlign: 'left' }) ? '#1a2340' : '#fff',
            color: editor.isActive({ textAlign: 'left' }) ? '#fff' : '#374151',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          ⬅
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          style={{
            padding: '6px 12px',
            border: '1px solid #d1d5db',
            background: editor.isActive({ textAlign: 'center' }) ? '#1a2340' : '#fff',
            color: editor.isActive({ textAlign: 'center' }) ? '#fff' : '#374151',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          ⬍
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          style={{
            padding: '6px 12px',
            border: '1px solid #d1d5db',
            background: editor.isActive({ textAlign: 'right' }) ? '#1a2340' : '#fff',
            color: editor.isActive({ textAlign: 'right' }) ? '#fff' : '#374151',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          ➡
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          style={{
            padding: '6px 12px',
            border: '1px solid #d1d5db',
            background: editor.isActive({ textAlign: 'justify' }) ? '#1a2340' : '#fff',
            color: editor.isActive({ textAlign: 'justify' }) ? '#fff' : '#374151',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          ☰
        </button>

        <div style={{ width: '1px', background: '#d1d5db', margin: '0 4px' }} />

        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          style={{
            padding: '6px 12px',
            border: '1px solid #d1d5db',
            background: '#fff',
            color: '#374151',
            borderRadius: '4px',
            cursor: editor.can().undo() ? 'pointer' : 'not-allowed',
            opacity: editor.can().undo() ? 1 : 0.5,
            fontSize: '14px'
          }}
        >
          ↶
        </button>

        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          style={{
            padding: '6px 12px',
            border: '1px solid #d1d5db',
            background: '#fff',
            color: '#374151',
            borderRadius: '4px',
            cursor: editor.can().redo() ? 'pointer' : 'not-allowed',
            opacity: editor.can().redo() ? 1 : 0.5,
            fontSize: '14px'
          }}
        >
          ↷
        </button>
      </div>

      {/* Editor Content */}
      <div style={{ padding: '16px', minHeight: '200px', background: '#fff' }}>
        <EditorContent 
          editor={editor}
          style={{ 
            outline: 'none',
            minHeight: '80px'
          }}
        />
      </div>
    </div>
  );
}