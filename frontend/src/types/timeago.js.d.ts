declare module "timeago.js" {
  export function format(date: string | Date | number): string;
  export function render(nodes: HTMLElement | NodeList | null): void;
  export function register(
    locale: string,
    localeFunc: (date: Date) => string,
  ): void;
  export function cancel(): void;
}
