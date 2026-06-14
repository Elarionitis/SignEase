import { IconType } from "react-icons/lib";

export interface TechCardProps {
  id: string;
  Icon: IconType;
  name: string;
  description: string;
  longDescription: string;
  videoUrl?: string;
  demoUrl: string;
  hideTryButton?: boolean;
  expandedVideo?: boolean;
  onToggleExpand?: () => void;
}
