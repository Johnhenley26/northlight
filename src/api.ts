export type Spot = {
  shared: boolean;
  label: string | null;
  lat: number | null;
  lng: number | null;
  precision?: 'exact' | 'area';
  at: string | null;
  lastKnown: { label: string; at: string } | null;
};

export type Msg = { id: string; fromMe: boolean; body: string; at: string };

export type MiniUser = { id: string; name: string; handle: string; avatarColor: string };

export type Person = {
  id: string;
  handle: string;
  name: string;
  bio: string;
  story: string;
  passions: string[];
  highSchool: string;
  college: string;
  gradYear: string;
  avatarColor: string;
  isSystem: boolean;
  relationship: string | null;
  relationshipLabel?: string | null;
  pending: 'incoming' | 'outgoing' | null;
  spot: Spot;
  schoolMatch?: string | null;
  requestId?: string;
  lastMessage?: { body: string; at: string; fromMe: boolean } | null;
  unread?: number;
  messages?: Msg[];
  socials?: Socials;
  housingStatus?: HousingStatus;
  housedSince?: string;
  pageHidden?: boolean;
};

export type Socials = { facebook?: string; messenger?: string; instagram?: string };

export type HousingStatus = 'homeless' | 'shelter' | 'residency' | 'housed';

export type NotifyPrefs = {
  love: boolean;
  comments: boolean;
  requests: boolean;
  games: boolean;
  news: boolean;
};

export type Me = Person & {
  inviteCode: string;
  createdAt?: string;
  shareLocation: boolean;
  shareLastKnown: boolean;
  location: { lat: number; lng: number; label: string; precision: 'exact' | 'area'; at: string } | null;
  lastKnown: { lat: number; lng: number; label: string; at: string } | null;
  housingStatus: HousingStatus;
  housedSince: string;
  pageHidden: boolean;
  socials: Socials;
  requestPolicy: 'everyone' | 'classmates' | 'nobody';
  notifyPrefs: NotifyPrefs;
};

export type Comment = {
  id: string;
  body: string;
  at: string;
  fromId: string;
  name: string;
  handle: string;
  avatarColor: string;
};

export type Post = {
  id: string;
  authorId: string;
  kind: 'story' | 'passion' | 'blog' | 'reel';
  title: string;
  body: string;
  tags: string[];
  at: string;
  cheers: string[];
  comments: Comment[];
  shares: number;
  mediaId?: string | null;
  visibility?: 'public' | 'circle';
  author: MiniUser & { housingStatus?: HousingStatus };
  cheersCount: number;
  cheered: boolean;
  mine: boolean;
};

export type MediaPost = {
  id: string;
  ownerId: string;
  kind: 'photo' | 'reel';
  seedArt: number;
  mime: string;
  caption: string;
  visibility: 'public' | 'circle';
  at: string;
  shares: number;
  likesCount: number;
  liked: boolean;
  mine: boolean;
  comments: Comment[];
  author: MiniUser;
};

export type SuccessStory = {
  id: string;
  authorId: string;
  title: string;
  body: string;
  yearsOut: number;
  city: string;
  anonymous?: boolean;
  at: string;
  likes: string[];
  likesCount: number;
  liked: boolean;
  mine: boolean;
  author: MiniUser & { housedSince?: string };
  comments: Comment[];
};

export type Notif = {
  id: string;
  type: 'love' | 'like' | 'comment' | 'share' | 'request' | 'accepted' | 'sos' | 'game' | 'housing' | 'system';
  text: string;
  at: string;
  read: boolean;
  ref: string | null;
  from: MiniUser | null;
};

export type SosAlert = {
  id: string;
  kind: 'help' | 'ambulance' | 'police' | 'narcan';
  kindLabel: string;
  note: string;
  at: string;
  status: 'active' | 'canceled';
  locationLabel: string;
  circleNotified: number;
};

export type SosLine = { label: string; number: string };
export type SosResponse = {
  alert: SosAlert;
  lines: SosLine[];
  dispatched: boolean;
  note: string;
};

export type Blocked = MiniUser & { at: string };

export type NewsItem = { title: string; url: string; source: string; at: string; summary: string };
export type NewsPayload = {
  scope: 'world' | 'us' | 'state';
  state: string | null;
  stateName: string | null;
  items: NewsItem[];
  fetchedAt: string;
  live: boolean;
  cached?: boolean;
  stale?: boolean;
  error?: string;
};

export type GameName = 'dominoes' | 'wordduel' | 'blackjack';

export type DominoTile = [number, number];

export type GameTable = {
  id: string;
  game: GameName;
  hostId: string;
  players: MiniUser[];
  visibility: 'public' | 'circle';
  status: 'open' | 'playing' | 'done';
  winnerId: string | null;
  state: any;
  you: string;
  at: string;
  updatedAt: string;
  result?: 'won' | 'lost' | 'draw' | null;
};

export type DailyState = {
  date: string;
  guesses: { word: string; marks: string[] }[];
  solved: boolean;
  done: boolean;
  attemptsLeft: number;
  answer: string | null;
};

export type SoloBoard = {
  mine: { userId: string; game: string; best: number; plays: number } | null;
  board: (MiniUser & { best: number })[];
};

export type Item = {
  id: string;
  ownerId: string;
  kind: 'need' | 'want' | 'goal' | 'dream' | 'wish';
  title: string;
  note: string;
  progress: number;
  done: boolean;
  at: string;
  claimedBy: string | null;
  claimedAt: string | null;
  owner?: string;
};

export type Delivery = {
  id: string;
  resourceName: string;
  meal: string;
  note: string;
  servings: number;
  at: string;
  etaMinutes: number;
  courier: string;
  locationLabel: string;
  stage: 'received' | 'preparing' | 'on the way' | 'delivered';
  stageLabel: string;
  progress: number;
  minutesLeft: number;
};

export type Resource = {
  id: string;
  name: string;
  type: 'food' | 'water' | 'shelter' | 'shower' | 'clinic' | 'charging' | 'daycenter';
  org: string;
  address: string;
  lat: number;
  lng: number;
  hours: string;
  days: number[];
  tags: string[];
  note: string;
  accessible: boolean;
  openToday: boolean;
};

export type Listing = {
  id: string;
  plan: 'free' | 'paid';
  name: string;
  operator: string;
  tagline: string;
  monthlyCost: number;
  deposit: number;
  description: string;
  eligibility: string[];
  amenities: string[];
  availability: string;
  unitsLeft: number;
  lat: number;
  lng: number;
  address: string;
  note: string;
};

export type Application = {
  id: string;
  listingId: string;
  note: string;
  status: string;
  at: string;
  listing: Listing | null;
};

export type Bootstrap = {
  me: Me;
  circle: Person[];
  incoming: Person[];
  outgoing: Person[];
  unread: number;
  posts: Post[];
  items: Item[];
  deliveries: Delivery[];
  residencyApps: Application[];
  wishlistForMe: (Item & { owner: string })[];
  resources: Resource[];
  listings: Listing[];
  notifications: Notif[];
  unreadNotifications: number;
  media: MediaPost[];
  successStories: SuccessStory[];
  sos: SosAlert[];
  blocks: Blocked[];
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export async function api<T>(
  path: string,
  init: { method?: string; body?: unknown } = {}
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init.method || 'GET',
      headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
      body: init.body ? JSON.stringify(init.body) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError('No connection. Northlight will keep what you typed and try again.', 0);
  }
  const text = await res.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
  }
  if (!res.ok) throw new ApiError(json.error || `Request failed (${res.status})`, res.status);
  return json as T;
}
