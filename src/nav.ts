export type Tab =
  | 'home'
  | 'spot'
  | 'circle'
  | 'games'
  | 'more'
  | 'news'
  | 'photos'
  | 'success'
  | 'help'
  | 'me'
  | 'settings'
  | 'notifications';

export type HelpSection = 'food' | 'residency' | 'deliveries';

export type Go = (
  tab: Tab,
  opts?: { help?: HelpSection; person?: string; media?: 'photo' | 'reel' }
) => void;
