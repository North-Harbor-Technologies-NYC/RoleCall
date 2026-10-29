import { scoreNum, toneOf } from '@/lib/present';

// Score with filled segments. lg: 14 segments x 4px (count = round(score) of 5 scaled to 14); sm: 9 x 3.
// Tone by score: 4.0+ fit, 3.5 to 3.9 watch, below neutral, null a dim dash.
export default function Score({ value, size = 'lg' }: { value: string | number | null | undefined; size?: 'lg' | 'sm' }) {
  const n = scoreNum(value); const tone = toneOf(value);
  const total = size === 'lg' ? 14 : 9;
  const on = n === null ? 0 : Math.round((n / 5) * total);
  return (
    <span className={`score score-${size} score-${tone}`} aria-label={n === null ? 'Not scored' : `Score ${n.toFixed(1)} of 5`}>
      <span className="n">{n === null ? '–' : n.toFixed(1)}</span>
      <span className="segs" aria-hidden="true">{Array.from({ length: total }, (_, i) => <i key={i} className={i < on ? 'on' : ''} />)}</span>
    </span>
  );
}
