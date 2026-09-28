export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function notFoundResponse() {
  return new Response('Not Found', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

export function GET() {
  return notFoundResponse();
}

export function HEAD() {
  return notFoundResponse();
}
