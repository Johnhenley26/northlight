import { api, Post } from './api';
import { timeAgo, useApp } from './store';
import { Avatar, Icon } from './ui';

export default function PostCard({ post, compact }: { post: Post; compact?: boolean }) {
  const { run } = useApp();

  return (
    <article className="post">
      <div className="row" style={{ gap: 10 }}>
        <Avatar name={post.author.name} color={post.author.avatarColor} size={36} />
        <div className="grow">
          <div className="small strong">{post.author.name}</div>
          <div className="tiny muted">
            {post.kind === 'passion' ? 'Passion' : 'Story'} · {timeAgo(post.at)}
            {post.author.handle ? ` · @${post.author.handle}` : ''}
          </div>
        </div>
        {post.tags[0] ? <span className="pill">{post.tags[0]}</span> : null}
      </div>

      <h3 className="post-title">{post.title}</h3>
      <p className={`post-body ${compact ? 'clamp-3' : ''}`}>{post.body}</p>

      <div className="row" style={{ gap: 14 }}>
        <button
          className={`cheer ${post.cheered ? 'is-on' : ''}`}
          onClick={() => void run(() => api(`/posts/${post.id}/cheer`, { method: 'POST' }))}
          aria-pressed={post.cheered}
          aria-label={post.cheered ? 'Remove your cheer' : 'Cheer this post'}
        >
          <Icon name="heart" size={16} />
          {post.cheersCount > 0 ? `${post.cheersCount} cheering` : 'Cheer this on'}
        </button>
        {post.tags.length > 1 ? (
          <span className="tiny muted">{post.tags.slice(1).map((t) => `#${t}`).join('  ')}</span>
        ) : null}
      </div>
    </article>
  );
}
