// Remark plugin that prefixes root-absolute link URLs with the site base path.
// Markdown links like `[x](/labs/lab-01)` would otherwise 404 on GitHub Pages
// (base `/weapon/`) because Astro does not rewrite markdown hrefs.

export function remarkBaseLinks({ base = '/' } = {}) {
  const prefix = base.replace(/\/$/, '');
  return (tree) => {
    function walk(node) {
      if (!node || typeof node !== 'object') return;
      if (
        node.type === 'link' &&
        typeof node.url === 'string' &&
        node.url.startsWith('/') &&
        !node.url.startsWith('//')
      ) {
        node.url = prefix + node.url;
      }
      if (Array.isArray(node.children)) {
        for (const child of node.children) walk(child);
      }
    }
    walk(tree);
  };
}
