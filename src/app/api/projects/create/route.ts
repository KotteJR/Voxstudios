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
  try {
    const { projectName } = await request.json();
    if (!projectName) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    const client = await getGraphClient();
    const site = await client
      .api('/sites/adamass.sharepoint.com:/sites/VoxStudiosplatform')
      .get();
    const drives = await client.api(`/sites/${site.id}/drives`).get();
    const driveId = drives?.value?.[0]?.id;
    if (!driveId) {
      return NextResponse.json({ error: 'No document library found on site' }, { status: 500 });
    }

    await client
      .api(`/sites/${site.id}/drives/${driveId}/root/children`)
      .post({
        name: projectName,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'replace',
      });

    return NextResponse.json({ success: true, project: { id: projectName, name: projectName, createdAt: new Date().toISOString() } });
  } catch (error) {
    console.error('Error creating project in Teams:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}


