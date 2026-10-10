import {
  ArrowLeft,
  Check,
  Expand,
  Heart,
  Home,
  Map,
  MapPin,
  MessageCircle,
  Newspaper,
  Plus,
  UserRound,
  X,
  type LucideProps,
} from "lucide-react";

const icons = {
  home: Home,
  map: Map,
  plus: Plus,
  feed: Newspaper,
  user: UserRound,
  heart: Heart,
  comment: MessageCircle,
  pin: MapPin,
  close: X,
  check: Check,
  back: ArrowLeft,
  expand: Expand,
};

export function Icon({ name, ...props }: LucideProps & { name: keyof typeof icons }) {
  const Component = icons[name];
  return <Component size={20} strokeWidth={1.8} aria-hidden="true" {...props} />;
}
