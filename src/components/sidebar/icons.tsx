import {
  Folder,
  Globe,
  BookOpen,
  Code,
  Lightbulb,
  Palette,
  Music,
  Camera,
  Heart,
  Star,
  Zap,
  Home,
  Briefcase,
  GraduationCap,
  Gamepad2,
  Plane,
  Coffee,
  ShoppingCart,
  Dumbbell,
  TreePine,
  Sparkles,
} from 'lucide-react';

// 图标映射（供侧边栏分类树与编辑分类对话框共用）
export const ICON_MAP: Record<string, React.ComponentType<{ strokeWidth?: number; size?: number; className?: string }>> = {
  folder: Folder,
  globe: Globe,
  book: BookOpen,
  code: Code,
  lightbulb: Lightbulb,
  palette: Palette,
  music: Music,
  camera: Camera,
  heart: Heart,
  star: Star,
  zap: Zap,
  home: Home,
  briefcase: Briefcase,
  graduation: GraduationCap,
  gamepad: Gamepad2,
  plane: Plane,
  coffee: Coffee,
  shopping: ShoppingCart,
  dumbbell: Dumbbell,
  tree: TreePine,
};

export const ICON_OPTIONS = Object.keys(ICON_MAP);

export function getIconComponent(iconName: string) {
  return ICON_MAP[iconName] || Sparkles;
}
