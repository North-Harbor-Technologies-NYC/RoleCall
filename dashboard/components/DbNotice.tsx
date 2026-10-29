// Database errors in the needs tone, with the existing diagnostic text for a missing connection string.
export default function DbNotice({ error }: { error: string }) {
  const missing = error.includes('invalid') || error.includes('Wrong URL scheme');
  const names = Object.keys(process.env).filter(n => /(DATABASE|POSTGRES|PG|NEON)/i.test(n)).sort().join(', ') || 'none';
  return (
    <div className="notice notice-needs" role="alert" style={{ marginBottom: 24 }}>
      <b>Database not reachable.</b>{' '}
      {missing ? `No postgres:// URL found in this deployment's environment. Database-looking variables present: ${names}. Add Neon in the Storage tab, connect it to this project for Production, then redeploy.` : error}
    </div>
  );
}
