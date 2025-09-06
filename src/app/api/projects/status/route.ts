import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';

const defaultStages = [
  {
    id: 1,
    title: 'Stage 1: Original Video Campaign',
    description: 'Upload and process the original video',
    href: '/stage1/dashboard',
    status: 'in_progress',
    steps: [
      { title: 'Original Video Campaign', description: 'Upload and manage your original video content', component: 'VideoUpload', status: 'in_progress' },
      { title: 'Auditioning Brief', description: 'Create and review the auditioning requirements', component: 'AuditioningBrief', status: 'pending' },
      { title: 'Voice Selection', description: 'Listen to and manage voice auditions', component: 'VoiceSelection', status: 'pending' }
    ]
  },
  {
    id: 2,
    title: 'Stage 2: Script & Timestamps',
    description: 'Define script and set timestamps',
    href: '/stage2/dashboard',
    status: 'pending',
    steps: [
      { title: 'Script Upload', description: 'Upload and manage your script', component: 'ScriptUpload', status: 'pending' },
      { title: 'Timestamp Editor', description: 'Set and edit timestamps for your script', component: 'TimestampEditor', status: 'pending' }
    ]
  },
  {
    id: 3,
    title: 'Stage 3: Voice Selection',
    description: 'Review and select voice options',
    href: '/stage3/dashboard',
    status: 'pending',
    steps: [
      { title: 'Base Voice Selection', description: 'Choose your preferred base voice', component: 'BaseVoiceSelection', status: 'pending' },
      { title: 'Custom Voice Selection', description: 'Review and select custom voice options', component: 'CustomVoiceSelection', status: 'pending' }
    ]
  },
  {
    id: 4,
    title: 'Stage 4: Final Review',
    description: 'Choose and approve the final voice',
    href: '/stage4/dashboard',
    status: 'pending',
    steps: [
      { title: 'Final Voice Review', description: 'Review and approve the final voice output', component: 'FinalVoiceReview', status: 'pending' }
    ]
  }
];

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
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }
  try {
    const client = await getGraphClient();
    const site = await client.api('/sites/adamass.sharepoint.com:/sites/VoxStudiosplatform').get();
    const drives = await client.api(`/sites/${site.id}/drives`).get();
    const driveId = drives?.value?.[0]?.id;
    if (!driveId) return NextResponse.json({ error: 'No document library found on site' }, { status: 500 });

    const filePath = `/sites/${site.id}/drives/${driveId}/root:/${encodeURIComponent(projectId)}/status.json`;
    try {
      const content = await client.api(`${filePath}:/content`).get();
      const text = typeof content === 'string' ? content : JSON.stringify(content);
      const data = JSON.parse(text);
      return NextResponse.json({ success: true, stages: data.stages || data });
    } catch {
      return NextResponse.json({ success: true, stages: defaultStages });
    }
  } catch (error) {
    console.error('Error reading project status:', error);
    return NextResponse.json({ error: 'Failed to handle project status' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const queryProjectId = url.searchParams.get('projectId');
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const projectId = body.projectId || queryProjectId;
  const stages = body.stages;
  if (!projectId || !stages) {
    return NextResponse.json({ error: 'projectId and stages are required' }, { status: 400 });
  }
  try {
    const client = await getGraphClient();
    const site = await client.api('/sites/adamass.sharepoint.com:/sites/VoxStudiosplatform').get();
    const drives = await client.api(`/sites/${site.id}/drives`).get();
    const driveId = drives?.value?.[0]?.id;
    if (!driveId) return NextResponse.json({ error: 'No document library found on site' }, { status: 500 });

    const filePath = `/sites/${site.id}/drives/${driveId}/root:/${encodeURIComponent(projectId)}/status.json`;
    const buffer = Buffer.from(JSON.stringify({ stages }, null, 2));
    await client.api(`${filePath}:/content`).put(buffer);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error writing project status:', error);
    return NextResponse.json({ error: 'Failed to handle project status' }, { status: 500 });
  }
}


