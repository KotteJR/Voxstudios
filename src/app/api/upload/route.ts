import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';

// Configure the API route to handle large files
export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

export async function POST(request: NextRequest) {
  try {
    if (!request.body) {
      return NextResponse.json({ error: 'No request body' }, { status: 400 });
    }

    // Parse the multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const projectName = formData.get('projectName') as string;
    
    console.log('Received upload request:', {
      fileName: file?.name,
      fileType: file?.type,
      fileSize: file?.size,
      projectName
    });

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    if (!projectName) {
      return NextResponse.json(
        { error: 'No project specified' },
        { status: 400 }
      );
    }

    // Validate file type - allow video, text, audio, and PDF files
    if (!file.type.startsWith('video/') && 
        !file.type.startsWith('text/') && 
        !file.type.startsWith('audio/') && 
        file.type !== 'application/pdf') {
      console.log('Invalid file type:', file.type);
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}. Only video, text, audio, and PDF files are allowed` },
        { status: 400 }
      );
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
      
      // Initialize Graph client
      const client = Client.init({
        authProvider: (done) => {
          done(null, token.token);
        },
      });

      console.log('Getting SharePoint site...');
      // First get the site
      const site = await client.api('/sites/adamass.sharepoint.com:/sites/VoxStudiosplatform')
        .get();

      console.log('Getting drive...');
      // Then get the drive
      const drive = await client.api(`/sites/${site.id}/drives`)
        .get();

      // Create folder structure for different file types
      let folderPath = projectName;
      if (file.type.startsWith('audio/')) {
        folderPath += '/voices';
      } else if (file.type.startsWith('video/')) {
        folderPath += '/videos';
      } else if (file.type.startsWith('text/')) {
        folderPath += '/documents';
      }

      // Get the project folder path
      const projectFolderPath = `${folderPath}/${file.name}`;
      console.log('Uploading to path:', projectFolderPath);

      // Upload to the project folder
      const fileBuffer = await file.arrayBuffer();
      console.log('File buffer size:', fileBuffer.byteLength);
      
      const response = await client.api(`/sites/${site.id}/drives/${drive.value[0].id}/items/root:/${projectFolderPath}:/content`)
        .put(fileBuffer);

      console.log('Upload successful:', response);

      return NextResponse.json({ 
        success: true,
        message: `File uploaded successfully to project folder: ${projectFolderPath}`,
        fileUrl: response.webUrl
      });

    } catch (err) {
      console.error('Failed to upload to SharePoint:', err);
      return NextResponse.json(
        { error: 'Failed to upload to SharePoint: ' + (err as Error).message },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file: ' + (error as Error).message },
      { status: 500 }
    );
  }
} 