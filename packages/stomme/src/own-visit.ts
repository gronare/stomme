export const OWN_VISIT_KEY = 'stomme-no-metrics';

export const ownVisit = `(() => { try { const q = new URLSearchParams(location.search), g = q.get('gh'); if (g !== null) { q.delete('gh'); const s = String(q); history.replaceState(history.state, '', location.pathname + (s ? '?' + s : '') + location.hash); if (g === '1') localStorage.setItem('${OWN_VISIT_KEY}', '1'); else if (g === '0') localStorage.removeItem('${OWN_VISIT_KEY}'); } return localStorage.getItem('${OWN_VISIT_KEY}') === '1'; } catch (e) { return false; } })()`;
