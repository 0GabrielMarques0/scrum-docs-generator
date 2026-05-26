declare module 'html-to-docx' {
  interface DocxOptions {
    table?: {
      row?: {
        cantSplit?: boolean;
      };
    };
    footer?: boolean;
    pageNumber?: boolean;
    margins?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
  }

  export default function HTMLtoDOCX(
    html: string,
    headerHTMLString: string | null,
    options?: DocxOptions
  ): Promise<ArrayBuffer>;
}
