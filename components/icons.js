// components/icons.js — all SVG icon components
import { html } from '../lib.js';

function SvgIcon({ cls, children }) {
  return html`
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      class=${cls}>
      ${children}
    </svg>`;
}

export const TrendingUpIcon    = ({ className: c }) => html`<${SvgIcon} cls=${c}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/><//>`;
export const ShieldAlertIcon   = ({ className: c }) => html`<${SvgIcon} cls=${c}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/><//>`;
export const InfoIcon          = ({ className: c }) => html`<${SvgIcon} cls=${c}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/><//>`;
export const PlusIcon          = ({ className: c }) => html`<${SvgIcon} cls=${c}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/><//>`;
export const Trash2Icon        = ({ className: c }) => html`<${SvgIcon} cls=${c}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/><//>`;
export const BrainCircuitIcon  = ({ className: c }) => html`<${SvgIcon} cls=${c}><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><//>`;
export const LightbulbIcon     = ({ className: c }) => html`<${SvgIcon} cls=${c}><line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/><//>`;
export const ArrowRightIcon    = ({ className: c }) => html`<${SvgIcon} cls=${c}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/><//>`;
export const ZapIcon           = ({ className: c }) => html`<${SvgIcon} cls=${c}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/><//>`;
export const GitCompareIcon    = ({ className: c }) => html`<${SvgIcon} cls=${c}><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/><//>`;
export const PieChartIcon      = ({ className: c }) => html`<${SvgIcon} cls=${c}><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/><//>`;
export const BarChart2Icon     = ({ className: c }) => html`<${SvgIcon} cls=${c}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><//>`;
export const AlertTriangleIcon = ({ className: c }) => html`<${SvgIcon} cls=${c}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/><//>`;
export const TrendingDownIcon  = ({ className: c }) => html`<${SvgIcon} cls=${c}><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/><//>`;
