import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

async function ensureFolderPathAndGetId(client: Client, siteId: string, driveId: string, segments: string[]): Promise<string> {
  let parentPathEncoded = '';
  let parentId: string | null = null;
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const currentPathEncoded = parentPathEncoded
      ? `${parentPathEncoded}/${encodeURIComponent(segment)}`
      : encodeURIComponent(segment);
    try {
      const existing = await client
        .api(`/sites/${siteId}/drives/${driveId}/root:/${currentPathEncoded}`)
        .get();
      parentId = existing.id;
      parentPathEncoded = currentPathEncoded;
    } catch {
      const childrenApi = parentPathEncoded
        ? `/sites/${siteId}/drives/${driveId}/root:/${parentPathEncoded}:/children`
        : `/sites/${siteId}/drives/${driveId}/root/children`;
      const created = await client
        .api(childrenApi)
        .post({
          name: segment,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'fail',
        });
      parentId = created.id;
      parentPathEncoded = currentPathEncoded;
    }
  }
  if (!parentId) throw new Error('Failed to resolve or create parent folder');
  return parentId;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const projectName = body.projectName as string;
    const stage = (body.stage as string) || 'stage1';
    const fileName = body.fileName as string;
    const fileSize = body.fileSize as number | undefined;

    if (!projectName || !fileName) {
      return NextResponse.json({ error: 'projectName and fileName are required' }, { status: 400 });
    }

    const client = await getGraphClient();
    const site = await client.api('/sites/adamass.sharepoint.com:/sites/VoxStudiosplatform').get();
    const drives = await client.api(`/sites/${site.id}/drives`).get();
    const preferredDrive = (drives?.value || []).find((d: any) => /documents/i.test(d.name || '') || /shared documents/i.test(d.name || '')) || drives?.value?.[0];
    const driveId = preferredDrive?.id;
    if (!driveId) return NextResponse.json({ error: 'No document library found on site' }, { status: 500 });

    // Resolve parent folder id: {project}/{stage}/videos
    const folderSegments = [projectName, stage, 'videos'];
    const parentId = await ensureFolderPathAndGetId(client, site.id, driveId, folderSegments);

    const session = await client
      .api(`/sites/${site.id}/drives/${driveId}/items/${parentId}:/${encodeURIComponent(fileName)}:/createUploadSession`)
      .post({
        item: {
          '@microsoft.graph.conflictBehavior': 'rename',
          name: fileName,
        },
      });

    return NextResponse.json({ uploadUrl: session.uploadUrl, expirationDateTime: session.expirationDateTime });
  } catch (error) {
    console.error('Error creating upload session:', error);
    return NextResponse.json({ error: (error as Error).message || 'Failed to create upload session' }, { status: 500 });
  }
}


