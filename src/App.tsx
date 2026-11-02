import { useEffect, useState } from 'react';
import { useApp } from './store';
import { Avatar, BrandMark, Button, Icon, IconName } from './ui';
import { Go, HelpSection, Tab } from './nav';
import Auth from './screens/Auth';
import HomeScreen from './screens/Home';
import SpotScreen from './screens/Spot';
import CircleScreen from './screens/Circle';
import HelpScreen from './screens/Help';
import MeScreen from './screens/Me';
import NewsScreen from './screens/News';
import GamesScreen from './screens/Games';
import MediaScreen from './screens/Media';
import SuccessScreen from './screens/Success';
import SettingsScreen from './screens/Settings';
import MoreScreen from './screens/More';
import NotificationsScreen from './screens/Notifications';
import SosButton from './Sos';

type NavItem = { id: Tab; label: string; icon: IconName };

const DESKTOP: NavItem[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'spot', label: 'My spot', icon: 'pin' },
  { id: 'circle', label: 'Circle', icon: 'users' },
  { id: 'games', label: 'Games', icon: 'game' },
  { id: 'news', label: 'News', icon: 'news' },
  { id: 'photos', label: 'Photos', icon: 'camera' },
  { id: 'success', label: 'Success', icon: 'trophy' },
  { id: 'help', label: 'Help', icon: 'life' },
  { id: 'me', label: 'Me', icon: 'user' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

const MOBILE: NavItem[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'spot', label: 'My spot', icon: 'pin' },
  { id: 'circle', label: 'Circle', icon: 'users' },
  { id: 'games', label: 'Games', icon: 'game' },
  { id: 'more', label: 'More', icon: 'more' },
];

const TITLES: Record<Tab, string> = {
  home: 'Home',
  spot: 'My spot',
  circle: 'Circle',
  games: 'Games',
  more: 'More',
  news: 'News',
  photos: 'Photos & reels',
  success: 'Success stories',
  help: 'Help',
  me: 'Me',
  settings: 'Settings & privacy',
  notifications: 'Notifications',
};

function Toasts() {
  const { toasts, dismiss } = useApp();
  if (!toasts.length) return null;
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`} onClick={() => dismiss(t.id)} role="status">
          <span className="toast-icon">
            <Icon name={t.tone === 'error' ? 'bell' : 'check'} size={17} />
          </span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const { data, ready, logout } = useApp();
  const [tab, setTab] = useState<Tab>('home');
  const [helpSection, setHelpSection] = useState<HelpSection>('food');

  useEffect(() => {
    if (!data) setTab('home');
  }, [data]);

  const go: Go = (next, opts) => {
    if (opts?.help) setHelpSection(opts.help);
    setTab(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!ready) {
    return (
      <div className="splash">
        <BrandMark size={44} />
        <p className="muted small">Opening Northlight…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <>
        <Auth />
        <Toasts />
      </>
    );
  }

  const { me, unread, unreadNotifications } = data;

  const screen =
    tab === 'home' ? (
      <HomeScreen go={go} />
    ) : tab === 'spot' ? (
      <SpotScreen go={go} />
    ) : tab === 'circle' ? (
      <CircleScreen />
    ) : tab === 'games' ? (
      <GamesScreen />
    ) : tab === 'news' ? (
      <NewsScreen />
    ) : tab === 'photos' ? (
      <MediaScreen />
    ) : tab === 'success' ? (
      <SuccessScreen />
    ) : tab === 'help' ? (
      <HelpScreen section={helpSection} setSection={setHelpSection} />
    ) : tab === 'settings' ? (
      <SettingsScreen go={go} />
    ) : tab === 'notifications' ? (
      <NotificationsScreen />
    ) : tab === 'more' ? (
      <MoreScreen go={go} />
    ) : (
      <MeScreen go={go} />
    );

  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">
          <BrandMark size={34} />
          <div>
            <div className="brand-name">Northlight</div>
            <div className="brand-sub">you're on the map</div>
          </div>
        </div>

        <nav className="nav" aria-label="Main">
          {DESKTOP.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${tab === item.id ? 'is-active' : ''}`}
              onClick={() => go(item.id)}
              aria-current={tab === item.id ? 'page' : undefined}
            >
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
              {item.id === 'circle' && unread > 0 ? <span className="nav-badge">{unread}</span> : null}
            </button>
          ))}
        </nav>

        <div className="rail-foot">
          <div className="rail-note">
            <b>Your spot is yours.</b> Sharing is a switch, not a setting buried in a menu. Turn it off and
            only you know where you were last.
          </div>
          <button className="nav-item" onClick={() => void logout()}>
            <Icon name="lock" size={17} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="row">
            <span className="only-mobile">
              <BrandMark size={28} />
            </span>
            <h1 className="topbar-title only-desktop">{TITLES[tab]}</h1>
            <span className="brand-name only-mobile" style={{ fontSize: '1.1rem' }}>
              Northlight
            </span>
          </div>
          <div className="topbar-right">
            <button
              className="icon-btn"
              onClick={() => go('notifications')}
              aria-label={`Notifications, ${unreadNotifications} unread`}
              title="Notifications"
              style={{ position: 'relative' }}
            >
              <Icon name="bell" size={19} />
              {unreadNotifications > 0 ? (
                <span
                  style={{
                    position: 'absolute',
                    marginLeft: 22,
                    marginTop: -18,
                    background: 'var(--amber)',
                    color: '#23160b',
                    borderRadius: 999,
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    padding: '0 5px',
                  }}
                >
                  {unreadNotifications}
                </span>
              ) : null}
            </button>
            <button
              className="icon-btn"
              onClick={() => go('circle')}
              aria-label={`Messages, ${unread} unread`}
              title="Messages"
            >
              <Icon name="message" size={19} />
              {unread > 0 ? (
                <span
                  style={{
                    position: 'absolute',
                    marginLeft: 22,
                    marginTop: -18,
                    background: 'var(--amber)',
                    color: '#23160b',
                    borderRadius: 999,
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    padding: '0 5px',
                  }}
                >
                  {unread}
                </span>
              ) : null}
            </button>
            <button onClick={() => go('me')} aria-label="Your profile" className="icon-btn" style={{ padding: 0, overflow: 'hidden' }}>
              <Avatar name={me.name} color={me.avatarColor} size={36} />
            </button>
          </div>
        </header>

        {screen}
      </div>

      <nav className="tabs" aria-label="Main">
        {MOBILE.map((item) => (
          <button
            key={item.id}
            className={`tab ${tab === item.id || (item.id === 'more' && ['news', 'photos', 'success', 'settings', 'me', 'notifications', 'help'].includes(tab)) ? 'is-active' : ''}`}
            onClick={() => go(item.id)}
            aria-current={tab === item.id ? 'page' : undefined}
          >
            <Icon name={item.icon} size={21} />
            <span>{item.label}</span>
            {item.id === 'circle' && unread > 0 ? <span className="tab-badge">{unread}</span> : null}
            {item.id === 'more' && unreadNotifications > 0 ? <span className="tab-badge">{unreadNotifications}</span> : null}
          </button>
        ))}
      </nav>

      <SosButton />
      <Toasts />
    </div>
  );
}
