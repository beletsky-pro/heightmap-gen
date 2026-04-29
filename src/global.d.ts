/// <reference types="svelte" />
/// <reference types="vite/client" />

declare module '*.glsl?raw' {
  const src: string;
  export default src;
}
declare module '*.frag?raw' {
  const src: string;
  export default src;
}
declare module '*.vert?raw' {
  const src: string;
  export default src;
}
declare module '*.glsl' {
  const src: string;
  export default src;
}
declare module '*.frag' {
  const src: string;
  export default src;
}
declare module '*.vert' {
  const src: string;
  export default src;
}

declare module 'upng-js' {
  const UPNG: {
    encode: (imgs: ArrayBuffer[], w: number, h: number, cnum: number, dels?: number[]) => ArrayBuffer;
    encodeLL: (imgs: ArrayBuffer[], w: number, h: number, cc: number, ac: number, depth: number, dels?: number[]) => ArrayBuffer;
    decode: (buf: ArrayBuffer) => { width: number; height: number; depth: number; ctype: number; data: Uint8Array };
    toRGBA8: (img: { width: number; height: number; depth: number; ctype: number; data: Uint8Array }) => ArrayBuffer[];
  };
  export default UPNG;
}
