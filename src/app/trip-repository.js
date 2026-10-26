/** Raw SDK results and errors; callers own normalization and conflict policy. */
function createTripRepository({client, tripId, offline, publishedReadMs = () => 8000}) {
  let subscription = null;

  async function fetchPublishedState() {
    if (offline || !client) return null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), publishedReadMs());
    try {
      const {data, error} = await client.from('trip_documents')
        .select('content,updated_at,revision').eq('trip_id', tripId)
        .abortSignal(controller.signal).maybeSingle();
      if (error) throw error;
      return data;
    } finally { clearTimeout(timeout); }
  }

  function saveDocument(content, revision, note, signal) {
    return client.rpc('save_trip_document', {
      p_trip_id: tripId, p_content: content,
      p_expected_revision: revision, p_version_note: note
    }).abortSignal(signal);
  }

  function readVersionMetadata(signal) {
    return client.from('trip_document_versions').select('id,note,content_size,created_at')
      .eq('trip_id', tripId).abortSignal(signal).order('created_at', {ascending:false}).limit(50);
  }

  function readVersionContent(id, signal) {
    return client.from('trip_document_versions').select('content')
      .eq('trip_id', tripId).eq('id', id).abortSignal(signal).single();
  }

  function subscribe(onUpdate, onStatus) {
    dispose();
    subscription = client.channel('trip-document-' + tripId);
    subscription.on('postgres_changes', {
      event:'UPDATE', schema:'public', table:'trip_documents', filter:'trip_id=eq.' + tripId
    }, onUpdate).subscribe(onStatus);
  }

  function dispose() {
    if (!subscription) return;
    const previous = subscription;
    subscription = null;
    if (client.removeChannel) void client.removeChannel(previous);
    else void previous.unsubscribe?.();
  }

  return Object.freeze({fetchPublishedState, saveDocument, readVersionMetadata, readVersionContent, subscribe, dispose});
}
