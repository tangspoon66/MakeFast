import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    bilibili: {
      setBilibili: (attrs: { bvid: string; title?: string }) => ReturnType;
    };
  }
}

export const Bilibili = Node.create({
  name: 'bilibili',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      bvid: { default: '', parseHTML: (el) => el.getAttribute('data-bilibili') || '' },
      title: { default: '', parseHTML: (el) => el.getAttribute('data-title') || '' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-bilibili]' }, { tag: 'div.ca-bilibili' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const bvid = node.attrs.bvid || '';
    const title = node.attrs.title || bvid;
    return ['div', mergeAttributes(HTMLAttributes, {
      class: 'ca-bilibili', 'data-bilibili': bvid, 'data-title': title,
    }), ['div', { class: 'ca-bilibili__ph' },
      ['strong', {}, 'B 站视频位'],
      ['span', {}, title],
      ['code', {}, `bvid=${bvid}`],
    ]];
  },
  addCommands() {
    return {
      setBilibili: (attrs) => ({ commands }) =>
        commands.insertContent({ type: this.name, attrs }),
    };
  },
});
