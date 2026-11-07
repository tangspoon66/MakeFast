import { Node, mergeAttributes } from '@tiptap/core';

export type CalloutTone = 'tip' | 'warn' | 'info';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (tone?: CalloutTone) => ReturnType;
    };
  }
}

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      tone: { default: 'tip', parseHTML: (el) => el.getAttribute('data-callout') || 'tip',
        renderHTML: (attrs) => ({ 'data-callout': attrs.tone }) },
    };
  },
  parseHTML() {
    return [{ tag: 'aside[data-callout]' }, { tag: 'aside.ca-callout' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const tone = (node.attrs.tone as CalloutTone) || 'tip';
    const tag = tone === 'warn' ? '注意' : tone === 'info' ? '提示' : '小贴士';
    return ['aside', mergeAttributes(HTMLAttributes, { class: `ca-callout ca-callout--${tone}`, 'data-callout': tone }),
      ['span', { class: 'ca-callout__tag' }, tag],
      ['div', { class: 'ca-callout__body' }, 0],
    ];
  },
  addCommands() {
    return {
      setCallout: (tone: CalloutTone = 'tip') => ({ commands }) =>
        commands.insertContent({ type: this.name, attrs: { tone }, content: [{ type: 'paragraph' }] }),
    };
  },
});
