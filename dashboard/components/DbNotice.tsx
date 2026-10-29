// Database errors in the needs tone. The missing-connection-string diagnostic shows only when no connection string exists.
import { dbSource } from '@/lib/db';
export default function DbNotice({ error }: { error: string }) {
  const missing = !dbSource;
  const names = Object.keys(process.env).filter(n => /(DATABASE|POSTGRES|PG|NEON)/i.test(n)).sort().join(', ') || 'none';
  return (
    <div className="notice notice-needs" role="alert" style={{ marginBottom: 24 }}>
      <b>{missing ? 'Database not reachable.' : 'A database query failed.'}</b>{' '}
      {missing ? `No postgres:// URL found in this deployment's environment. Database-looking variables present: ${names}. Add Neon in the Storage tab, connect it to this project for Production, then redeploy.` : error}
    </div>
  );
}
