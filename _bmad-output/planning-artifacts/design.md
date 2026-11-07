# Design Artifact Index

The detailed visual and interaction design is maintained in [UX Design Specification](ux-design-specification.md). This file exists as a short BMAD-facing index so design review has one stable entry point.

## Approved direction

- Project-first home, not editor-first home.
- Desktop three-zone workbench: course route / current step / device debug.
- Current step owns the center panel; debug is a persistent but collapsible tool area.
- Agent is a pixel electronic robot IP that moves to semantic targets and opens a short contextual bubble.
- Static role-state assets and UI-rendered text are the MVP; full animation is deferred.
- Visual direction is bright child-friendly technology: `#74B0E1` sky blue, `#F4C65C` warm yellow, `#C0E2F9` pale blue, deep navy text and white space.
- Home/course surfaces may be playful; workbench, code and serial surfaces remain calm and highly legible.

## Review checklist

- [x] UX information architecture, project-first home and three-zone workbench are specified.
- [x] Workbench step-to-panel map, Agent IP behavior, guided/自主引导差异 and wiring interaction are specified.
- [x] UI copy rules distinguish platform fact, user confirmation and Agent inference.
- [x] Child-friendly language direction and safety boundaries are specified; final copy review remains a content-quality task.
- [x] Initial visual direction and color roles approved from the provided reference.

## Post-design validation gates

The UX planning stage is signed off. The following items are validation or implementation gates, not reasons to reopen the UX direction unless testing reveals a fundamental usability problem:

- [ ] Exact first-course BOM, Sense-safe GPIO and pinmap verified against real hardware.
- [ ] Course wiring graph is manually specified, physically verified, and rendered identically as diagram, Chinese checklist and Agent targets.
- [ ] Login and project overview flows tested with new and returning users.
- [ ] Debug panel opens/closes without losing editor state.
- [ ] Agent anchors remain correct when panel widths or visibility change.
- [ ] Reduced motion and keyboard paths pass.
