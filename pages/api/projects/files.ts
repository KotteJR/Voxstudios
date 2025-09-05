import { NextApiRequest, NextApiResponse } from 'next';
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const projectId = (req.query.projectId as string) || (req.body?.projectId as string);
  if (!projectId) return res.status(400).json({ error: 'projectId is required' });

  try {
    const client = await getGraphClient();
    const site = await client
      .api('/sites/adamass.sharepoint.com:/sites/VoxStudiosplatform')
      .get();
    const drives = await client.api(`/sites/${site.id}/drives`).get();
    const driveId = drives?.value?.[0]?.id;
    if (!driveId) return res.status(500).json({ error: 'No document library found on site' });

    const categories = ['videos', 'voices', 'documents'] as const;
    const result: Record<string, Array<{ name: string; size: number; webUrl: string; mimeType?: string }>> = {
      videos: [],
      voices: [],
      documents: []
    };

    for (const cat of categories) {
      try {
        // Try to list the folder; if not found, skip
        const folderPath = `/sites/${site.id}/drives/${driveId}/root:/${encodeURIComponent(projectId)}/${cat}`;
        const children = await client
          .api(`${folderPath}:/children`)
          .select('name,size,webUrl,file')
          .top(999)
          .get();
        const files = (children.value || [])
          .filter((item: any) => !!item.file)
          .map((item: any) => ({
            name: item.name,
            size: item.size,
            webUrl: item.webUrl,
            mimeType: item.file?.mimeType
          }));
        (result as any)[cat] = files;
      } catch (e) {
        // Folder might not exist; keep empty and continue
        (result as any)[cat] = [];
      }
    }

    return res.status(200).json({ success: true, files: result });
  } catch (error) {
    console.error('Error listing project files:', error);
    return res.status(500).json({ error: 'Failed to list project files' });
  }
}


