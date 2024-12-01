declare module "timeago.js" {
  export function format(date: string | Date | number): string;
  export function render(nodes: HTMLElement | NodeList | null): void;
  export function register(locale: string, localeFunc: Function): void;
  export function cancel(): void;
}
