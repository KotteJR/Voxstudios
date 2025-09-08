import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filePath = searchParams.get('filePath');
  const siteId = searchParams.get('siteId');
  const driveId = searchParams.get('driveId');
  const sharePointUrl = searchParams.get('url'); // Fallback for old format
  
  if (!filePath || !siteId || !driveId) {
    // If we don't have the new format, try to parse from SharePoint URL
    if (sharePointUrl) {
      console.log('Using fallback SharePoint URL parsing:', sharePointUrl);
      // For now, return an error message asking to re-upload
      return NextResponse.json({ 
        error: 'Audio file needs to be re-uploaded to work with the new system. Please upload the voice again from the admin panel.' 
      }, { status: 400 });
    }
    
    return NextResponse.json({ 
      error: 'filePath, siteId, and driveId are required' 
    }, { status: 400 });
  }

  try {
    console.log('Audio proxy request:', { filePath, siteId, driveId });
    const client = await getGraphClient();
    
    // Try to get the file content using the Graph API
    let fileContent: ArrayBuffer;
    let contentType = 'audio/mpeg'; // default
    
    try {
      // Get the access token for direct fetch
      const credential = new ClientSecretCredential(
        process.env.AZURE_TENANT_ID!,
        process.env.AZURE_CLIENT_ID!,
        process.env.AZURE_CLIENT_SECRET!
      );
      const token = await credential.getToken('https://graph.microsoft.com/.default');
      
      // Use direct fetch to get the file content
      const graphApiUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${filePath}:/content`;
      console.log('Graph API URL:', graphApiUrl);
      
      const response = await fetch(graphApiUrl, {
        headers: {
          'Authorization': `Bearer ${token.token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      fileContent = await response.arrayBuffer();
      console.log('Got file content, size:', fileContent.byteLength);
      
      // Try to determine content type from file extension
      const ext = filePath.split('.').pop()?.toLowerCase();
      switch (ext) {
        case 'mp3':
          contentType = 'audio/mpeg';
          break;
        case 'wav':
          contentType = 'audio/wav';
          break;
        case 'ogg':
          contentType = 'audio/ogg';
          break;
        case 'm4a':
          contentType = 'audio/mp4';
          break;
        case 'aac':
          contentType = 'audio/aac';
          break;
        case 'flac':
          contentType = 'audio/flac';
          break;
      }
      console.log('Content type:', contentType);
      
    } catch (error) {
      console.error('Error fetching file from SharePoint:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch audio file', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, { status: 500 });
    }

    // Handle Range requests for audio streaming
    const range = request.headers.get('range');
    if (range) {
      const match = range.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : fileContent.byteLength - 1;
        const chunkSize = end - start + 1;

        const chunk = fileContent.slice(start, end + 1);

        return new NextResponse(chunk, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${fileContent.byteLength}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize.toString(),
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': 'Range',
          },
        });
      }
    }

    // Return the entire file
    return new NextResponse(fileContent, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileContent.byteLength.toString(),
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range',
      },
    });
  } catch (error) {
    console.error('Error in audio proxy:', error);
    return NextResponse.json({ error: 'Failed to proxy audio file' }, { status: 500 });
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range',
    },
  });
}
