import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

// Configure the API route
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    console.log('Video upload request received');
    
    // Get the form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('projectId') as string;
    const title = formData.get('title') as string;

    console.log('Form data:', { 
      fileName: file?.name, 
      fileSize: file?.size, 
      fileType: file?.type,
      projectId, 
      title 
    });

    if (!file || !projectId || !title) {
      console.error('Missing required fields:', { file: !!file, projectId, title });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate file name
    const fileName = `${title}${getFileExtension(file.name)}`;
    console.log('Generated file name:', fileName);

    // Check if Azure environment variables are set
    const hasAzureConfig = process.env.AZURE_TENANT_ID && process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET;
    
    if (!hasAzureConfig) {
      console.log('Azure environment variables not set, using local file system fallback');
      
      // Fallback to local file system for development
      try {
        const publicUploadsPath = path.join(process.cwd(), 'public', 'uploads');
        const projectPath = path.join(publicUploadsPath, projectId);
        const stage4Path = path.join(projectPath, 'stage4');
        const finalVideosPath = path.join(stage4Path, 'final-videos');
        
        try {
          await mkdir(finalVideosPath, { recursive: true });
        } catch (error) {
          console.error('Error creating directories:', error);
        }

        // Generate file path and URL
        const filePath = path.join(finalVideosPath, fileName);
        const publicUrl = `/uploads/${projectId}/stage4/final-videos/${encodeURIComponent(fileName)}`;

        // Convert File to Buffer and save it
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await writeFile(filePath, buffer);

        console.log('Video saved locally to:', filePath);

        return NextResponse.json({
          success: true,
          file: {
            name: fileName,
            url: publicUrl,
            webUrl: publicUrl
          }
        });
      } catch (error) {
        console.error('Error saving video locally:', error);
        return NextResponse.json(
          { 
            error: 'Failed to save video locally',
            details: error instanceof Error ? error.message : 'Unknown error'
          },
          { status: 500 }
        );
      }
    }

    try {
      console.log('Getting Azure credentials...');
      // Get access token using client credentials
      const credential = new ClientSecretCredential(
        process.env.AZURE_TENANT_ID!,
        process.env.AZURE_CLIENT_ID!,
        process.env.AZURE_CLIENT_SECRET!
      );

      console.log('Getting token...');
      const token = await credential.getToken('https://graph.microsoft.com/.default');
      
      console.log('Initializing Graph client...');
      // Initialize Graph client
      const client = Client.init({
        authProvider: (done) => {
          done(null, token.token);
        },
      });

      console.log('Getting SharePoint site...');
      // Get SharePoint site and drive
      const site = await client.api('/sites/adamass.sharepoint.com:/sites/VoxStudiosplatform').get();
      console.log('Site ID:', site.id);

      console.log('Getting drive...');
      const drive = await client.api(`/sites/${site.id}/drives`).get();
      console.log('Drive ID:', drive.value[0]?.id);

      // Upload to SharePoint in stage4/final-videos folder
      const folderPath = `${projectId}/stage4/final-videos/${fileName}`;
      console.log('Uploading to path:', folderPath);
      
      const fileBuffer = await file.arrayBuffer();
      console.log('File buffer size:', fileBuffer.byteLength);
      
      const response = await client.api(`/sites/${site.id}/drives/${drive.value[0].id}/items/root:/${folderPath}:/content`)
        .put(fileBuffer);

      console.log('Upload successful:', response);

      // Create proxy URL for video playback
      const proxyVideoUrl = `/api/video-proxy?filePath=${encodeURIComponent(folderPath)}&siteId=${site.id}&driveId=${drive.value[0].id}`;

      return NextResponse.json({
        success: true,
        file: {
          name: fileName,
          url: proxyVideoUrl,
          webUrl: response.webUrl
        }
      });

    } catch (error) {
      console.error('Error uploading video to SharePoint:', error);
      return NextResponse.json(
        { 
          error: 'Failed to upload video to SharePoint',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error uploading video:', error);
    return NextResponse.json(
      { 
        error: 'Failed to upload video',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function getFileExtension(filename: string): string {
  const ext = filename.split('.').pop();
  return ext ? `.${ext}` : '';
} 