import React, { useEffect } from 'react';
import { initials } from './store';

export type IconName =
  | 'home'
  | 'pin'
  | 'users'
  | 'life'
  | 'user'
  | 'send'
  | 'plus'
  | 'check'
  | 'x'
  | 'chevron'
  | 'bell'
  | 'food'
  | 'water'
  | 'bed'
  | 'shower'
  | 'clinic'
  | 'plug'
  | 'message'
  | 'heart'
  | 'spark'
  | 'arrow'
  | 'trash'
  | 'map'
  | 'clock'
  | 'shield'
  | 'compass'
  | 'globe'
  | 'back'
  | 'lock'
  | 'phone'
  | 'camera'
  | 'play'
  | 'siren'
  | 'settings'
  | 'news'
  | 'trophy'
  | 'game'
  | 'comment'
  | 'share'
  | 'more';

const PATHS: Record<IconName, React.ReactNode> = {
  home: <path d="M3 10.6 12 3.5l9 7.1V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  pin: (
    <>
      <path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3 20c0-3.2 2.7-5.4 6-5.4s6 2.2 6 5.4" />
      <path d="M16.5 6.2a3 3 0 0 1 0 5.6M18 20c0-2.4-.8-4-2-5" />
    </>
  ),
  life: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.6" />
      <path d="M5.6 5.6 9.5 9.5M18.4 5.6 14.5 9.5M18.4 18.4 14.5 14.5M5.6 18.4 9.5 14.5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20.5c0-3.7 3.4-6.2 7.5-6.2s7.5 2.5 7.5 6.2" />
    </>
  ),
  send: <path d="M4 12 20.5 4l-7 16.5-2.6-6.6z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m4.5 12.5 5 5 10-11" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  back: <path d="m15 5-7 7 7 7" />,
  bell: (
    <>
      <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9Z" />
      <path d="M10 18a2 2 0 0 0 4 0" />
    </>
  ),
  food: (
    <>
      <path d="M6 3v8a2.5 2.5 0 0 0 5 0V3M8.5 11v10" />
      <path d="M17 3c-1.8 1.6-2.5 3.4-2.5 5.5 0 1.7.9 2.7 2.5 3V21" />
    </>
  ),
  water: <path d="M12 3s6 6.4 6 10.4A6 6 0 0 1 6 13.4C6 9.4 12 3 12 3Z" />,
  bed: (
    <>
      <path d="M3 20V9m0 5h18v6M3 14h18" />
      <path d="M7 9h4.5a2.5 2.5 0 0 1 0 5H7z" />
    </>
  ),
  shower: (
    <>
      <path d="M5 21V8a4 4 0 0 1 4-4c1.6 0 2.6.7 5 3H5" />
      <path d="M14 7h6M17 10v1M15 13v1M19 13v1M17 16v1" />
    </>
  ),
  clinic: (
    <>
      <path d="M12 4v6M9 7h6" />
      <path d="M5 10h14v10H5z" />
      <path d="M9 20v-4h6v4" />
    </>
  ),
  plug: (
    <>
      <path d="M8 3v5M16 3v5M6 8h12v3a6 6 0 0 1-12 0z" />
      <path d="M12 17v4" />
    </>
  ),
  message: <path d="M4 5h16v11H9l-5 4z" />,
  heart: <path d="M12 20s-8-4.8-8-10a4.6 4.6 0 0 1 8-3 4.6 4.6 0 0 1 8 3c0 5.2-8 10-8 10Z" />,
  spark: <path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z" />,
  arrow: <path d="M4 12h15m-5-6 6 6-6 6" />,
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
    </>
  ),
  map: (
    <>
      <path d="M9 4 3 6.5v14L9 18l6 2.5 6-2.5v-14L15 6.5z" />
      <path d="M9 4v14M15 6.5v14" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3.5 2" />
    </>
  ),
  shield: <path d="M12 3l8 3v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6z" />,
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" />
    </>
  ),
  lock: (
    <>
      <path d="M6 11h12v9H6z" />
      <path d="M9 11V8a3 3 0 0 1 6 0v3" />
    </>
  ),
  phone: <path d="M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm3 15h4" />,
  camera: (
    <>
      <path d="M4 8h3l1.6-2h6.8L17 8h3v11H4z" />
      <circle cx="12" cy="13" r="3.4" />
    </>
  ),
  play: <path d="M8 5.5 19 12 8 18.5z" />,
  siren: (
    <>
      <path d="M7 17v-4a5 5 0 0 1 10 0v4" />
      <path d="M4 20h16M12 3v2M4.5 6.5 6 8M19.5 6.5 18 8" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h16M4 12h16M4 17h16" />
      <circle cx="9" cy="7" r="2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="8" cy="17" r="2" fill="currentColor" stroke="none" />
    </>
  ),
  news: (
    <>
      <path d="M4 5h13v15H4z" />
      <path d="M17 9h3v8a3 3 0 0 1-3 3M7 9h7M7 12h7M7 15h4" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 5H5v2a3 3 0 0 0 3 3M16 5h3v2a3 3 0 0 1-3 3M12 13v4M9 20h6" />
    </>
  ),
  game: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="3" />
      <path d="M8 10v4M6 12h4M15 11h.01M18 13h.01" />
    </>
  ),
  comment: <path d="M4 5h16v11H9l-5 4z" />,
  share: (
    <>
      <path d="M12 15V4M8 8l4-4 4 4" />
      <path d="M5 13v7h14v-7" />
    </>
  ),
  more: (
    <>
      <circle cx="6" cy="6" r="1.6" />
      <circle cx="12" cy="6" r="1.6" />
      <circle cx="18" cy="6" r="1.6" />
      <circle cx="6" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18" cy="12" r="1.6" />
      <circle cx="6" cy="18" r="1.6" />
      <circle cx="12" cy="18" r="1.6" />
      <circle cx="18" cy="18" r="1.6" />
    </>
  ),
};

export function Icon({
  name,
  size = 20,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="nl-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffd79a" />
          <stop offset="55%" stopColor="#f2a950" />
          <stop offset="100%" stopColor="#d9834a" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="19" fill="#0d1a26" stroke="rgba(255,215,154,0.45)" strokeWidth="1" />
      <path
        d="M20 7l2.9 8.2 8.1 2.8-8.1 2.9L20 29l-2.9-8.1L9 18l8.1-2.8z"
        fill="url(#nl-mark)"
      />
      <circle cx="20" cy="20" r="2.4" fill="#0d1a26" />
    </svg>
  );
}

/* --------------------------------- layout -------------------------------- */

export function Card({
  children,
  className = '',
  as: Tag = 'section',
}: {
  children: React.ReactNode;
  className?: string;
  as?: any;
}) {
  return <Tag className={`card ${className}`.trim()}>{children}</Tag>;
}

export function CardHead({
  title,
  hint,
  action,
  icon,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  icon?: IconName;
}) {
  return (
    <div className="card-head">
      <div className="card-head-text">
        <h2 className="card-title">
          {icon ? <Icon name={icon} size={17} className="card-title-icon" /> : null}
          {title}
        </h2>
        {hint ? <p className="card-hint">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  icon,
  disabled,
  type = 'button',
  full,
  className = '',
  title,
}: {
  children?: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'mint' | 'quiet' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  disabled?: boolean;
  type?: 'button' | 'submit';
  full?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`btn btn-${variant} btn-${size} ${full ? 'btn-full' : ''} ${className}`.trim()}
    >
      {icon ? <Icon name={icon} size={size === 'sm' ? 15 : 18} /> : null}
      {children ? <span>{children}</span> : null}
    </button>
  );
}

export function Avatar({
  name,
  color,
  size = 44,
  ring,
  status,
}: {
  name: string;
  color?: string;
  size?: number;
  ring?: boolean;
  status?: 'on' | 'off' | 'unread';
}) {
  return (
    <span
      className={`avatar ${ring ? 'avatar-ring' : ''}`}
      style={{
        width: size,
        height: size,
        background: color || '#f0a04b',
        fontSize: Math.round(size * 0.38),
      }}
      aria-hidden="true"
    >
      {initials(name)}
      {status ? (
        <span className={`avatar-dot avatar-dot-${status}`} />
      ) : null}
    </span>
  );
}

export function Pill({
  children,
  tone = 'neutral',
  icon,
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'amber' | 'mint' | 'warm' | 'rose' | 'ink';
  icon?: IconName;
}) {
  return (
    <span className={`pill pill-${tone}`}>
      {icon ? <Icon name={icon} size={13} /> : null}
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label className="field" htmlFor={htmlFor}>
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  small,
}: {
  options: { value: T; label: string; badge?: number }[];
  value: T;
  onChange: (v: T) => void;
  small?: boolean;
}) {
  return (
    <div className={`segmented ${small ? 'segmented-sm' : ''}`} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          className={`segmented-item ${o.value === value ? 'is-active' : ''}`}
          onClick={() => onChange(o.value)}
          type="button"
        >
          {o.label}
          {typeof o.badge === 'number' && o.badge > 0 ? (
            <span className="segmented-badge">{o.badge}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className="toggle-row">
      <div className="toggle-text">
        <span className="toggle-label">{label}</span>
        {description ? <span className="toggle-desc">{description}</span> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className={`switch ${checked ? 'is-on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="switch-knob" />
      </button>
    </div>
  );
}

export function Progress({ value, tone = 'amber' }: { value: number; tone?: 'amber' | 'mint' }) {
  return (
    <div className={`progress progress-${tone}`} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="sheet-overlay" onClick={onClose} role="presentation">
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <h2 className="display sheet-title">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close" type="button">
            <Icon name="x" />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer ? <div className="sheet-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Empty({
  icon,
  title,
  body,
  action,
}: {
  icon: IconName;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={22} />
      </span>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function Divider({ children }: { children?: React.ReactNode }) {
  return <div className="divider">{children ? <span>{children}</span> : null}</div>;
}
