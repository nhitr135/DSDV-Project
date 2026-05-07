// main.js — entry point, mounts React app
import { html } from './lib.js';
import { App } from './App.js';

ReactDOM.createRoot(document.getElementById('root')).render(html`<${App} />`);
