import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State { error: Error | null }

/** 工作台局部出错时给出友好提示，不白屏；学生程序保存在本地，不会丢。 */
export class LessonErrorBoundary extends Component<{ children: ReactNode; label: string }, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error(`[${this.props.label}]`, error, info.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="lw-panel" role="alert" style={{ flex: 1 }}>
        <div className="lw-empty">
          <span style={{ fontSize: 36 }}>🧯</span>
          <strong>{this.props.label}出了点小问题</strong>
          <span>你的程序已经保存在这台电脑上，不会丢。</span>
          <button type="button" className="lw-btn lw-btn--sm lw-btn--blue" onClick={() => this.setState({ error: null })}>再试一次</button>
        </div>
      </div>
    );
  }
}
