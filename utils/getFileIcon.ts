import { MaterialCommunityIcons } from "@expo/vector-icons";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

interface IconProps {
  name: IconName;
  color: string;
}

// Special folders
const FOLDER_ICONS: Record<string, IconProps> = {
  node_modules: { name: "nodejs", color: "#43853D" },
  ".git": { name: "git", color: "#F05032" },
  ".github": { name: "github", color: "#181717" },
  ".vscode": { name: "microsoft-visual-studio-code", color: "#007ACC" },
  src: { name: "folder-eye", color: "#FFB74D" },
  components: { name: "folder-table", color: "#FFB74D" },
  assets: { name: "folder-image", color: "#FFB74D" },
  images: { name: "folder-image", color: "#FFB74D" },
  img: { name: "folder-image", color: "#FFB74D" },
  videos: { name: "video", color: "#FFB74D" },
  music: { name: "folder-music", color: "#FFB74D" },
  dist: { name: "folder-zip", color: "#FFAB00" },
  build: { name: "folder-zip", color: "#FFAB00" },
  public: { name: "folder-account", color: "#FFB74D" },
  downloads: { name: "folder-download", color: "#4CAF50" },
  uploads: { name: "folder-upload", color: "#4CAF50" },
  logs: { name: "folder-text", color: "#9E9E9E" },
  config: { name: "folder-cog", color: "#607D8B" },
  settings: { name: "folder-cog", color: "#607D8B" },
};

// Extension mapping
const FILE_ICONS: Record<string, IconProps> = {
  // Code
  js: { name: "language-javascript", color: "#F7DF1E" },
  jsx: { name: "react", color: "#61DAFB" },
  ts: { name: "language-typescript", color: "#3178C6" },
  tsx: { name: "react", color: "#3178C6" },
  html: { name: "language-html5", color: "#E34F26" },
  htm: { name: "language-html5", color: "#E34F26" },
  css: { name: "language-css3", color: "#1572B6" },
  scss: { name: "sass", color: "#CC6699" },
  sass: { name: "sass", color: "#CC6699" },
  less: { name: "language-css3", color: "#1D365D" },
  json: { name: "code-json", color: "#F7DF1E" },
  xml: { name: "xml", color: "#E34F26" },
  yaml: { name: "code-brackets", color: "#CB171E" },
  yml: { name: "code-brackets", color: "#CB171E" },
  md: { name: "language-markdown", color: "#083fa1" },
  mdx: { name: "language-markdown", color: "#083fa1" },
  py: { name: "language-python", color: "#3776AB" },
  java: { name: "language-java", color: "#007396" },
  c: { name: "language-c", color: "#00599C" },
  cpp: { name: "language-cpp", color: "#00599C" },
  h: { name: "language-c", color: "#00599C" },
  cs: { name: "language-csharp", color: "#68217A" },
  go: { name: "language-go", color: "#00ADD8" },
  php: { name: "language-php", color: "#777BB4" },
  rb: { name: "language-ruby", color: "#CC342D" },
  rs: { name: "language-rust", color: "#DEA584" },
  swift: { name: "language-swift", color: "#F05138" },
  kt: { name: "language-kotlin", color: "#F18E33" },
  dart: { name: "brush", color: "#00B4AB" }, // No generic dart icon in all sets
  lua: { name: "language-lua", color: "#000080" },
  sql: { name: "database", color: "#e38c00" },
  sh: { name: "console", color: "#4EAA25" },
  bash: { name: "console", color: "#4EAA25" },
  zsh: { name: "console", color: "#4EAA25" },
  bat: { name: "console-line", color: "#C1F12E" },
  cmd: { name: "console-line", color: "#C1F12E" },
  ps1: { name: "console", color: "#3178C6" },

  // Config Files
  env: { name: "cog", color: "#607D8B" },
  gitignore: { name: "git", color: "#F05032" },
  dockerfile: { name: "docker", color: "#2496ED" },
  editorconfig: { name: "cog", color: "#E24329" },
  lock: { name: "lock-outline", color: "#FFC107" },

  // Images
  png: { name: "image", color: "#B072D9" },
  jpg: { name: "image", color: "#B072D9" },
  jpeg: { name: "image", color: "#B072D9" },
  gif: { name: "image", color: "#B072D9" },
  svg: { name: "svg", color: "#FFB13B" },
  ico: { name: "image", color: "#B072D9" },
  webp: { name: "image", color: "#B072D9" },

  // Audio/Video
  mp3: { name: "music", color: "#E91E63" },
  wav: { name: "music", color: "#E91E63" },
  mp4: { name: "video", color: "#E91E63" },
  mov: { name: "video", color: "#E91E63" },
  avi: { name: "video", color: "#E91E63" },
  mkv: { name: "video", color: "#E91E63" },

  // Documents
  pdf: { name: "file-pdf-box", color: "#F44336" },
  txt: { name: "file-document-outline", color: "#9E9E9E" },
  doc: { name: "file-word", color: "#2B579A" },
  docx: { name: "file-word", color: "#2B579A" },
  xls: { name: "file-excel", color: "#217346" },
  xlsx: { name: "file-excel", color: "#217346" },
  ppt: { name: "file-powerpoint", color: "#D24726" },
  pptx: { name: "file-powerpoint", color: "#D24726" },
  csv: { name: "file-delimited", color: "#217346" },

  // Archives
  zip: { name: "zip-box", color: "#FF9800" },
  rar: { name: "zip-box", color: "#FF9800" },
  tar: { name: "zip-box", color: "#FF9800" },
  gz: { name: "zip-box", color: "#FF9800" },
  "7z": { name: "zip-box", color: "#FF9800" },
};

// Exact filenames mapping
const EXACT_FILES: Record<string, IconProps> = {
  "package.json": { name: "nodejs", color: "#43853D" },
  "package-lock.json": { name: "nodejs", color: "#83CD29" },
  "yarn.lock": { name: "nodejs", color: "#2C8EBB" },
  "tsconfig.json": { name: "language-typescript", color: "#3178C6" },
  "readme.md": { name: "information-outline", color: "#083fa1" },
  dockerfile: { name: "docker", color: "#2496ED" },
  makefile: { name: "file-code", color: "#607D8B" },
  license: { name: "license", color: "#D32F2F" },
  "license.md": { name: "license", color: "#D32F2F" },
  "license.txt": { name: "license", color: "#D32F2F" },
};

export const getFileIcon = (
  fileName: string,
  isDirectory: boolean,
): IconProps => {
  const lowerName = fileName.toLowerCase();

  // 1. Folders
  if (isDirectory) {
    if (FOLDER_ICONS[lowerName]) {
      return FOLDER_ICONS[lowerName];
    }
    return { name: "folder", color: "#FFB74D" };
  }

  // 2. Exact filenames
  if (EXACT_FILES[lowerName]) {
    return EXACT_FILES[lowerName];
  }

  // 3. Extensions
  const ext = lowerName.split(".").pop();
  if (ext && FILE_ICONS[ext]) {
    return FILE_ICONS[ext];
  }

  // 4. Default
  return { name: "file-outline", color: "#757575" };
};
