import type { CourseComponent, CourseConnection } from '../../api/learningCourseClient';

interface WiringGraphViewerProps {
  components: CourseComponent[];
  connections: CourseConnection[];
  connectionIds?: string[];
}

const placements = {
  board: { left: 5, top: 24 },
  sensor: { left: 67, top: 8 },
  actuator: { left: 67, top: 57 },
  accessory: { left: 36, top: 61 },
} as const;

function pointFor(component: CourseComponent, pinId: string) {
  const pin = component.pins?.find((item) => item.id === pinId);
  if (!pin || pin.x == null || pin.y == null) return null;
  const placement = placements[component.kind];
  return { x: placement.left + 25 + pin.x * 17, y: placement.top + 7 + pin.y * 33, pin };
}

export function WiringGraphViewer({ components, connections, connectionIds }: WiringGraphViewerProps) {
  const visibleConnections = connectionIds?.length
    ? connections.filter((connection) => connectionIds.includes(connection.id))
    : connections;
  const componentById = new Map(components.map((component) => [component.id, component]));
  const drawable = visibleConnections.flatMap((connection) => {
    const fromComponent = componentById.get(connection.from_pin.component_id);
    const toComponent = componentById.get(connection.to_pin.component_id);
    if (!fromComponent || !toComponent || !connection.verified
      || fromComponent.pinmap_status !== 'verified' || toComponent.pinmap_status !== 'verified'
      || fromComponent.media.verification_status !== 'verified' || toComponent.media.verification_status !== 'verified') return [];
    const from = pointFor(fromComponent, connection.from_pin.pin_id);
    const to = pointFor(toComponent, connection.to_pin.pin_id);
    if (!from || !to) return [];
    return [{ connection, from, to }];
  });

  return (
    <section className="wiring-graph" aria-label="结构化硬件接线图">
      <div className="wiring-graph__canvas" data-testid="wiring-graph-canvas">
        <svg className="wiring-graph__wires" viewBox="0 0 1000 570" preserveAspectRatio="none" aria-hidden="true">
          {drawable.map(({ connection, from, to }) => (
            <g key={connection.id} className={connection.verified ? 'wiring-graph__wire' : 'wiring-graph__wire wiring-graph__wire--pending'}>
              <path d={`M ${from.x * 10} ${from.y * 5.7} C ${from.x * 10 + 100} ${from.y * 5.7}, ${to.x * 10 - 100} ${to.y * 5.7}, ${to.x * 10} ${to.y * 5.7}`} />
            </g>
          ))}
        </svg>
        {components.map((component) => {
          const placement = placements[component.kind];
          return (
            <article
              className={`wiring-part wiring-part--${component.kind}`}
              key={component.id}
              style={{ left: `${placement.left}%`, top: `${placement.top}%` }}
              data-testid={`wiring-part-${component.id}`}
            >
              <div className="wiring-part__image">
                {component.media.verification_status === 'verified' && component.media.url
                  ? <img src={component.media.url} alt={component.media.alt || component.name} />
                  : <span>准确型号图片待核验</span>}
                {(component.pinmap_status === 'verified' && component.media.verification_status === 'verified' ? component.pins || [] : []).map((pin) => (
                  <span
                    key={pin.id}
                    className={`wiring-part__pin wiring-part__pin--${pin.kind}`}
                    style={pin.x != null && pin.y != null ? { left: `${pin.x * 100}%`, top: `${pin.y * 100}%` } : undefined}
                    title={pin.label}
                    data-testid={`wiring-pin-${component.id}-${pin.id}`}
                  />
                ))}
              </div>
              <strong>{component.name}</strong>
              <small>{component.pinmap_status === 'verified' ? '引脚已核验' : '引脚位置待核验'}</small>
            </article>
          );
        })}
      </div>
      <ol className="wiring-graph__list" aria-label="接线清单">
        {visibleConnections.length === 0 && <li>准确型号及引脚资料核验后，课程会在这里显示逐根接线清单。</li>}
        {visibleConnections.map((connection) => {
          const fromComponent = componentById.get(connection.from_pin.component_id);
          const toComponent = componentById.get(connection.to_pin.component_id);
          const fromPin = fromComponent?.pins?.find((pin) => pin.id === connection.from_pin.pin_id);
          const toPin = toComponent?.pins?.find((pin) => pin.id === connection.to_pin.pin_id);
          return (
            <li key={connection.id} data-verified={connection.verified}>
              <span>{fromComponent?.name} - {fromPin?.label}</span>
              <span aria-hidden="true">→</span>
              <span>{toComponent?.name} - {toPin?.label}</span>
              {!connection.verified && <small>待实物核验</small>}
            </li>
          );
        })}
      </ol>
      {visibleConnections.some((connection) => connection.verified) && <p className="wiring-graph__note">杜邦线颜色没有要求，确认两端接到正确的引脚即可。</p>}
    </section>
  );
}
