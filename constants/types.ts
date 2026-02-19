export interface FileEntry {
  name: string;
  type: "directory" | "file" | "symlink" | "d" | "-" | "l";
  size: number;
  permissions: string;
  owner: string;
  group: string;
  modified: string;
}
