// jsdom ships no types and only the constructor and window are used here, so declaring those
// avoids a second dev dependency just for a type package.
declare module 'jsdom' {
  export class JSDOM {
    constructor(html: string, options?: { runScripts?: 'outside-only' | 'dangerously' });
    readonly window: object;
  }
}
