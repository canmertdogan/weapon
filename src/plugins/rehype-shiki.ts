import { createHighlighter } from 'shiki';
import type { Plugin } from 'unified';
import type { Root, Element } from 'hast';

let highlighterPromise: Promise<Awaited<ReturnType<typeof createHighlighter>>> | null = null;

async function getHighlighterInstance() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-dark', 'github-light'],
      langs: [
        'asm', 'c', 'cpp', 'rust', 'go', 'python', 'javascript', 'typescript',
        'json', 'yaml', 'toml', 'xml', 'html', 'css',
        'bash', 'powershell', 'dockerfile', 'sh', 'text',
        'markdown', 'diff',
      ],
    });
  }
  return highlighterPromise;
}

function getLanguage(className: string[]): string | null {
  for (const cls of className) {
    if (cls.startsWith('language-')) {
      return cls.slice(9);
    }
  }
  return null;
}

const rehypeShiki: Plugin<[], Root> = function () {
  return async (tree: Root) => {
    const highlighter = await getHighlighterInstance();

    const codeBlocks: Array<{ pre: Element; code: Element; lang: string }> = [];

    // Find all pre > code elements
    function visit(node: any) {
      if (node.type === 'element' && node.tagName === 'pre') {
        const codeChild = node.children.find((c: any) => c.type === 'element' && c.tagName === 'code');
        if (codeChild) {
          const lang = getLanguage(codeChild.properties.className || []);
          if (lang) {
            codeBlocks.push({ pre: node, code: codeChild, lang });
          }
        }
      }
      if (node.children) {
        node.children.forEach((child: any) => visit(child));
      }
    }

    visit(tree);

    // Process each code block
    for (const { pre, code, lang } of codeBlocks) {
      const codeText = code.children
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.value)
        .join('');

      try {
        const html = highlighter.codeToHtml(codeText, {
          lang,
          themes: { light: 'github-light', dark: 'github-dark' },
          defaultColor: false,
        });

        // Replace the pre element with the highlighted HTML
        const raw = pre as unknown as { type: 'raw'; value: string; children?: unknown };
        raw.type = 'raw';
        raw.value = html;
        // Remove children since we're using raw HTML
        delete raw.children;
      } catch (e) {
        console.warn(`Failed to highlight ${lang}:`, e);
      }
    }
  };
};

export default rehypeShiki;