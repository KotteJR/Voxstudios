import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';

async function getGraphClient() {
  const credential = new ClientSecretCredential(
    process.env.AZURE_TENANT_ID as string,
    process.env.AZURE_CLIENT_ID as string,
    process.env.AZURE_CLIENT_SECRET as string
  );
  const token = await credential.getToken('https://graph.microsoft.com/.default');
  if (!token?.token) throw new Error('Failed to acquire Graph token');
  return Client.init({ authProvider: (done) => done(null, token.token) });
}

export async function POST(request: NextRequest) {
  const { projectId, category, name } = await request.json();
  if (!projectId || !category || !name) {
    return NextResponse.json({ error: 'projectId, category, and name are required' }, { status: 400 });
  }
  try {
    const client = await getGraphClient();
    const site = await client.api('/sites/adamass.sharepoint.com:/sites/VoxStudiosplatform').get();
    const drives = await client.api(`/sites/${site.id}/drives`).get();
    const driveId = drives?.value?.[0]?.id;
    if (!driveId) return NextResponse.json({ error: 'No document library found on site' }, { status: 500 });

    const item = await client
      .api(`/sites/${site.id}/drives/${driveId}/root:/${encodeURIComponent(projectId)}/${encodeURIComponent(category)}/${encodeURIComponent(name)}`)
      .get();

    if (!item?.id) return NextResponse.json({ error: 'File not found' }, { status: 404 });
    await client.api(`/sites/${site.id}/drives/${driveId}/items/${item.id}`).delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}


