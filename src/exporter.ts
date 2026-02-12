import { TracePoint } from './types';

/**
 * Generate a Markdown document from the collected traces.
 * Recursively renders children with increasing heading depth.
 */
export function generateMarkdown(traces: TracePoint[]): string {
    let md = `# Trace Result - ${new Date().toISOString().split('T')[0]}\n\n`;

    traces.forEach((t, index) => {
        md += renderTrace(t, index, 0);
        if (index < traces.length - 1) {
            md += '---\n\n';
        }
    });

    return md;
}

function renderTrace(t: TracePoint, index: number, depth: number): string {
    // Root = ##, child = ###, grandchild = ####
    const heading = '#'.repeat(depth + 2);
    const fileName = t.filePath.split('/').pop() ?? t.filePath;

    const title = t.note ? t.note.split('\n')[0] : `${fileName}:${t.lineRange[0] + 1}`;
    let md = `${heading} ${index + 1}. ${title}\n\n`;
    if (t.note) {
        const rest = t.note.split('\n').slice(1).join('\n').trim();
        if (rest) {
            md += `${rest}\n\n`;
        }
    }
    const startLine = t.lineRange[0] + 1;
    const endLine = t.lineRange[1] + 1;
    md += '```' + t.lang + ` ${startLine}:${endLine}:${t.filePath}` + '\n';
    md += t.content + '\n';
    md += '```\n\n';

    if (t.children?.length) {
        t.children.forEach((child, i) => {
            md += renderTrace(child, i, depth + 1);
        });
    }

    return md;
}
