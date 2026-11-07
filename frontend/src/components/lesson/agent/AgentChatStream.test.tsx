import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AgentChatPanel } from './AgentChatPanel';

const ctx = { course_id: 'course-temp-buzzer', course_title: 't', step: { id: 'wire-dht', title: '接上温湿度传感器', do: 'd', why: 'w', success: 's' }, faq: [] };

function sse(events: unknown[]) {
  const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
  const enc = new TextEncoder().encode(body);
  return new Response(new ReadableStream({ start(c) { c.enqueue(enc.slice(0, 20)); c.enqueue(enc.slice(20)); c.close(); } }), { headers: { 'content-type': 'text/event-stream' } });
}

afterEach(() => vi.unstubAllGlobals());

describe('聊天流式 + 思路', () => {
  it('边收边显示，最后以 done 为准，并能展开「小铁猫是怎么想的」', async () => {
    const fetchMock = vi.fn(async () => sse([
      { type: 'meta', source: 'llm' }, { type: 'delta', text: 'DATA 线' }, { type: 'delta', text: '接在 D0。' },
      { type: 'done', data: { reply: 'DATA 线接在 D0。', source: 'llm', category: 'on_topic', actions: [{ anchor: 'pin.D0', label: '引脚 D0' }], fixes: [], trace: ['👀 看了：你正在做「接上温湿度传感器」这一步', '💬 回答来源：AI（DeepSeek）'] } },
    ]));
    vi.stubGlobal('fetch', fetchMock);
    render(<AgentChatPanel context={ctx as never} suggestions={[]} opener="你好" onClose={() => {}} onHint={() => ''} />);
    fireEvent.change(screen.getByLabelText('输入问题'), { target: { value: 'DATA 接哪？' } });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));
    await waitFor(() => expect(screen.getByTestId('chat-trace')).toBeTruthy());
    expect(String(fetchMock.mock.calls[0][0])).toContain('/chat/stream');
    expect(screen.getAllByTestId('chat-msg-assistant').at(-1)!.textContent).toContain('DATA 线接在 D0。');
    expect(screen.getByTestId('chat-trace').textContent).toContain('DeepSeek');
    expect(screen.getByText('AI 回答')).toBeTruthy();
  });
});
