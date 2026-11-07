/**
 * MakeFast 吉祥物「小铁猫」——直接使用用户概念图 docs/agent/mascot-concept.png 的原始像素：
 * 概念图按状态切成 9 帧（rembg isnet 抠图，透明背景，未重绘），见 public/agent/mascot/。
 * 动画只用 CSS 变换（浮动/弹跳/抖动/发光层）+ 状态之间交叉淡入，不改动画面像素。
 */
import { useEffect, useRef, useState } from 'react';
import '../../styles/mascot.css';

export type MascotMood =
  | 'idle' | 'guiding' | 'explaining' | 'thinking' | 'processing' | 'success' | 'warning' | 'listening';


const MOOD_LABEL: Record<MascotMood, string> = {
  idle: '待机', guiding: '指引', explaining: '讲解', thinking: '思考中',
  processing: '处理中', success: '成功', warning: '提醒', listening: '聆听',
};

/** 状态 → 概念图帧（见 _bmad-new/agent-behavior-R10.md §14） */
const MOOD_FRAME: Record<MascotMood | 'walk', string> = {
  idle: '/agent/mascot/idle.webp',
  walk: '/agent/mascot/walk.webp',
  guiding: '/agent/mascot/guiding.webp',
  explaining: '/agent/mascot/explaining.webp',
  thinking: '/agent/mascot/thinking.webp',
  processing: '/agent/mascot/processing.webp',
  success: '/agent/mascot/success.webp',
  warning: '/agent/mascot/warning.webp',
  listening: '/agent/mascot/listening.webp',
};

/** 有「闭眼」覆盖层的帧（scripts/make_blink_overlays.py 从原图像素生成；其余帧眼睛形状特殊，不眨眼） */
const BLINK_FRAMES = new Set(['idle', 'listening', 'thinking']);

interface MascotProps {
  mood: MascotMood;
  onClick?: () => void;
  label?: string;
  size?: number;
  /** 仅展示（不可点击），用于 Welcome/目录的插画位 */
  decorative?: boolean;
  /** 移动中（从召唤按钮走到锚点）时显示行走帧 */
  walking?: boolean;
  /** 对话气泡（短句，2 行内） */
  bubble?: string | null;
}

function Frames({ mood, walking, size }: { mood: MascotMood; walking?: boolean; size: number }) {
  const key = walking ? 'walk' : mood;
  const [prev, setPrev] = useState<string | null>(null);
  const cur = useRef(key);
  useEffect(() => {
    if (cur.current === key) return;
    setPrev(cur.current);
    cur.current = key;
    const t = setTimeout(() => setPrev(null), 260);
    return () => clearTimeout(t);
  }, [key]);
  return (
    <span className="mfm-stage" style={{ width: size, height: size }}>
      <span className="mfm-shadow" aria-hidden="true" />
      <span className="mfm-glow" aria-hidden="true" />
      <span className="mfm-motion">
        {prev && <img key={`p-${prev}`} src={MOOD_FRAME[prev as MascotMood]} alt="" className="mfm-frame mfm-frame--out" draggable={false} />}
        <img key={key} src={MOOD_FRAME[key]} alt="" className="mfm-frame mfm-frame--in" draggable={false} data-frame={key} />
        {BLINK_FRAMES.has(key) && !prev && <img key={`b-${key}`} src={`/agent/mascot/blink/${key}.webp`} alt="" className="mfm-frame mfm-blink" draggable={false} data-testid="mascot-blink" />}
      </span>
    </span>
  );
}

export function Mascot({ mood, onClick, label, size = 96, decorative, walking, bubble }: MascotProps) {
  const inner = <>{bubble && <span key={bubble} className="mfm-bubble" role="status" data-testid="mascot-bubble">{bubble}</span>}<Frames mood={mood} walking={walking} size={size} /></>;
  if (decorative) {
    return <span className={`mf-mascot mf-mascot--${mood}`} data-mood={mood} data-testid="mascot" aria-hidden="true">{inner}</span>;
  }
  return (
    <button type="button" className={`mf-mascot mf-mascot--${mood}`} onClick={onClick}
      aria-label={label || `小铁猫（${MOOD_LABEL[mood]}）`} data-mood={mood} data-testid="mascot">
      {inner}
      <span className="mf-mascot__sr" aria-live="polite">{MOOD_LABEL[mood]}</span>
    </button>
  );
}
