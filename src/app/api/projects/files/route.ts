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

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('projectId');
  if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 });

  try {
    const client = await getGraphClient();
    const site = await client.api('/sites/adamass.sharepoint.com:/sites/VoxStudiosplatform').get();
    const drives = await client.api(`/sites/${site.id}/drives`).get();
    const driveId = drives?.value?.[0]?.id;
    if (!driveId) return NextResponse.json({ error: 'No document library found on site' }, { status: 500 });

    const categories = ['videos', 'voices', 'documents'] as const;
    const result: Record<string, Array<{ name: string; size: number; webUrl: string; mimeType?: string }>> = { videos: [], voices: [], documents: [] };

    for (const cat of categories) {
      try {
        const folderPath = `/sites/${site.id}/drives/${driveId}/root:/${encodeURIComponent(projectId)}/${cat}`;
        const children = await client
          .api(`${folderPath}:/children`)
          .select('name,size,webUrl,file')
          .top(999)
          .get();
        const files = (children.value || [])
          .filter((item: any) => !!item.file)
          .map((item: any) => ({ name: item.name, size: item.size, webUrl: item.webUrl, mimeType: item.file?.mimeType }));
        (result as any)[cat] = files;
      } catch {
        (result as any)[cat] = [];
      }
    }

    return NextResponse.json({ success: true, files: result });
  } catch (error) {
    console.error('Error listing project files:', error);
    return NextResponse.json({ error: 'Failed to list project files' }, { status: 500 });
  }
}


