import type { ModuleDef } from '../modules/registry';
import { Icon } from './common/Icon';

// Placeholder shown for `planned` modules. Static content only — no data, no
// external calls. Communicates intent so the demo reads as a full platform.

export function ComingSoon({ module }: { module: ModuleDef }) {
  return (
    <div className="section-card p-10 text-center max-w-2xl mx-auto">
      <div className="mb-4 flex justify-center" style={{ color: 'var(--accent)' }} aria-hidden>
        <Icon name={module.icon} size={44} />
      </div>
      <div className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 mb-3">
        Planned module
      </div>
      <h2 className="text-xl font-bold text-gray-800 mb-2">{module.label}</h2>
      <p className="text-sm text-gray-600 leading-relaxed">{module.description}</p>
      <p className="text-xs text-gray-400 mt-6">
        This module isn't built yet — it's part of the InfoSec platform roadmap.
      </p>
    </div>
  );
}
