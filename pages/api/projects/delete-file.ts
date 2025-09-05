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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { projectId, category, name } = req.body || {};
  if (!projectId || !category || !name) {
    return res.status(400).json({ error: 'projectId, category, and name are required' });
  }

  try {
    const client = await getGraphClient();
    const site = await client
      .api('/sites/adamass.sharepoint.com:/sites/VoxStudiosplatform')
      .get();
    const drives = await client.api(`/sites/${site.id}/drives`).get();
    const driveId = drives?.value?.[0]?.id;
    if (!driveId) return res.status(500).json({ error: 'No document library found on site' });

    // Resolve item ID via path lookup
    const item = await client
      .api(`/sites/${site.id}/drives/${driveId}/root:/${encodeURIComponent(projectId)}/${encodeURIComponent(category)}/${encodeURIComponent(name)}`)
      .get();

    if (!item?.id) return res.status(404).json({ error: 'File not found' });

    await client.api(`/sites/${site.id}/drives/${driveId}/items/${item.id}`).delete();

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    return res.status(500).json({ error: 'Failed to delete file' });
  }
}


