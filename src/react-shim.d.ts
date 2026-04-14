declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }

  const React: any;
  export default React;
  export const StrictMode: any;
  export function createElement(type: any, props: any, ...children: any[]): any;
  export function useState<T>(initial: T): [T, (value: T | ((prev: T) => T)) => void];
  export function useMemo<T>(factory: () => T, deps: any[]): T;
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  export function useRef<T>(initial: T): { current: T };
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
  export function useReducer<R extends any, I>(reducer: (state: R, action: any) => R, initialState: I): [R, (action: any) => void];
}

declare module 'react-dom/client' {
  export function createRoot(container: any): { render(node: any): void };
}

declare module 'react/jsx-runtime' {
  export function jsx(type: any, props: any, key?: any): any;
  export function jsxs(type: any, props: any, key?: any): any;
  export function Fragment(props: any): any;
}

declare module 'motion/react' {
  const motion: any;
  export { motion };
}

declare module 'lucide-react' {
  const icons: any;
  export default icons;
}

declare module '@google/genai' {
  const genai: any;
  export { genai as GoogleGenAI };
}

declare module '*.css';
