import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';

// Configure the API route to handle large files
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes timeout

export async function POST(request: NextRequest) {
  try {
    if (!request.body) {
      return NextResponse.json({ error: 'No request body' }, { status: 400 });
    }

    // Parse the multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const projectName = formData.get('projectName') as string;
    const folderName = formData.get('folderName') as string;
    const stage = formData.get('stage') as string;
    
    console.log('Received upload request:', {
      fileName: file?.name,
      fileType: file?.type,
      fileSize: file?.size,
      projectName,
      stage,
      folderName
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

    // Validate file type - allow video, text, audio, PDF, and common document types
    const allowedApplicationTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/rtf',
      'text/rtf',
    ];
    if (!file.type.startsWith('video/') && 
        !file.type.startsWith('text/') && 
        !file.type.startsWith('audio/') && 
        !allowedApplicationTypes.includes(file.type)) {
      console.log('Invalid file type:', file.type);
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}. Only video, text, audio, and common document files are allowed` },
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

      // Create folder structure based on stage and file type
      let folderPath = projectName;
      
      if (stage) {
        // Use stage-based folder structure
        folderPath += `/${stage}`;
        
        if (folderName) {
          // Use custom folder name within the stage
          folderPath += `/${folderName}`;
        } else {
          // Determine subfolder based on file type
          if (file.type.startsWith('audio/')) {
            folderPath += '/voices';
          } else if (file.type.startsWith('video/')) {
            folderPath += '/videos';
          } else if (file.type.startsWith('text/') || allowedApplicationTypes.includes(file.type)) {
            folderPath += '/documents';
          }
        }
      } else if (folderName) {
        // Legacy: Use custom folder name if provided (for backward compatibility)
        folderPath += `/${folderName}`;
      } else {
        // Legacy: Use file type-based folders (for backward compatibility)
        if (file.type.startsWith('audio/')) {
          folderPath += '/voices';
        } else if (file.type.startsWith('video/')) {
          folderPath += '/videos';
        } else if (file.type.startsWith('text/') || allowedApplicationTypes.includes(file.type)) {
          folderPath += '/documents';
        }
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
        fileUrl: response.webUrl,
        filePath: projectFolderPath,
        siteId: site.id,
        driveId: drive.value[0].id
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