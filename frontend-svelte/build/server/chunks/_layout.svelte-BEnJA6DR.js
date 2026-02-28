import 'clsx';

function _layout($$renderer, $$props) {
  let { children } = $$props;
  children($$renderer);
  $$renderer.push(`<!---->`);
}

export { _layout as default };
//# sourceMappingURL=_layout.svelte-BEnJA6DR.js.map
