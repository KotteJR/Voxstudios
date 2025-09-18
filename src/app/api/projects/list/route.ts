import { NextResponse } from 'next/server';
import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    const preferredDrive = (drives?.value || []).find((d: any) =>
      /documents/i.test(d.name || '') || /shared documents/i.test(d.name || '')
    ) || drives?.value?.[0];
    const driveId = preferredDrive?.id;
    if (!driveId) {
      return NextResponse.json({ error: 'No document library found on site' }, { status: 500 });
    }

    // Page through children to ensure we get all project folders
    let items: any[] = [];
    let request = client
      .api(`/sites/${site.id}/drives/${driveId}/root/children`)
      .select('id,name,folder,createdDateTime')
      .top(200);

    // First page
    let page = await request.get();
    items = items.concat(page.value || []);
    // Next pages
    while (page['@odata.nextLink']) {
      page = await client.api(page['@odata.nextLink']).get();
      items = items.concat(page.value || []);
    }

    const reserved = new Set([
      'stage1', 'stage2', 'stage3', 'stage4',
      'videos', 'voices', 'documents', 'voice-feedback', 'AI-voices'
    ]);
    const folders = items.filter((item: any) => item.folder && !reserved.has(item.name));
    const projects = folders.map((item: any) => ({
      id: item.name,
      name: item.name,
      createdAt: item.createdDateTime || new Date().toISOString(),
    }));

    projects.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return NextResponse.json({ projects }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error listing Teams/SharePoint projects:', error);
    return NextResponse.json({ error: 'Failed to list projects' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}


