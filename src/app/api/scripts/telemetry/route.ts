export async function GET() {
  // Pulse Analytics: telemetry is permanently disabled. This endpoint exists
  // only so existing references resolve to an inert script; it never loads
  // any external pixel or contacts the original project's servers.
  return new Response('/* telemetry disabled */', {
    headers: {
      'content-type': 'text/javascript',
    },
  });
}
