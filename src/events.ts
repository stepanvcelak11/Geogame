/** Události z logiky do UI. */
export interface InspectPayload {
  title: string;
  subtitle: string;
  rows: [string, string][];
  description: string;
}

export type GameEvents = {
  toast: { text: string; tone?: 'info' | 'warn' };
  inspect: InspectPayload;
};
