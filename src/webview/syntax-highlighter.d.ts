// Type declarations for refractor language modules (no published @types)
declare module 'refractor/*';
declare module 'react-syntax-highlighter/dist/esm/prism-light' {
    import { ComponentType } from 'react';
    interface SyntaxHighlighterProps {
        language?: string;
        style?: Record<string, React.CSSProperties>;
        customStyle?: React.CSSProperties;
        wrapLongLines?: boolean;
        children: string;
        [key: string]: unknown;
    }
    const SyntaxHighlighter: ComponentType<SyntaxHighlighterProps> & {
        registerLanguage(name: string, language: unknown): void;
        alias(name: string, aliases: string | string[]): void;
    };
    export default SyntaxHighlighter;
}