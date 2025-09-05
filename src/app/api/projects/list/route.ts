import { NextResponse } from 'next/server';
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

export async function GET() {
  try {
    const client = await getGraphClient();
    const site = await client
      .api('/sites/adamass.sharepoint.com:/sites/VoxStudiosplatform')
      .get();
    const drives = await client.api(`/sites/${site.id}/drives`).get();
    const driveId = drives?.value?.[0]?.id;
    if (!driveId) {
      return NextResponse.json({ error: 'No document library found on site' }, { status: 500 });
    }

    const children = await client
      .api(`/sites/${site.id}/drives/${driveId}/root/children`)
      .select('id,name,folder,createdDateTime')
      .top(999)
      .get();

    const folders = (children.value || []).filter((item: any) => item.folder);
    const projects = folders.map((item: any) => ({
      id: item.name,
      name: item.name,
      createdAt: item.createdDateTime || new Date().toISOString(),
    }));

    projects.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Error listing Teams/SharePoint projects:', error);
    return NextResponse.json({ error: 'Failed to list projects' }, { status: 500 });
  }
}


