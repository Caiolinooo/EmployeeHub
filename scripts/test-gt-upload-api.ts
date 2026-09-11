/**
 * Live API check: upload a tiny JPEG as passaporte + PUT fields.
 * Run: npx tsx scripts/test-gt-upload-api.ts
 */
import * as dotenv from 'dotenv';
import path from 'path';
import jwt from 'jsonwebtoken';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const BASE = process.env.GT_TEST_BASE_URL || 'http://localhost:3000';

function tinyJpeg(): Buffer {
  // Minimal 1x1 JPEG
  return Buffer.from(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcP//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEABj8Cf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAT8hf//Z',
    'base64'
  );
}

async function main() {
  const { supabaseAdmin } = await import('../src/lib/supabase');
  const { getJwtSecret } = await import('../src/lib/jwt-secret');

  const { data: user } = await supabaseAdmin
    .from('users_unified')
    .select('id, email, role, first_name, last_name')
    .eq('role', 'ADMIN')
    .limit(1)
    .maybeSingle();
  if (!user) throw new Error('Nenhum ADMIN em users_unified');

  const { data: colab } = await supabaseAdmin
    .from('gt_colaboradores')
    .select('id, nome_completo')
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();
  if (!colab) throw new Error('Nenhum colaborador');

  const token = jwt.sign(
    {
      userId: user.id,
      phoneNumber: '',
      role: user.role,
    },
    getJwtSecret(),
    { expiresIn: '15m' }
  );

  const jpeg = tinyJpeg();
  const file = new File([jpeg], 'passaporte.jpg', { type: '' });
  const fd = new FormData();
  fd.append('file', file);
  fd.append('colaborador_id', colab.id);
  fd.append('tipo_documento', 'passaporte');
  fd.append('titulo', 'Passaporte TESTE-HELPER');

  const upRes = await fetch(`${BASE}/api/gestao-tripulantes/documentos/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const upJson = await upRes.json().catch(() => ({}));
  console.log('UPLOAD status', upRes.status, upJson.error || upJson.message || 'ok', upJson.data?.id || '');
  if (!upRes.ok) {
    throw new Error(`upload ${upRes.status}: ${JSON.stringify(upJson)}`);
  }

  const docId = upJson.data.id as string;

  const putRes = await fetch(`${BASE}/api/gestao-tripulantes/documentos/${docId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      numero_documento: 'FG999888',
      orgao_emissor: 'POLICIA FEDERAL',
      data_emissao: '2022-03-12',
      data_validade: '2032-03-11',
    }),
  });
  const putJson = await putRes.json().catch(() => ({}));
  console.log('PUT doc status', putRes.status, putJson.data?.numero_documento, putJson.data?.status_validacao);
  if (!putRes.ok) throw new Error(`put doc ${putRes.status}: ${JSON.stringify(putJson)}`);
  if (putJson.data?.numero_documento !== 'FG999888') throw new Error('numero_documento not persisted');

  const colPut = await fetch(`${BASE}/api/gestao-tripulantes/colaboradores/${colab.id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ telefone: colab ? undefined : null }),
  });
  const colJson = await colPut.json().catch(() => ({}));
  console.log('PUT colaborador status', colPut.status, colJson.success);

  // cleanup test doc
  await supabaseAdmin
    .from('gt_documentos')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', docId);

  // Second type: CNH (empty MIME, jpeg extension)
  const fd2 = new FormData();
  fd2.append('file', new File([jpeg], 'cnh.jpg', { type: '' }));
  fd2.append('colaborador_id', colab.id);
  fd2.append('tipo_documento', 'cnh');
  fd2.append('titulo', 'CNH TESTE-HELPER');
  const up2 = await fetch(`${BASE}/api/gestao-tripulantes/documentos/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd2,
  });
  const up2Json = await up2.json().catch(() => ({}));
  console.log('UPLOAD cnh status', up2.status, up2Json.error || up2Json.message || 'ok');
  if (!up2.ok) throw new Error(`cnh upload ${up2.status}: ${JSON.stringify(up2Json)}`);
  if (up2Json.data?.id) {
    await supabaseAdmin
      .from('gt_documentos')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', up2Json.data.id);
  }

  console.log('OK: upload 2xx + PUT passaporte persistiu');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
