import { Link } from 'react-router-dom';
import { Mascot } from '../components/lesson/Mascot';

/** 404：小铁猫带孩子回到能继续的地方，不留死路 */
export function NotFoundPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#C0E2F9] p-6" data-testid="not-found">
      <div className="text-center bg-white/80 rounded-3xl px-10 py-8 shadow-sm max-w-md">
        <div className="flex justify-center mb-2"><Mascot mood="thinking" decorative size={120} /></div>
        <h1 className="text-2xl font-bold text-slate-700 mb-2">咦，这里什么都没有</h1>
        <p className="text-slate-600 mb-6">小铁猫找遍了也没找到这个页面。可能是链接写错了，我们回到能继续学习的地方吧。</p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link to="/home" className="rounded-full bg-[#74B0E1] text-white px-5 py-2 font-semibold">回学习主页</Link>
          <Link to="/courses" className="rounded-full border border-[#74B0E1] text-[#2F6FA3] px-5 py-2 font-semibold">看看课程</Link>
        </div>
      </div>
    </main>
  );
}
