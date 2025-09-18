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
    const { projectName, voiceTitle, sourceFileName } = await request.json();
    if (!projectName || !voiceTitle || !sourceFileName) {
      return NextResponse.json({ error: 'projectName, voiceTitle and sourceFileName are required' }, { status: 400 });
    }

    const client = await getGraphClient();
    const site = await client.api('/sites/adamass.sharepoint.com:/sites/VoxStudiosplatform').get();
    const drives = await client.api(`/sites/${site.id}/drives`).get();
    const preferredDrive = (drives?.value || []).find((d: any) => /documents/i.test(d.name || '') || /shared documents/i.test(d.name || '')) || drives?.value?.[0];
    const driveId = preferredDrive?.id;
    if (!driveId) return NextResponse.json({ error: 'No document library found on site' }, { status: 500 });

    // Read source file content from stage2/voices
    const srcPath = `/sites/${site.id}/drives/${driveId}/root:/${encodeURIComponent(projectName)}/stage2/voices/${encodeURIComponent(sourceFileName)}`;
    const content = await client.api(`${srcPath}:/content`).get();
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(await new Response(content as any).arrayBuffer());

    // Ensure destination folders
    const ensure = async (parent: string | null, name: string) => {
      const parentChildren = parent ? `root:/${parent}:/children` : 'root/children';
      try {
        const check = parent ? `root:/${parent}/${encodeURIComponent(name)}` : `root:/${encodeURIComponent(name)}`;
        await client.api(`/sites/${site.id}/drives/${driveId}/${check}`).get();
      } catch {
        await client.api(`/sites/${site.id}/drives/${driveId}/${parentChildren}`).post({ name, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' });
      }
    };

    const proj = encodeURIComponent(projectName);
    await ensure(null, projectName);
    await ensure(`${proj}`, 'stage3');
    await ensure(`${proj}/stage3`, 'voices');
    await ensure(`${proj}/stage3/voices`, voiceTitle);

    // Write to destination stage3/voices/{voiceTitle}/{sourceFileName}
    const destPath = `/sites/${site.id}/drives/${driveId}/root:/${encodeURIComponent(projectName)}/stage3/voices/${encodeURIComponent(voiceTitle)}/${encodeURIComponent(sourceFileName)}:/content`;
    await client.api(destPath).put(buffer);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error copying voice to stage3:', error);
    return NextResponse.json({ error: 'Failed to copy voice to stage3' }, { status: 500 });
  }
}


