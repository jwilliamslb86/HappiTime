'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
  insertVenueMedia,
  listVenueMedia,
  type MediaRow,
  type MediaType,
} from '@/services/media-store';


export default function VenueMediaUploader(props: { orgId: string; venueId: string }) {
  const { orgId, venueId } = props;
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null);
  const [rows, setRows] = useState<MediaRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setSupabase(createClient());
  }, []);

  async function refresh() {
    if (!supabase) return;

    const result = await listVenueMedia(supabase, orgId, venueId);
    if (result.error) {
      setErrorMessage(result.error);
      return;
    }
    setErrorMessage(null);
    setRows(result.data);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, venueId]);

  async function onUpload(file: File) {
    setBusy(true);
    try {
      if (!supabase) {
        alert('Supabase client not initialized');
        return;
      }

      const ext = file.name.split('.').pop() ?? 'bin';
      const path = `${orgId}/${venueId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('venue-media')
        .upload(path, file, { upsert: false });

      if (uploadError) throw uploadError;

      const type: MediaType =
        file.type.startsWith('video/')
          ? 'video'
          : file.type === 'application/pdf'
            ? 'menu_pdf'
            : 'image';

      const insertResult = await insertVenueMedia(supabase, {
        org_id: orgId,
        venue_id: venueId,
        type,
        title: file.name,
        storage_path: path,
      });

      if (insertResult.error) {
        throw new Error(insertResult.error);
      }

      await refresh();
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="col">
      <div className="row">
        <input
          type="file"
          accept="image/*,video/*,application/pdf"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onUpload(f);
            e.currentTarget.value = '';
          }}
        />
      </div>

      <div className="col">
        {errorMessage ? (
          <div className="card error">
            <strong>Media error</strong>
            <div className="muted">{errorMessage}</div>
          </div>
        ) : null}
        {rows.length === 0 ? (
          <p className="muted">No media yet.</p>
        ) : (
          rows.map((r) => {
            if (!supabase) return null;
            const publicUrl = supabase.storage.from('venue-media').getPublicUrl(r.storage_path).data.publicUrl;
            return (
              <div key={r.id} className="card">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div className="col" style={{ gap: 4 }}>
                    <strong>{r.title ?? r.type}</strong>
                    <span className="muted">{r.type} • {new Date(r.created_at).toLocaleString()}</span>
                  </div>
                  <a href={publicUrl} target="_blank" rel="noreferrer">
                    <button className="secondary">Open</button>
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
