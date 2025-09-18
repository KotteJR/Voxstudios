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

export async function POST(request: NextRequest) {
  try {
    const { projectName, voiceTitle } = await request.json();
    if (!projectName || !voiceTitle) {
      return NextResponse.json({ error: 'projectName and voiceTitle are required' }, { status: 400 });
    }

    const sanitized = String(voiceTitle).replace(/[\\/:*?"<>|#%&{}~]/g, '_').trim();
    if (!sanitized) return NextResponse.json({ error: 'Invalid voiceTitle' }, { status: 400 });

    const client = await getGraphClient();
    const site = await client.api('/sites/adamass.sharepoint.com:/sites/VoxStudiosplatform').get();
    const drives = await client.api(`/sites/${site.id}/drives`).get();
    const preferredDrive = (drives?.value || []).find((d: any) => /documents/i.test(d.name || '') || /shared documents/i.test(d.name || '')) || drives?.value?.[0];
    const driveId = preferredDrive?.id;
    if (!driveId) return NextResponse.json({ error: 'No document library found on site' }, { status: 500 });

    // Ensure stage3 and voices folder exist
    const ensureChild = async (parentPath: string | null, name: string) => {
      const parent = parentPath ? `root:/${parentPath}:/children` : 'root/children';
      try {
        const checkPath = parentPath ? `root:/${parentPath}/${encodeURIComponent(name)}` : `root:/${encodeURIComponent(name)}`;
        await client.api(`/sites/${site.id}/drives/${driveId}/${checkPath}`).get();
      } catch {
        await client.api(`/sites/${site.id}/drives/${driveId}/${parent}`).post({
          name,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'fail',
        });
      }
    };

    const proj = encodeURIComponent(projectName);
    await ensureChild(null, projectName);
    await ensureChild(`${proj}`, 'stage3');
    await ensureChild(`${proj}/stage3`, 'voices');
    await ensureChild(`${proj}/stage3/voices`, sanitized);

    return NextResponse.json({ success: true, folder: `${projectName}/stage3/voices/${sanitized}` });
  } catch (error) {
    console.error('Error creating stage3 voice folder:', error);
    return NextResponse.json({ error: 'Failed to create stage3 voice folder' }, { status: 500 });
  }
}


