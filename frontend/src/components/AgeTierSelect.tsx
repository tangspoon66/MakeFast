import { AGE_TIERS, effectiveTier, useAgeTier, type AgeTier } from '../lesson/ageTier';

/** 年龄档切换（课程面板底部 / 我的进度页） */
export function AgeTierSelect({ compact = false }: { compact?: boolean }) {
  const tier = useAgeTier((s) => s.tier);
  const setTier = useAgeTier((s) => s.setTier);
  return (
    <label className="mf-tier-select" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: compact ? 12 : 14 }}>
      <span>{compact ? '说话方式' : '小铁猫说话方式'}</span>
      <select value={effectiveTier(tier)} onChange={(e) => setTier(e.target.value as AgeTier)} data-testid="age-tier-select" aria-label="选择年级，决定小铁猫的说话方式">
        {AGE_TIERS.map((t) => <option key={t.id} value={t.id}>{t.emoji} {t.label}（{t.hint}）</option>)}
      </select>
    </label>
  );
}
