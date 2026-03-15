import * as assert from 'assert';
import * as path from 'path';

// --- MOCK VSCODE ---
const mockVscode = {
    Uri: {
        file: (pathStr: string) => ({ fsPath: pathStr, toString: () => pathStr }),
        joinPath: (base: any, ...segments: string[]) => ({ fsPath: path.join(base.fsPath, ...segments), toString: () => path.join(base.fsPath, ...segments) })
    },
    workspace: {
        workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
        findFiles: async (pattern: string) => {
            if (pattern.includes('.ts')) {
                return [mockVscode.Uri.file('/workspace/src/otherFile.ts')];
            }
            return [];
        },
        fs: {
            readFile: async (uri: any) => {
                if (uri.fsPath.endsWith('otherFile.ts')) {
                    // Cross-file search mock
                    const content = `
// Some other file
function testFunc() {
    console.log("hello");
}
`;
                    return Buffer.from(content);
                }
                return new Uint8Array();
            },
            createDirectory: async () => {},
            writeFile: async () => {}
        },
        getConfiguration: () => ({ get: () => 'utf8' }),
        textDocuments: [],
        onDidCloseTextDocument: () => ({ dispose: () => {} }),
        onDidChangeTextDocument: () => ({ dispose: () => {} })
    },
    Range: class Range { constructor(public start: any, public end: any) {} },
    Position: class Position { constructor(public line: number, public character: number) {} },
    EventEmitter: class EventEmitter { fire() {} event = () => {} },
    window: {
        createOutputChannel: () => ({ 
            appendLine: () => {},
            warn: () => {},
            error: () => {},
            info: () => {}
        }),
        showErrorMessage: () => {}
    },
    CancellationTokenSource: class { token = { isCancellationRequested: false }; cancel() {}; dispose() {} }
};

const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(request: string) {
    if (request === 'vscode') {
        return mockVscode;
    }
    return originalRequire.apply(this, arguments);
};

// --- IMPORT TRACEMANAGER ---
import { TraceManager } from './traceManager';

// Mock ITraceDocument
class MockDocument {
    constructor(private text: string) {}
    getText(range?: any) {
        if (!range) return this.text;
        return ""; // mock range extraction if needed
    }
    positionAt(offset: number) {
        let line = 0;
        let char = 0;
        for (let i = 0; i < offset; i++) {
            if (this.text[i] === '\n') {
                line++;
                char = 0;
            } else {
                char++;
            }
        }
        return new mockVscode.Position(line, char);
    }
    offsetAt(position: any) {
        return 0; // naive
    }
    get lineCount() {
        return this.text.split('\n').length;
    }
    lineAt(line: number) {
        return { text: this.text.split('\n')[line] || '' };
    }
}

async function runTests() {
    console.log("Running recoverTracePoints tests...\n");

    const contextMock = {
        subscriptions: [],
        globalStorageUri: mockVscode.Uri.file('/tmp'),
        workspaceState: {
            get: () => ({}),
            update: async () => {}
        },
        globalState: {
            get: () => ({}),
            update: async () => {}
        }
    } as any;

    const manager = new TraceManager(contextMock);
    
    // We bind the private recoverTracePoints to the manager for testing
    const recoverTracePoints = (manager as any).recoverTracePoints.bind(manager);

    let passed = 0;
    let failed = 0;

    async function test(name: string, fn: () => Promise<void>) {
        try {
            await fn();
            console.log(`✅ PASS: ${name}`);
            passed++;
        } catch (err: any) {
            console.error(`❌ FAIL: ${name}`);
            console.error(`   ${err.message}`);
            failed++;
        }
    }

    await test("Should recover cross file", async () => {
        const doc = new MockDocument(""); // File is empty
        const uri = mockVscode.Uri.file('/workspace/src/file.ts');
        
        // Exact content match but formatted identical to otherFile.ts
        const storedContent = `function testFunc() {
    console.log("hello");
}`;
        const res = await recoverTracePoints(doc, storedContent, 0, uri);
        assert.ok(res !== null, "Should return a result");
        assert.strictEqual(res.uri.fsPath, '/workspace/src/otherFile.ts', "Should recover in otherFile.ts");
    });

    await test("Should ignore spaces and newlines", async () => {
        // Document has weird spacing
        const doc = new MockDocument("function   foo(  )  \n\n\n  {\nreturn 2;\n}");
        const uri = mockVscode.Uri.file('/workspace/src/file.ts');
        
        const storedContent = "function foo() { return 2; }";
        
        const res = await recoverTracePoints(doc, storedContent, 0, uri);
        assert.ok(res !== null, "Failed to recover trace point with different whitespace");
        assert.strictEqual(res.uri.fsPath, uri.fsPath);
    });

    await test("Should treat '()' and '{}' as significant", async () => {
        // Document is missing brackets entirely
        const doc = new MockDocument("function foo   return 2;");
        const uri = mockVscode.Uri.file('/workspace/src/file.ts');
        
        const storedContent = "function foo() { return 2; }";
        
        const res = await recoverTracePoints(doc, storedContent, 0, uri);
        assert.strictEqual(res, null, "Should NOT recover if brackets/braces are missing");
    });

    console.log(`\nResults: ${passed} passed, ${failed} failed`);
    if (failed > 0) {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error("Test suite threw an error:", err);
    process.exit(1);
});
