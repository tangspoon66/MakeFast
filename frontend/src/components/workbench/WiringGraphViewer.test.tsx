import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WiringGraphViewer } from './WiringGraphViewer';

const components = [{
  id: 'board', name: '测试开发板', kind: 'board' as const, exact_variant: null,
  quantity: 1, purpose: '', compatibility_note: '',
  media: { asset_id: 'board', url: '/board.png', source: 'fixture', license: 'fixture', exact_variant: 'fixture', alt: 'fixture', verification_status: 'verified' as const, is_real_photo: true, visual_kind: 'photo' as const, variant_check: null },
  pins: [{ id: 'pwr', label: '电源脚（VCC）', kind: 'power' as const, x: 0.1, y: 0.2 }],
  pinmap_status: 'verified' as const,
}, {
  id: 'sensor', name: '测试传感器', kind: 'sensor' as const, exact_variant: null,
  quantity: 1, purpose: '', compatibility_note: '',
  media: { asset_id: 'sensor', url: '/sensor.png', source: 'fixture', license: 'fixture', exact_variant: 'fixture', alt: 'fixture', verification_status: 'verified' as const, is_real_photo: true, visual_kind: 'photo' as const, variant_check: null },
  pins: [{ id: 'vcc', label: '电源脚（VCC）', kind: 'power' as const, x: 0.1, y: 0.2 }],
  pinmap_status: 'verified' as const,
}];

describe('WiringGraphViewer', () => {
  it('does not display a wire instruction from unverified graph data', () => {
    render(<WiringGraphViewer components={components.map((item) => ({ ...item, pinmap_status: 'pending' as const }))} connections={[]} />);
    expect(screen.getByText(/核验后.*逐根接线清单/)).toBeInTheDocument();
    expect(document.querySelectorAll('.wiring-graph__wire')).toHaveLength(0);
    expect(screen.queryByTestId('wiring-pin-board-pwr')).not.toBeInTheDocument();
  });

  it('draws and lists connections from the same verified graph record', () => {
    render(<WiringGraphViewer components={components} connections={[{
      id: 'power', from_pin: { component_id: 'board', pin_id: 'pwr' },
      to_pin: { component_id: 'sensor', pin_id: 'vcc' }, kind: 'power', direction: 'static',
      label: '电源脚（VCC）', verified: true, verification_evidence: 'fixture',
    }]} />);
    expect(document.querySelectorAll('.wiring-graph__wire')).toHaveLength(1);
    expect(screen.getByText('测试开发板 - 电源脚（VCC）')).toBeInTheDocument();
    expect(screen.getByText('测试传感器 - 电源脚（VCC）')).toBeInTheDocument();
    expect(screen.queryByText('待实物核验')).not.toBeInTheDocument();
  });
});
