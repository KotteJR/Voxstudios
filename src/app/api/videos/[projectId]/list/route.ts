import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import { readdir } from 'fs/promises';
import path from 'path';

// Configure the API route
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getGraphClient() {
  const credential = new ClientSecretCredential(
    process.env.AZURE_TENANT_ID!,
    process.env.AZURE_CLIENT_ID!,
    process.env.AZURE_CLIENT_SECRET!
  );

  const token = await credential.getToken('https://graph.microsoft.com/.default');
  
  return Client.init({
    authProvider: (done) => {
      done(null, token.token);
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const projectId = params.projectId;
    
    // Check if Azure environment variables are set
    const hasAzureConfig = process.env.AZURE_TENANT_ID && process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET;
    
    if (!hasAzureConfig) {
      console.log('Azure environment variables not set, using local file system fallback');
      
      // Fallback to local file system for development
      try {
        const publicUploadsPath = path.join(process.cwd(), 'public', 'uploads');
        const videosPath = path.join(publicUploadsPath, projectId, 'stage4', 'final-videos');

        const files = await readdir(videosPath);
        const videos = files.filter(file => {
          const ext = path.extname(file).toLowerCase();
          return ['.mp4', '.webm', '.mov', '.avi', '.mkv'].includes(ext);
        });

        return NextResponse.json({
          success: true,
          videos: videos.map(name => ({
            name,
            url: `/uploads/${projectId}/stage4/final-videos/${encodeURIComponent(name)}`,
            webUrl: `/uploads/${projectId}/stage4/final-videos/${encodeURIComponent(name)}`,
            size: 0 // Local files don't have size info easily available
          }))
        });
      } catch (error) {
        console.error('Error reading local videos:', error);
        // If directory doesn't exist or can't be read, return empty list
        return NextResponse.json({
          success: true,
          videos: []
        });
      }
    }
    
    try {
      const client = await getGraphClient();
      const site = await client.api('/sites/adamass.sharepoint.com:/sites/VoxStudiosplatform').get();
      const drives = await client.api(`/sites/${site.id}/drives`).get();
      const driveId = drives?.value?.[0]?.id;
      
      if (!driveId) {
        return NextResponse.json({ error: 'No document library found on site' }, { status: 500 });
      }

      // Get videos from SharePoint stage4/final-videos folder
      const folderPath = `/sites/${site.id}/drives/${driveId}/root:/${encodeURIComponent(projectId)}/stage4/final-videos`;
      
      try {
        const children = await client
          .api(`${folderPath}:/children`)
          .select('name,size,webUrl,file')
          .top(999)
          .get();
        
        const videoFiles = (children.value || [])
          .filter((item: any) => {
            if (!item.file) return false;
            const ext = item.name.split('.').pop()?.toLowerCase();
            return ['.mp4', '.webm', '.mov', '.avi', '.mkv'].includes(`.${ext}`);
          })
          .map((item: any) => ({
            name: item.name,
            url: `/api/video-proxy?filePath=${encodeURIComponent(`${projectId}/stage4/final-videos/${item.name}`)}&siteId=${site.id}&driveId=${driveId}`,
            webUrl: item.webUrl,
            size: item.size
          }));

        return NextResponse.json({
          success: true,
          videos: videoFiles
        });
      } catch (error) {
        console.error('Error accessing final-videos folder:', error);
        // If folder doesn't exist, return empty list
        return NextResponse.json({
          success: true,
          videos: []
        });
      }
    } catch (error) {
      console.error('Error connecting to SharePoint:', error);
      return NextResponse.json({
        success: true,
        videos: []
      });
    }
  } catch (error) {
    console.error('Error listing videos:', error);
    return NextResponse.json(
      { error: 'Failed to list videos' },
      { status: 500 }
    );
  }
} 