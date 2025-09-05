import { NextApiRequest, NextApiResponse } from 'next';
import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Acquire app token for Microsoft Graph
    const credential = new ClientSecretCredential(
      process.env.AZURE_TENANT_ID as string,
      process.env.AZURE_CLIENT_ID as string,
      process.env.AZURE_CLIENT_SECRET as string
    );

    const token = await credential.getToken('https://graph.microsoft.com/.default');
    if (!token?.token) {
      return res.status(500).json({ error: 'Failed to acquire Graph token' });
    }

    const client = Client.init({
      authProvider: (done) => done(null, token.token),
    });

    // Locate SharePoint site used for storage (same as upload route)
    const site = await client
      .api('/sites/adamass.sharepoint.com:/sites/VoxStudiosplatform')
      .get();

    // Use the primary document library (first drive)
    const drives = await client.api(`/sites/${site.id}/drives`).get();
    const driveId = drives?.value?.[0]?.id;
    if (!driveId) {
      return res.status(500).json({ error: 'No document library found on site' });
    }

    // List top-level folders (projects) under the root of the document library
    const children = await client
      .api(`/sites/${site.id}/drives/${driveId}/root/children`)
      .select('id,name,folder,createdDateTime')
      .top(999)
      .get();

    const folders = (children.value || []).filter((item: any) => item.folder);
    const projects = folders.map((item: any) => ({
      id: item.name,        // use folder name as id to match existing usage
      name: item.name,
      createdAt: item.createdDateTime || new Date().toISOString(),
    }));

    // Sort by creation date desc
    projects.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return res.status(200).json({ projects });
  } catch (error) {
    console.error('Error listing Teams/SharePoint projects:', error);
    return res.status(500).json({ error: 'Failed to list projects' });
  }
} 