/**
 * 中区：积木 | 代码 两个标签。代码是真源；积木视图由代码转换而来，
 * 转换不安全时只提示、不覆盖代码（避免丢失学生的程序）。
 * 标签状态放在 useWorkbenchUi，Agent 导航可以切换标签、揭示代码行、高亮积木。
 */
import { lazy, Suspense, useMemo, useState } from 'react';
import { CodeEditor } from '../CodeEditor';
import { parseCodeToXml } from '../../blockly/codeToBlocksParser';
import { FIRST_LESSON_BLOCKS_XML, isFirstLessonProgram } from '../../blockly/lessonBlocksXml';
import { LoadingSpinner } from '../LoadingSpinner';
import { useWorkbenchUi } from '../../lesson/agent/workbenchUi';
import { useAgentAnchor } from '../../lesson/agent/anchors';

const BlocklyEditor = lazy(() => import('../BlocklyEditor').then((m) => ({ default: m.BlocklyEditor })));

interface EditorPaneProps {
  code: string;
  onCodeChange: (code: string) => void;
  highlighted?: boolean;
}

export function EditorPane({ code, onCodeChange, highlighted }: EditorPaneProps) {
  const tab = useWorkbenchUi((s) => s.editorTab);
  const setTab = useWorkbenchUi((s) => s.setEditorTab);
  const decorations = useWorkbenchUi((s) => s.decorations);
  const reveal = useWorkbenchUi((s) => s.reveal);
  // 只在切到积木时按当时的代码转换一次，避免积木回写引起循环
  const [blocksSource, setBlocksSource] = useState<string | null>(null);
  // 切到积木页时记下当时的代码作为积木来源；切回代码页清掉（渲染期按 tab 变化调整，不用 effect）
  const [seenTab, setSeenTab] = useState(tab);
  if (seenTab !== tab) {
    setSeenTab(tab);
    setBlocksSource(tab === 'blocks' ? code : null);
  }
  const conversion = useMemo(() => (blocksSource === null ? null
    : isFirstLessonProgram(blocksSource) ? { success: true, xml: FIRST_LESSON_BLOCKS_XML, warnings: [] as string[] }
    : parseCodeToXml(blocksSource)), [blocksSource]);

  const openBlocks = () => { setBlocksSource(code); setTab('blocks'); };
  const panelRef = useAgentAnchor<HTMLElement>('editor', { label: '程序编辑区', kind: 'panel', region: 'editor' });
  const blocksTabRef = useAgentAnchor<HTMLButtonElement>('editor.tab.blocks', { label: '「积木」标签', kind: 'tab', region: 'editor' });
  const codeTabRef = useAgentAnchor<HTMLButtonElement>('editor.tab.code', { label: '「代码」标签', kind: 'tab', region: 'editor' });

  return (
    <section ref={panelRef} className={`lw-panel lw-editor ${highlighted ? 'lw-highlight' : ''}`} data-lw-anchor="editor" aria-label="程序编辑区" data-editor-tab={tab}>
      <div className="lw-tabs" role="tablist">
        <button ref={blocksTabRef} type="button" role="tab" className="lw-tab" aria-selected={tab === 'blocks'} onClick={openBlocks} data-testid="tab-blocks">🧩 积木</button>
        <button ref={codeTabRef} type="button" role="tab" className="lw-tab" aria-selected={tab === 'code'} onClick={() => setTab('code')} data-testid="tab-code">⌨️ 代码</button>
        <span className="lw-tabs__spacer" />
      </div>
      <div className="lw-editor__body">
        {tab === 'code' && (
          <CodeEditor value={code} onChange={onCodeChange} maxLength={50000} decorations={decorations} reveal={reveal} lineAnchorPrefix="code.line." />
        )}
        {tab === 'blocks' && conversion && (conversion.success && conversion.xml ? (
          <Suspense fallback={<div className="lw-empty"><LoadingSpinner message="正在打开积木..." size="md" /></div>}>
            <BlocklyEditor initialXml={conversion.xml} onCodeChange={onCodeChange} />
          </Suspense>
        ) : (
          <div className="lw-empty" data-testid="blocks-fallback">
            <span style={{ fontSize: 36 }}>🧩</span>
            <strong>这段程序里有积木还不认识的写法</strong>
            <span>为了不弄丢你的程序，先在「代码」里查看和修改，编译、烧录都不受影响。</span>
            {conversion.warnings.length > 0 && (
              <small style={{ maxWidth: 420 }}>{conversion.warnings.slice(0, 2).join('；')}</small>
            )}
            <button type="button" className="lw-btn lw-btn--sm" onClick={() => setTab('code')}>回到代码</button>
          </div>
        ))}
      </div>
    </section>
  );
}
