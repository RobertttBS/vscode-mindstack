import * as vscode from 'vscode';
import { ITraceDocument } from './types';

export class TraceRecoveryEngine {
    private static readonly SEARCH_RADIUS = 2000; 
    private static readonly TOKEN_THRESHOLD = 0.7;

    /**
     * @param document The VS Code TextDocument
     * @param storedContent The snippet we are looking for
     * @param lastKnownOffset The character offset where it used to be
     */
    public recoverTracePoints(
        document: ITraceDocument,
        storedContent: string,
        lastKnownOffset: number
    ): vscode.Range | null {
        const cleanTarget = storedContent.trim();
        if (!cleanTarget) return null;

        const docText = document.getText();
        
        // 1. Calculate Search Bounds
        const startIdx = Math.max(0, lastKnownOffset - TraceRecoveryEngine.SEARCH_RADIUS);
        const endIdx = Math.min(docText.length, lastKnownOffset + TraceRecoveryEngine.SEARCH_RADIUS + cleanTarget.length);
        const searchArea = docText.slice(startIdx, endIdx);

        // --- Level 1: Exact Match (High Performance) ---
        const exactIdx = searchArea.indexOf(cleanTarget);
        if (exactIdx !== -1) {
            return this.getRangeFromOffset(document, startIdx + exactIdx, cleanTarget.length);
        }

        // --- Level 2: Regex (Whitespace Insensitive) ---
        const regexRange = this.tryRegexMatch(document, searchArea, cleanTarget, startIdx);
        if (regexRange) return regexRange;

        // --- Level 3: Token Similarity (Line-by-Line) ---
        return this.tryFuzzyLineMatch(document, startIdx, endIdx, cleanTarget);
    }

    private tryRegexMatch(doc: ITraceDocument, area: string, target: string, offset: number): vscode.Range | null {
        const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const fuzzyPattern = escaped.replace(/\s+/g, '\\s*');
        const regex = new RegExp(fuzzyPattern, 'g');
        
        const match = regex.exec(area);
        if (match) {
            return this.getRangeFromOffset(doc, offset + match.index, match[0].length);
        }
        return null;
    }

    private tryFuzzyLineMatch(
        doc: ITraceDocument, 
        startOffset: number, 
        endOffset: number, 
        target: string
    ): vscode.Range | null {
        const startLine = doc.positionAt(startOffset).line;
        const endLine = doc.positionAt(endOffset).line;
        
        const targetTokens = this.tokenize(target);
        const targetSet = new Set(targetTokens);
        
        let bestRange: vscode.Range | null = null;
        let highestScore = 0;

        for (let i = startLine; i <= endLine; i++) {
            const line = doc.lineAt(i);
            const lineText = line.text.trim();
            if (!lineText) continue;

            // Token Score
            const lineTokens = this.tokenize(lineText);
            const intersect = lineTokens.filter(t => targetSet.has(t));
            const score = intersect.length / Math.max(targetTokens.length, 1);

            if (score > highestScore && score >= TraceRecoveryEngine.TOKEN_THRESHOLD) {
                highestScore = score;
                bestRange = new vscode.Range(new vscode.Position(i, 0), line.range.end);
            }
            
            // Short-circuit if we found a near-perfect match
            if (highestScore > 0.95) break;
        }

        return bestRange;
    }

    private tokenize(str: string): string[] {
        return str.toLowerCase().split(/\W+/).filter(t => t.length > 1);
    }

    private getRangeFromOffset(doc: ITraceDocument, offset: number, length: number): vscode.Range {
        return new vscode.Range(doc.positionAt(offset), doc.positionAt(offset + length));
    }
}
