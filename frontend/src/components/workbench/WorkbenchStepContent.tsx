/** 旧版账号项目工作台的步骤内容（从 HomePage 拆出）。 */
import { useState } from 'react';
import { Check, Sparkles, TerminalSquare } from 'lucide-react';
import type { CourseComponent, CourseConnection, CourseMedia, CourseStep } from '../../api/learningCourseClient';
import type { MonitorState } from '../SerialToolbar';
import { WiringGraphViewer } from './WiringGraphViewer';

export function WorkbenchStepContent({
  step,
  materials,
  materialsConfirmed,
  onToggleMaterial,
  finishedMedia,
  selectedBoard,
  detectedChipType,
  monitorState,
  wiringComponents,
  wiringConnections,
  onQuizPassed,
  onChallengeCompleted,
  onCourseCompleted,
}: {
  step: CourseStep;
  materials: CourseComponent[];
  materialsConfirmed: string[];
  onToggleMaterial: (id: string) => void;
  finishedMedia: CourseMedia;
  selectedBoard?: string;
  detectedChipType?: string | null;
  monitorState: MonitorState;
  wiringComponents: CourseComponent[];
  wiringConnections: CourseConnection[];
  onQuizPassed?: (answerId: string) => void;
  onChallengeCompleted?: () => void;
  onCourseCompleted?: () => void;
}) {
  const [selectedQuizAnswer, setSelectedQuizAnswer] = useState<string | null>(null);
  if (step.type === 'intro') {
    return (
      <div className="step-content step-content--hero">
        <div className="step-content__eyebrow">体验项目 · 温湿度提醒器</div>
        <h2>让设备感知环境，并在需要时提醒你</h2>
        <p>{step.body}</p>
        <div className="course-media course-media--finished">
          {finishedMedia.verification_status === 'verified' && finishedMedia.url
            ? <img src={finishedMedia.url} alt={finishedMedia.alt || '课程最终作品'} />
            : <div className="course-media__missing">成品效果图待核验</div>}
        </div>
        <div className="step-outcome-grid">
          <div><strong>最终产出</strong><span>一块可运行的 ESP32 温湿度提醒器</span></div>
          <div><strong>你会学会</strong><span>接线、积木逻辑、编译烧录与串口调试</span></div>
          <div><strong>预计时间</strong><span>20–30 分钟，过程中随时可以提问</span></div>
        </div>
        <div className="step-callout"><Sparkles size={17} /> 先不用记住所有知识，跟着每一步把作品做出来。</div>
      </div>
    );
  }

  if (step.type === 'materials') {
    return (
      <div className="step-content">
        <div className="step-content__eyebrow">第 2 步 · 准备材料</div>
        <h2>先把桌面上的材料找齐</h2>
        <div className="material-list">
          {materials.map((material) => {
            const confirmed = materialsConfirmed.includes(material.id);
            return <button
              type="button"
              role="checkbox"
              aria-checked={confirmed}
              aria-label={`${material.name}：${confirmed ? '已准备好' : '还没准备好'}`}
              className={`material-item ${confirmed ? 'material-item--confirmed' : ''}`}
              key={material.id}
              onClick={() => onToggleMaterial(material.id)}
            >
              <span className="material-item__image">{material.media.verification_status === 'verified' && material.media.url
                ? <img src={material.media.url} alt={material.media.alt || material.name} />
                : <span>型号图片待核验</span>}</span>
              <span className="material-item__body"><strong>{material.name}</strong><span>{material.purpose}</span><small>数量：{material.quantity}{material.exact_variant ? ` · ${material.exact_variant}` : ' · 型号待核验'}</small></span>
              <span className="material-item__check" aria-hidden="true">{confirmed && <Check size={17} />}</span>
            </button>;
          })}
        </div>
        <div className="step-callout step-callout--muted">点击材料表示“我已经准备好了”，不是系统检测到实物。你可以再次点击取消。</div>
      </div>
    );
  }

  if (step.type === 'wiring') {
    return (
      <div className="step-content">
        <div className="step-content__eyebrow">第 3 步 · 传感器接线</div>
        <h2>按照真实引脚连接材料</h2>
        <p>图中的位置来自课程 pinmap。当前传感器和蜂鸣器型号仍待核验，页面会明确标出来，核验完成前不要把它当作最终接线依据。</p>
        <WiringGraphViewer components={wiringComponents} connections={wiringConnections} connectionIds={step.connection_ids} />
      </div>
    );
  }

  if (step.type === 'verify') {
    return (
      <div className="step-content">
        <div className="step-content__eyebrow">第 6 步 · 验证设备输出</div>
        <h2>看代码，也看设备的真实反应</h2>
        <p>{step.expected_observation || step.body}</p>
        <div className="verify-card">
          <div><span>开发板</span><strong>{detectedChipType || selectedBoard || '等待识别'}</strong></div>
          <div><span>串口</span><strong>{monitorState.isOpen ? '已打开' : '未打开'}</strong></div>
          <div><span>实时数据</span><strong>{monitorState.lines.length ? `${monitorState.lines.length} 条` : '等待数据'}</strong></div>
        </div>
        <div className="step-callout"><TerminalSquare size={17} /> 右侧调试面板可以收起；调试时建议保持展开，方便对照观察。</div>
      </div>
    );
  }

  if (step.type === 'challenge') {
    return (
      <div className="step-content">
        <div className="step-content__eyebrow">第 7 步 · 改造挑战</div>
        <h2>把“能运行”改成“像你自己的作品”</h2>
        <p>{step.challenge?.task || step.body}</p>
        <div className="challenge-card"><span>成功时你会看到</span><strong>{step.challenge?.success_observation || '观察串口和实物是否按新的条件反应'}</strong></div>
        <button type="button" className="primary-step-button" onClick={onChallengeCompleted}>我已看到改动效果，记录挑战</button>
      </div>
    );
  }

  if (step.type === 'quiz' && step.quiz) {
    const answered = selectedQuizAnswer !== null;
    const correct = selectedQuizAnswer === step.quiz.answer_id;
    return <div className="step-content">
      <div className="step-content__eyebrow">知识检查</div>
      <h2>{step.quiz.question}</h2>
      <div className="course-quiz-options" role="group" aria-label="请选择答案">
        {step.quiz.options.map((option) => <button
          key={option.id}
          type="button"
          className={`course-quiz-option ${selectedQuizAnswer === option.id ? 'course-quiz-option--selected' : ''}`}
          aria-pressed={selectedQuizAnswer === option.id}
          onClick={() => { setSelectedQuizAnswer(option.id); if (option.id === step.quiz?.answer_id) onQuizPassed?.(option.id); }}
        >{option.text}</button>)}
      </div>
      {answered && <div className={`course-quiz-feedback ${correct ? 'course-quiz-feedback--correct' : ''}`} role="status">
        <strong>{correct ? '答对了' : '再想一想'}</strong>
        <span>{step.quiz.explanation}</span>
      </div>}
      <p className="course-quiz-note">本题只帮助你理解知识；正式答题进度和积分会在后续功能中记录。</p>
    </div>;
  }

  if (step.type === 'compile' || step.type === 'flash' || step.type === 'completion') {
    return <div className="step-content"><div className="step-content__eyebrow">课程步骤</div><h2>{step.title}</h2><p>{step.body}</p>{step.type === 'completion' && <button type="button" className="primary-step-button" onClick={onCourseCompleted}>我已经完成课程</button>}</div>;
  }

  return null;
}
