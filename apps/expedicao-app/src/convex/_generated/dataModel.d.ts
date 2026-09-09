export type Id<_T extends string = string> = string;
export type Doc<_T extends string = string> = Record<string, unknown> & {
  _id: string;
  _creationTime: number;
};
export type TableNames = string;
export type DataModel = Record<string, never>;
