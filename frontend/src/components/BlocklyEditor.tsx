/**
 * Blockly 编辑器组件
 * 提供图形化编程界面
 */

import React, { useEffect, useRef } from 'react';
import * as Blockly from 'blockly';
import { defineArduinoBlocks } from '../blockly/arduinoBlocks';
import { generateArduinoCode, arduinoGenerator } from '../blockly/arduinoGenerator';
import { toolboxConfig } from '../blockly/toolbox';
import { defineLessonBlocks } from '../blockly/lessonBlocks';
import { useEditorStore } from '../store/editorStore';
import { setActiveWorkspace } from '../blockly/workspaceBridge';

// 导入 Blockly 的 CSS
import 'blockly/blocks';

/** 默认空积木 XML */
const DEFAULT_LED_BLINK_XML = `
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_setup" x="20" y="20">
  </block>
  <block type="arduino_loop" x="20" y="100">
  </block>
</xml>`;

interface BlocklyEditorProps {
  /** 外部传入的初始 XML。传入时覆盖默认 LED blink 示例。undefined 或空字符串使用默认示例 */
  initialXml?: string;
  onCodeChange?: (code: string) => void;
}

export const BlocklyEditor: React.FC<BlocklyEditorProps> = ({ initialXml, onCodeChange }) => {
  const blocklyDivRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const { setCode, setBlocksXml } = useEditorStore();
  const isInitializedRef = useRef(false);
  const cleanupFnsRef = useRef<Array<() => void>>([]);
  // 使用 ref 存储 setCode 避免 useEffect 依赖变化
  const setCodeRef = useRef(setCode);
  setCodeRef.current = setCode;
  const setBlocksXmlRef = useRef(setBlocksXml);
  setBlocksXmlRef.current = setBlocksXml;
  const onCodeChangeRef = useRef(onCodeChange);
  onCodeChangeRef.current = onCodeChange;

  useEffect(() => {
    if (!blocklyDivRef.current || isInitializedRef.current) return;

    const initBlockly = async () => {
      // 定义 Arduino 积木块
      defineArduinoBlocks();
      defineLessonBlocks();

      // 加载自定义积木
      let mergedToolbox = toolboxConfig;
      try {
        const resp = await fetch('/api/blocks/custom');
        const data = await resp.json();
        const customBlocks = data.blocks || [];

        if (customBlocks.length > 0) {
          // 注册自定义块定义
          const blockDefs = customBlocks.map((b: any) => ({
            ...b.json_definition,
            type: b.name,
          }));
          Blockly.defineBlocksWithJsonArray(blockDefs);

          // 注册自定义生成器
          for (const b of customBlocks) {
            try {
              arduinoGenerator.forBlock[b.name] = new Function('block', 'generator', b.generator_code) as any;
            } catch (e) {
              console.error(`Failed to register generator for block: ${b.name}`, e);
            }
          }

          // 合并工具箱：将自定义块插入对应分类
          mergedToolbox = JSON.parse(JSON.stringify(toolboxConfig)) as typeof toolboxConfig;
          for (const b of customBlocks) {
            const category = mergedToolbox.contents.find(
              (c: any) => c.kind === 'category' && c.name === b.category
            ) as any;
            if (category?.contents) {
              category.contents.push({ kind: 'block', type: b.name });
            }
          }
        }
      } catch (e) {
        console.error('Failed to load custom blocks:', e);
      }

      // 初始化 Blockly 工作区
      const container = blocklyDivRef.current!;
      workspaceRef.current = Blockly.inject(container, {
        toolbox: mergedToolbox,
      grid: {
        spacing: 20,
        length: 3,
        colour: '#ccc',
        snap: true
      },
      zoom: {
        controls: true,
        wheel: true,
        startScale: 1.0,
        maxScale: 3,
        minScale: 0.3,
        scaleSpeed: 1.2
      },
      trashcan: true,
      move: {
        scrollbars: {
          horizontal: true,
          vertical: true
        },
        drag: true,
        wheel: true
      }
    });

    // 选择要加载的 XML：优先使用外部传入，否则使用默认 LED blink
    const xmlToLoad = initialXml && initialXml.trim()
      ? initialXml
      : DEFAULT_LED_BLINK_XML;

    try {
      const xml = Blockly.utils.xml.textToDom(xmlToLoad);
      Blockly.Xml.domToWorkspace(xml, workspaceRef.current);
    } catch (error) {
      console.error('加载积木 XML 失败:', error);
      // 回退到默认示例
      if (initialXml) {
        try {
          const fallbackXml = Blockly.utils.xml.textToDom(DEFAULT_LED_BLINK_XML);
          Blockly.Xml.domToWorkspace(fallbackXml, workspaceRef.current);
        } catch {
          // 静默失败
        }
      }
    }

    setActiveWorkspace(workspaceRef.current);

    // 监听积木变化，生成代码
    const updateCode = () => {
      if (workspaceRef.current) {
        const code = generateArduinoCode(workspaceRef.current);
        setCodeRef.current(code);
        onCodeChangeRef.current?.(code);
      }
    };

    const saveWorkspace = () => {
      if (!workspaceRef.current) return;
      setBlocksXmlRef.current(Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(workspaceRef.current)));
    };

    const syncFlyoutScrollbar = () => {
      const workspace = workspaceRef.current;
      if (!workspace) return;

      const run = () => {
        const flyout = workspace.getFlyout(false);
        const flyoutWorkspace = flyout?.getWorkspace();
        const flyoutBlocks = flyoutWorkspace?.getAllBlocks(false) ?? [];
        const flyoutGroup = container.querySelector<SVGGElement>('.blocklyFlyout');
        const flyoutBox = flyoutGroup?.getBBox?.();
        const flyoutHasBlocks = flyoutBlocks.length > 0;
        const flyoutVisible = !!flyoutGroup && flyoutGroup.style.display !== 'none' && (flyoutBox?.width ?? 0) > 2;
        const shouldShowScrollbar = flyoutHasBlocks && flyoutVisible;
        const flyoutScrollbars = container.querySelectorAll<SVGGElement>(
          '.blocklyFlyoutScrollbar, .blocklyFlyout .blocklyScrollbarVertical, .blocklyFlyout .blocklyScrollbarHorizontal'
        );

        for (const scrollbar of flyoutScrollbars) {
          scrollbar.style.display = shouldShowScrollbar ? '' : 'none';
          scrollbar.style.visibility = shouldShowScrollbar ? '' : 'hidden';
          scrollbar.style.pointerEvents = shouldShowScrollbar ? '' : 'none';
        }

        if (shouldShowScrollbar) {
          Blockly.svgResize(workspace);
          flyout?.reflow();
        }
      };

      window.requestAnimationFrame(run);
      window.setTimeout(run, 80);
      window.setTimeout(run, 180);
    };

    // 初始生成一次代码
    updateCode();
    saveWorkspace();

    // 监听工作区变化
    workspaceRef.current.addChangeListener((event: Blockly.Events.Abstract) => {
      updateCode();
      if (!event.isUiEvent) saveWorkspace();
      if (event.type === Blockly.Events.TOOLBOX_ITEM_SELECT || event.type === Blockly.Events.CLICK || event.type === Blockly.Events.VIEWPORT_CHANGE) {
        syncFlyoutScrollbar();
      }
    });

    container.addEventListener('pointerup', syncFlyoutScrollbar);
    container.addEventListener('pointerleave', syncFlyoutScrollbar);
    cleanupFnsRef.current.push(() => {
      container.removeEventListener('pointerup', syncFlyoutScrollbar);
      container.removeEventListener('pointerleave', syncFlyoutScrollbar);
    });
    syncFlyoutScrollbar();

    // 标记已初始化
    isInitializedRef.current = true;
  };

  initBlockly();

    // 清理函数
    return () => {
      cleanupFnsRef.current.forEach((cleanup) => cleanup());
      cleanupFnsRef.current = [];
      if (workspaceRef.current) {
        setActiveWorkspace(null);
        workspaceRef.current.dispose();
        workspaceRef.current = null;
      }
      document.querySelectorAll('.blocklyFlyoutScrollbar, .blocklyWidgetDiv, .blocklyDropDownDiv, .blocklyTooltipDiv').forEach((node) => node.remove());
      isInitializedRef.current = false;
    };
  }, [initialXml]);

  return (
    <div className="blockly-editor-container h-full w-full">
      <div
        ref={blocklyDivRef}
        className="blockly-workspace"
        style={{
          height: '100%',
          width: '100%',
          minHeight: '600px'
        }}
      />
    </div>
  );
};
