import * as vscode from 'vscode';
import * as path from 'path';
import { TracePoint } from './types';

let traceDecorationType: vscode.TextEditorDecorationType;

/** Create the shared decoration type (call once at activation) */
export function initDecorations(context: vscode.ExtensionContext): void {
    traceDecorationType = vscode.window.createTextEditorDecorationType({
        gutterIconPath: context.asAbsolutePath(path.join('resources', 'bookmark.svg')),
        gutterIconSize: 'contain',
        isWholeLine: true,
        backgroundColor: 'rgba(255, 215, 0, 0.1)', // soft gold tint
    });
}

/**
 * Re-render gutter icons & line highlights for the given editor.
 * Filters traces to only those belonging to the editor's file.
 */
export function updateDecorations(
    editor: vscode.TextEditor,
    traces: TracePoint[],
): void {
    if (!traceDecorationType) { return; }

    const currentFilePath = editor.document.uri.fsPath;
    const relevantTraces = traces.filter(t => t.filePath === currentFilePath);

    const decorations: vscode.DecorationOptions[] = relevantTraces.map(trace => {
        const range = new vscode.Range(trace.lineRange[0], 0, trace.lineRange[1], 0);
        return {
            range,
            hoverMessage: new vscode.MarkdownString(
                `**Trace Note:** ${trace.note || '(No note)'}`,
            ),
        };
    });

    editor.setDecorations(traceDecorationType, decorations);
}
