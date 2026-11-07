/**
 * TipTap 所见即所得文档编辑器（类飞书/Notion）：工具栏 + 正文。
 */
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';
import { Callout } from './CalloutExtension';
import { Bilibili } from './BilibiliExtension';
import '../../../styles/article-editor.css';

export interface ArticleDocEditorProps {
  content: string;
  onChange: (html: string) => void;
  onUploadImage?: (file: File) => Promise<string | null>;
  editable?: boolean;
  placeholder?: string;
}

function Toolbar({ editor, onUploadImage }: { editor: Editor | null; onUploadImage?: (file: File) => Promise<string | null> }) {
  if (!editor) return null;
  const btn = (label: string, active: boolean, onClick: () => void, title?: string) => (
    <button type="button" className={`ae-tb__btn${active ? ' is-on' : ''}`} title={title || label}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}>{label}</button>
  );
  return (
    <div className="ae-tb" role="toolbar" aria-label="排版" data-testid="article-toolbar">
      {btn('H2', editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run())}
      {btn('H3', editor.isActive('heading', { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run())}
      {btn('B', editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), '加粗')}
      {btn('I', editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), '斜体')}
      {btn('U', editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), '下划线')}
      <span className="ae-tb__sep" />
      {btn('• 列表', editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run())}
      {btn('1. 列表', editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run())}
      <span className="ae-tb__sep" />
      {btn('链接', editor.isActive('link'), () => {
        const prev = editor.getAttributes('link').href as string | undefined;
        const url = window.prompt('链接 URL', prev || 'https://');
        if (url === null) return;
        if (!url) editor.chain().focus().unsetLink().run();
        else editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
      })}
      <label className="ae-tb__btn" title="插入图片">
        图片
        <input hidden type="file" accept="image/*,.svg" onChange={(e) => {
          const f = e.target.files?.[0]; e.target.value = '';
          if (!f || !onUploadImage) return;
          void onUploadImage(f).then((url) => {
            if (url) editor.chain().focus().setImage({ src: url, alt: f.name }).run();
          });
        }} />
      </label>
      {btn('小贴士', editor.isActive('callout'), () => editor.chain().focus().setCallout('tip').run())}
      {btn('注意', false, () => editor.chain().focus().setCallout('warn').run())}
      {btn('B站', false, () => {
        const bvid = window.prompt('B 站 bvid（如 BV1xx…）', 'BV');
        if (!bvid) return;
        const title = window.prompt('视频标题', '') || bvid;
        editor.chain().focus().setBilibili({ bvid, title }).run();
      })}
    </div>
  );
}

export function ArticleDocEditor({ content, onChange, onUploadImage, editable = true, placeholder }: ArticleDocEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
      Image.configure({ allowBase64: false, HTMLAttributes: { class: 'ae-img' } }),
      Placeholder.configure({ placeholder: placeholder || '开始写这一档的课文章节…' }),
      Callout,
      Bilibili,
    ],
    content: content || '',
    editable,
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
    editorProps: {
      attributes: { class: 'ae-doc ProseMirror', 'data-testid': 'article-doc-editor' },
    },
  });

  // 外部切换年龄档时同步 content
  useEffect(() => {
    if (!editor) return;
    const cur = editor.getHTML();
    if (content !== cur) {
      editor.commands.setContent(content || '', { emitUpdate: false });
    }
  }, [content, editor]);

  useEffect(() => {
    if (editor) editor.setEditable(editable);
  }, [editor, editable]);

  return (
    <div className="ae-shell" data-testid="article-wysiwyg">
      <Toolbar editor={editor} onUploadImage={onUploadImage} />
      <EditorContent editor={editor} />
    </div>
  );
}
