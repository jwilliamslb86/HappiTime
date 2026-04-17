'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function UserBar() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function signOut() {
    const supabase = await createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <div className="row" style={{ justifyContent: 'space-between' }}>
      <Link href="/dashboard" style={{ color: 'var(--brand)', fontSize: 18, fontWeight: 700 }}>HappiTime</Link>
      <div className="row">
        <span className="muted">{email ?? 'Signed in'}</span>
        <button className="secondary" onClick={signOut}>Sign out</button>
      </div>
    </div>
  );
}
