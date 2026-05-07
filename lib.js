// lib.js
// htm is loaded as UMD via <script> in index.html → window.htm
// React is loaded as UMD via <script> in index.html → window.React
// We bind them here so all components share ONE React instance.

export const html = htm.bind(React.createElement);

export const useState    = React.useState;
export const useMemo     = React.useMemo;
export const useEffect   = React.useEffect;
export const useRef      = React.useRef;
export const useCallback = React.useCallback;
