class HTMLElement {}
class Document {
    public createElement(tagName: string): HTMLElement {
        return new HTMLElement;
    }
}

class Window {
    public readonly document: Document = new Document;
    public readonly HTMLElement: typeof HTMLElement = HTMLElement;
}

const window = new Window;

( globalThis as any ).window = window;

for (const key in window) {
    (globalThis as any)[key] = (window as any)[key];
}