require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

(async () => {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) {
      console.error('Faltando env NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_KEY');
      process.exit(1);
    }
    const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

    // Verificar buckets
    const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
    if (listErr) {
      console.error('Erro listBuckets:', listErr);
      process.exit(1);
    }

    const exists = (buckets || []).some(b => b.name === 'profile-photos');
    if (!exists) {
      console.log('Criando bucket profile-photos (publico)...');
      const { error: createErr } = await supabase.storage.createBucket('profile-photos', {
        public: true,
        fileSizeLimit: 5 * 1024 * 1024,
        allowedMimeTypes: ['image/jpeg','image/png','image/webp','image/gif']
      });
      if (createErr) {
        console.error('Erro createBucket:', createErr);
        process.exit(1);
      }
    } else {
      console.log('Bucket profile-photos já existe. Atualizando para público...');
      const { error: updErr } = await supabase.storage.updateBucket('profile-photos', { public: true });
      if (updErr) {
        console.error('Erro updateBucket:', updErr);
      }
    }

    const { data: pub } = supabase.storage.from('profile-photos').getPublicUrl('healthcheck.txt');
    console.log('Bucket OK. publicUrl exemplo:', pub?.publicUrl || null);
    process.exit(0);
  } catch (e) {
    console.error('Falha geral:', e);
    process.exit(1);
  }
})();

